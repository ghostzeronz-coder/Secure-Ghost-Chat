import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import express from "express";

let app: express.Express;
let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "blobs-test-"));
  process.env.BLOB_DIR = tmp;
  // Import after setting env so the route picks up the temp dir.
  const blobsRouter = (await import("../routes/blobs")).default;
  app = express();
  app.use("/api", blobsRouter);
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function request(
  method: string,
  path: string,
  opts: { body?: Buffer; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown; raw: Buffer }> {
  const { createServer } = await import("http");
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no addr");
  try {
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers: opts.headers,
      body: opts.body,
    });
    const raw = Buffer.from(await res.arrayBuffer());
    let body: unknown = raw.toString("utf8");
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      /* binary */
    }
    return { status: res.status, body, raw };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("blobs route", () => {
  it("uploads then downloads identical bytes", async () => {
    const payload = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const up = await request("POST", "/api/blobs", {
      body: payload,
      headers: { "Content-Type": "application/octet-stream" },
    });
    expect(up.status).toBe(200);
    const { blobId } = up.body as { blobId: string };
    expect(blobId).toMatch(/^[0-9a-f-]{36}$/);

    const down = await request("GET", `/api/blobs/${blobId}`);
    expect(down.status).toBe(200);
    expect(down.raw.equals(payload)).toBe(true);

    const onDisk = await readFile(join(tmp, blobId));
    expect(onDisk.equals(payload)).toBe(true);
  });

  it("rejects empty body", async () => {
    const r = await request("POST", "/api/blobs", {
      body: Buffer.alloc(0),
      headers: { "Content-Type": "application/octet-stream" },
    });
    expect(r.status).toBe(400);
  });

  it("rejects invalid blob id on GET", async () => {
    const r = await request("GET", "/api/blobs/not-a-uuid");
    expect(r.status).toBe(400);
  });

  it("returns 404 for missing blob", async () => {
    const r = await request("GET", "/api/blobs/00000000-0000-0000-0000-000000000000");
    expect(r.status).toBe(404);
  });
});
