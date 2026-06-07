import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createHash } from "crypto";
import { Keypair } from "@solana/web3.js";
import { USDC_MINT, PLAN_PRICES } from "../lib/solanaPayments";
import { normalizeAlias } from "../utils/alias";

// A unique, valid base58 reference key — the route parses references with
// `new PublicKey(reference)` before the on-chain lookup, so seeded references
// must be real Solana public keys.
function freshReference(): string {
  return Keypair.generate().publicKey.toBase58();
}

// ---------------------------------------------------------------------------
// End-to-end coverage of the payment unlock flow (Task #134).
//
// Exercises the three crypto endpoints — payment-intent, payment-status,
// entitlement — over a real Express server, with the Solana RPC
// (getSignaturesForAddress / validateTransfer) and the Drizzle DB mocked by
// an in-memory store that enforces the UNIQUE signature constraint used for
// replay protection.
// ---------------------------------------------------------------------------

// A real, valid base58 Solana address (the USDC mint) used as the configured
// receiving wallet so getReceivingWallet() / new PublicKey() accept it.
const WALLET = USDC_MINT;

// ── In-memory DB store + a tiny drizzle-like surface ─────────────────────────

type ColRef = { __table: string; __col: string };
type TableDef = { __table: string } & Record<string, ColRef>;

function makeTable(name: string, cols: string[]): TableDef {
  const t = { __table: name } as TableDef;
  for (const c of cols) t[c] = { __table: name, __col: c };
  return t;
}

const ghostPaymentsTable = makeTable("payments", [
  "id",
  "reference",
  "userId",
  "plan",
  "expectedUsdc",
  "status",
  "signature",
  "recipient",
  "createdAt",
  "expiresAt",
  "confirmedAt",
]);
const ghostEntitlementsTable = makeTable("entitlements", [
  "userId",
  "plan",
  "activeUntil",
  "updatedAt",
]);
const deviceTokensTable = makeTable("deviceTokens", ["userId", "tokenHash"]);

type AnyRow = Record<string, unknown>;
const stores: Record<string, AnyRow[]> = {
  payments: [],
  entitlements: [],
  deviceTokens: [],
};
let nextPaymentId = 1;

function uniqueViolation(): Error {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
  });
}

type Cond = { __op: "eq"; col: ColRef; val: unknown } | { __op: "and"; conds: Cond[] } | undefined;

function matches(row: AnyRow, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.__op === "and") return cond.conds.every((c) => matches(row, c));
  if (cond.__op === "eq") return row[cond.col.__col] === cond.val;
  return true;
}

vi.mock("drizzle-orm", () => ({
  eq: (col: ColRef, val: unknown) => ({ __op: "eq", col, val }),
  and: (...conds: Cond[]) => ({ __op: "and", conds }),
}));

function makeDb() {
  const db = {
    select: () => ({
      from: (tbl: TableDef) => ({
        where: (cond: Cond) => Promise.resolve(stores[tbl.__table].filter((r) => matches(r, cond))),
      }),
    }),
    insert: (tbl: TableDef) => ({
      values: (vals: AnyRow) => {
        const runInsert = () => {
          const store = stores[tbl.__table];
          if (tbl.__table === "payments") {
            if (vals.reference != null && store.some((r) => r.reference === vals.reference)) {
              throw uniqueViolation();
            }
            if (vals.signature != null && store.some((r) => r.signature === vals.signature)) {
              throw uniqueViolation();
            }
            store.push({
              id: nextPaymentId++,
              signature: null,
              confirmedAt: null,
              createdAt: new Date(),
              ...vals,
            });
          } else {
            store.push({ ...vals });
          }
        };
        const promise = Promise.resolve().then(runInsert);
        return {
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
            promise.then(res, rej),
          catch: (rej: (e: unknown) => unknown) => promise.catch(rej),
          onConflictDoUpdate: ({ set }: { target: ColRef; set: AnyRow }) =>
            Promise.resolve().then(() => {
              const store = stores[tbl.__table];
              const existing = store.find((r) => r.userId === vals.userId);
              if (existing) Object.assign(existing, set);
              else store.push({ ...vals });
            }),
        };
      },
    }),
    update: (tbl: TableDef) => ({
      set: (patch: AnyRow) => ({
        where: (cond: Cond) =>
          Promise.resolve().then(() => {
            const store = stores[tbl.__table];
            const targets = store.filter((r) => matches(r, cond));
            if (tbl.__table === "payments" && patch.signature != null) {
              const clash = store.some(
                (r) => !targets.includes(r) && r.signature === patch.signature,
              );
              if (clash) throw uniqueViolation();
            }
            for (const r of targets) Object.assign(r, patch);
          }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };
  return db;
}

vi.mock("@workspace/db", () => ({
  db: makeDb(),
  ghostPaymentsTable,
  ghostEntitlementsTable,
  deviceTokensTable,
}));

// ── Solana RPC / Solana Pay mocks ────────────────────────────────────────────

const mockGetSignatures = vi.fn();
const mockValidateTransfer = vi.fn();

vi.mock("@solana/pay", () => ({
  validateTransfer: (...args: unknown[]) => mockValidateTransfer(...args),
}));

vi.mock("../lib/solanaPayments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/solanaPayments")>();
  return {
    ...actual,
    getConnection: () => ({
      getSignaturesForAddress: (...args: unknown[]) => mockGetSignatures(...args),
    }),
  };
});

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Import the route + an Express app AFTER the mocks are registered.
const cryptoRouter = (await import("../routes/crypto")).default;
const express = (await import("express")).default;
const app = express();
app.use(express.json());
app.use("/api", cryptoRouter);

// ── HTTP helper ──────────────────────────────────────────────────────────────

let ipCounter = 0;

async function request(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no addr");
  try {
    const headers: Record<string, string> = {
      // Unique source IP per call so the module-level rate limiters never trip.
      "x-forwarded-for": `10.0.0.${++ipCounter % 250}`,
    };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* non-json */
    }
    return { status: res.status, body };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ALIAS = "GHOST";
const ALIAS_NORM = normalizeAlias(ALIAS);
const TOKEN = "device-token-abc";

function plantDeviceToken(alias = ALIAS, token = TOKEN): void {
  stores.deviceTokens.push({
    userId: normalizeAlias(alias),
    tokenHash: createHash("sha256").update(token).digest("hex"),
  });
}

function seedPayment(overrides: Partial<AnyRow> = {}): AnyRow {
  const row: AnyRow = {
    id: nextPaymentId++,
    reference: freshReference(),
    userId: ALIAS_NORM,
    plan: "specter",
    expectedUsdc: String(PLAN_PRICES.specter.usdc),
    status: "pending",
    signature: null,
    recipient: WALLET,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60_000),
    confirmedAt: null,
    ...overrides,
  };
  stores.payments.push(row);
  return row;
}

const ORIGINAL_WALLET = process.env.GHOST_WALLET_ADDRESS;

beforeEach(() => {
  stores.payments.length = 0;
  stores.entitlements.length = 0;
  stores.deviceTokens.length = 0;
  nextPaymentId = 1;
  vi.clearAllMocks();
  process.env.GHOST_WALLET_ADDRESS = WALLET;
});

afterAll(() => {
  if (ORIGINAL_WALLET === undefined) delete process.env.GHOST_WALLET_ADDRESS;
  else process.env.GHOST_WALLET_ADDRESS = ORIGINAL_WALLET;
});

// ── POST /api/crypto/payment-intent ──────────────────────────────────────────

describe("POST /api/crypto/payment-intent", () => {
  it("creates a pending payment and returns a Solana Pay URL for the plan", async () => {
    plantDeviceToken();
    const res = await request("POST", "/api/crypto/payment-intent", {
      token: TOKEN,
      body: { alias: ALIAS, plan: "phantom" },
    });
    expect(res.status).toBe(200);
    expect(res.body.usdc).toBe(PLAN_PRICES.phantom.usdc);
    expect(res.body.wallet).toBe(WALLET);
    expect(res.body.usdcMint).toBe(USDC_MINT);
    expect(typeof res.body.reference).toBe("string");
    expect(res.body.solanaPayUrl).toContain(`reference=${res.body.reference}`);
    expect(res.body.solanaPayUrl).toContain(`amount=${PLAN_PRICES.phantom.usdc}`);

    // A pending row was persisted for this user/reference.
    expect(stores.payments).toHaveLength(1);
    const row = stores.payments[0];
    expect(row.status).toBe("pending");
    expect(row.userId).toBe(ALIAS_NORM);
    expect(row.plan).toBe("phantom");
    expect(row.reference).toBe(res.body.reference);
  });

  it("rejects an unknown plan with 400 and writes no row", async () => {
    plantDeviceToken();
    const res = await request("POST", "/api/crypto/payment-intent", {
      token: TOKEN,
      body: { alias: ALIAS, plan: "wraith" },
    });
    expect(res.status).toBe(400);
    expect(stores.payments).toHaveLength(0);
  });

  it("returns 401 without a valid device token", async () => {
    const res = await request("POST", "/api/crypto/payment-intent", {
      body: { alias: ALIAS, plan: "specter" },
    });
    expect(res.status).toBe(401);
    expect(stores.payments).toHaveLength(0);
  });

  it("returns 503 when no receiving wallet is configured", async () => {
    delete process.env.GHOST_WALLET_ADDRESS;
    plantDeviceToken();
    const res = await request("POST", "/api/crypto/payment-intent", {
      token: TOKEN,
      body: { alias: ALIAS, plan: "specter" },
    });
    expect(res.status).toBe(503);
  });
});

// ── GET /api/crypto/payment-status ───────────────────────────────────────────

describe("GET /api/crypto/payment-status", () => {
  it("stays pending when no finalized valid transfer is found yet", async () => {
    plantDeviceToken();
    const p = seedPayment();
    mockGetSignatures.mockResolvedValue([]); // nothing on-chain yet
    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${p.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(stores.entitlements).toHaveLength(0);
  });

  it("stays pending when a candidate transfer fails validation", async () => {
    plantDeviceToken();
    const p = seedPayment();
    mockGetSignatures.mockResolvedValue([{ signature: "SIG_BAD", err: null }]);
    mockValidateTransfer.mockRejectedValue(new Error("amount mismatch"));
    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${p.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending");
    expect(stores.entitlements).toHaveLength(0);
  });

  it("confirms a valid transfer, records the signature, and grants the entitlement", async () => {
    plantDeviceToken();
    const p = seedPayment({ plan: "phantom", expectedUsdc: String(PLAN_PRICES.phantom.usdc) });
    mockGetSignatures.mockResolvedValue([{ signature: "SIG_OK", err: null }]);
    mockValidateTransfer.mockResolvedValue(undefined);

    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${p.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.signature).toBe("SIG_OK");
    const ent = res.body.entitlement as Record<string, unknown>;
    expect(ent.plan).toBe("phantom");
    expect(ent.active).toBe(true);

    // Persisted state: payment confirmed + signature stored; entitlement written.
    expect(p.status).toBe("confirmed");
    expect(p.signature).toBe("SIG_OK");
    expect(stores.entitlements).toHaveLength(1);
    expect(stores.entitlements[0].userId).toBe(ALIAS_NORM);
  });

  it("reports expired for a past-due intent without touching the chain", async () => {
    plantDeviceToken();
    const p = seedPayment({ expiresAt: new Date(Date.now() - 1_000) });
    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${p.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("expired");
    expect(p.status).toBe("expired");
    expect(mockGetSignatures).not.toHaveBeenCalled();
  });

  it("rejects a replay: a second payment cannot redeem an already-used signature", async () => {
    plantDeviceToken();
    const first = seedPayment();
    const second = seedPayment();
    mockGetSignatures.mockResolvedValue([{ signature: "SIG_DUP", err: null }]);
    mockValidateTransfer.mockResolvedValue(undefined);

    // First redemption succeeds and locks in SIG_DUP.
    const r1 = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${first.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(r1.body.status).toBe("confirmed");
    expect(first.signature).toBe("SIG_DUP");

    // Second payment tries to claim the same on-chain signature → blocked by the
    // UNIQUE signature constraint, so it falls back to pending and grants nothing.
    const r2 = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${second.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(r2.body.status).toBe("pending");
    expect(second.status).toBe("pending");
    expect(second.signature).toBeNull();
    expect(stores.entitlements).toHaveLength(1); // only the first redemption
  });

  it("re-reading a confirmed payment is idempotent and returns the entitlement", async () => {
    plantDeviceToken();
    const confirmedAt = new Date();
    const p = seedPayment({ status: "confirmed", signature: "SIG_DONE", confirmedAt });
    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=${p.reference}`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.signature).toBe("SIG_DONE");
    expect(mockGetSignatures).not.toHaveBeenCalled();
    // ensureEntitlement repaired/created the entitlement.
    expect(stores.entitlements).toHaveLength(1);
  });

  it("returns 404 for a reference the user does not own", async () => {
    plantDeviceToken();
    seedPayment({ reference: "ref-owned" });
    const res = await request(
      "GET",
      `/api/crypto/payment-status?alias=${ALIAS}&reference=ref-missing`,
      {
        token: TOKEN,
      },
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 without a valid device token", async () => {
    seedPayment({ reference: "ref-x" });
    const res = await request("GET", `/api/crypto/payment-status?alias=${ALIAS}&reference=ref-x`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/crypto/entitlement ──────────────────────────────────────────────

describe("GET /api/crypto/entitlement", () => {
  it("returns the active entitlement when one is live", async () => {
    plantDeviceToken();
    stores.entitlements.push({
      userId: ALIAS_NORM,
      plan: "specter",
      activeUntil: new Date(Date.now() + 5 * 24 * 60 * 60_000),
      updatedAt: new Date(),
    });
    const res = await request("GET", `/api/crypto/entitlement?alias=${ALIAS}`, { token: TOKEN });
    expect(res.status).toBe(200);
    const ent = res.body.entitlement as Record<string, unknown>;
    expect(ent.plan).toBe("specter");
    expect(ent.active).toBe(true);
    expect(typeof res.body.termDays).toBe("number");
  });

  it("returns null entitlement when the latest one has lapsed", async () => {
    plantDeviceToken();
    stores.entitlements.push({
      userId: ALIAS_NORM,
      plan: "specter",
      activeUntil: new Date(Date.now() - 1_000),
      updatedAt: new Date(),
    });
    const res = await request("GET", `/api/crypto/entitlement?alias=${ALIAS}`, { token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.entitlement).toBeNull();
  });

  it("returns null entitlement when the user has none", async () => {
    plantDeviceToken();
    const res = await request("GET", `/api/crypto/entitlement?alias=${ALIAS}`, { token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body.entitlement).toBeNull();
  });

  it("returns 401 without a valid device token", async () => {
    const res = await request("GET", `/api/crypto/entitlement?alias=${ALIAS}`);
    expect(res.status).toBe(401);
  });
});
