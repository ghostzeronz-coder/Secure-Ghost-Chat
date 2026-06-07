import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use the modules.
// ---------------------------------------------------------------------------
const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();
const mockPoolQuery = vi.fn();
const mockVonageConfigured = vi.fn(() => false);
const mockVonageSearch = vi.fn(async (_country: string) => [] as { msisdn: string }[]);
const mockVonageRent = vi.fn(async (_country: string, _msisdn: string) => {});
const mockVonageRelease = vi.fn(async (_country: string, _msisdn: string) => {});
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

// Fluent Drizzle-style chain helpers.
const makeSet = (returning: () => unknown[]) => ({
  set: () => ({ where: () => returning() }),
});

vi.mock("@workspace/db", () => {
  // Build a minimal drizzle-like `db` object that records calls.
  const db = {
    update: () =>
      makeSet(() => {
        mockDbUpdate();
        return [];
      }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mockDbSelect(),
        }),
      }),
    }),
  };
  const ghostNumbersTable = {
    id: "id",
    status: "status",
    nextRotationAt: "nextRotationAt",
    msisdn: "msisdn",
    archivedMsisdns: "archivedMsisdns",
  } as unknown as typeof import("@workspace/db").ghostNumbersTable;
  const pool = { query: (text: string, params?: unknown[]) => mockPoolQuery(text, params) };
  return { db, ghostNumbersTable, pool };
});

vi.mock("../lib/vonage", () => ({
  vonageClient: {
    configured: () => mockVonageConfigured(),
    searchNumbers: (country: string) => mockVonageSearch(country),
    rentNumber: (country: string, msisdn: string) => mockVonageRent(country, msisdn),
    releaseNumber: (country: string, msisdn: string) => mockVonageRelease(country, msisdn),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: (obj: unknown, msg: string) => mockLoggerInfo(obj, msg),
    warn: (obj: unknown, msg: string) => mockLoggerWarn(obj, msg),
    error: (obj: unknown, msg: string) => mockLoggerError(obj, msg),
  },
}));

// ---------------------------------------------------------------------------
// Import the module AFTER mocks are declared.
// ---------------------------------------------------------------------------
const { __testing } = await import("../lib/rotationScheduler.js");
const { rotateOne, tick } = __testing;

// ---------------------------------------------------------------------------
// Helper: build a ghost number row fixture.
// ---------------------------------------------------------------------------
function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    country: "NZ",
    msisdn: "7654321",
    phoneNumber: "+64 7654321",
    rotateEveryDays: 7,
    nextRotationAt: new Date(Date.now() - 1000),
    status: "active",
    userId: "GHOST",
    archivedMsisdns: [],
    ...overrides,
  } as unknown as Parameters<typeof rotateOne>[0];
}

// ---------------------------------------------------------------------------
// rotateOne — unit tests
// ---------------------------------------------------------------------------
describe("rotateOne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: demo mode (no Vonage), advisory lock succeeds.
    mockVonageConfigured.mockReturnValue(false);
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: true }] });
    mockDbSelect.mockResolvedValue([]);
  });

  it("generates a new demo MSISDN and archives the old one", async () => {
    const row = makeRow();
    await rotateOne(row);

    // db.update must have been called to persist the new msisdn.
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, oldMsisdn: "7654321" }),
      expect.stringContaining("[rotation] Rotated"),
    );
  });

  it("is non-destructive when rotateEveryDays is 0 — skips rotation", async () => {
    const row = makeRow({ rotateEveryDays: 0 });
    await rotateOne(row);

    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockVonageRent).not.toHaveBeenCalled();
  });

  it("is non-destructive when rotateEveryDays is null — skips rotation", async () => {
    const row = makeRow({ rotateEveryDays: null });
    await rotateOne(row);

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("skips rotation without throwing when Vonage returns no available numbers", async () => {
    mockVonageConfigured.mockReturnValue(true);
    mockVonageSearch.mockResolvedValueOnce([]);

    const row = makeRow();
    await rotateOne(row);

    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(mockVonageRent).not.toHaveBeenCalled();
    // performRotation throws ("No Vonage numbers available"); rotateOne catches
    // it and logs a single generic warning rather than re-throwing.
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.stringContaining("Could not obtain replacement number"),
    );
  });

  it("continues rotation even when Vonage release of old number fails", async () => {
    mockVonageConfigured.mockReturnValue(true);
    mockVonageSearch.mockResolvedValueOnce([{ msisdn: "9990001" }]);
    mockVonageRent.mockResolvedValueOnce(undefined);
    mockVonageRelease.mockRejectedValueOnce(new Error("release failed"));

    const row = makeRow();
    await rotateOne(row);

    // Rent was called, release failed, but the DB update still happened.
    expect(mockVonageRent).toHaveBeenCalledTimes(1);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ oldMsisdn: "7654321" }),
      expect.stringContaining("Failed to release old MSISDN"),
    );
  });
});

// ---------------------------------------------------------------------------
// tick — unit tests
// ---------------------------------------------------------------------------
describe("tick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVonageConfigured.mockReturnValue(false);
  });

  it("acquires advisory lock before processing rows", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: true }] });
    mockDbSelect.mockResolvedValue([]);

    await tick();

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_try_advisory_lock"),
      expect.any(Array),
    );
  });

  it("releases advisory lock after processing (even on empty batch)", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: true }] });
    mockDbSelect.mockResolvedValue([]);

    await tick();

    const unlockCall = mockPoolQuery.mock.calls.find(
      (args) => typeof args[0] === "string" && args[0].includes("pg_advisory_unlock"),
    );
    expect(unlockCall).toBeDefined();
  });

  it("returns early without processing when advisory lock cannot be acquired", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: false }] });

    await tick();

    // Only one pool.query call (the lock attempt), no unlock, no DB select.
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("calls rotateOne for each due row", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: true }] });
    mockDbSelect.mockResolvedValue([makeRow({ id: 1 }), makeRow({ id: 2 })]);

    await tick();

    // Two rows → two db.update calls (one per rotateOne).
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });

  it("continues processing remaining rows if one rotation throws", async () => {
    mockPoolQuery.mockResolvedValue({ rows: [{ locked: true }] });
    const rows = [makeRow({ id: 1 }), makeRow({ id: 2 }), makeRow({ id: 3 })];
    mockDbSelect.mockResolvedValue(rows);

    // Make the first rotateOne call throw by having db.update throw once.
    let callCount = 0;
    mockDbUpdate.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("simulated failure on row 1");
    });

    await tick();

    // rotateOne swallows the per-row failure and logs a warning (it never
    // re-throws), so the failing row is reported via logger.warn.
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.stringContaining("Could not obtain replacement number"),
    );
    // Remaining rows were still attempted (calls 2 + 3).
    expect(mockDbUpdate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
