const VONAGE_API_KEY = process.env.VONAGE_API_KEY ?? "";
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET ?? "";

const BASE = "https://rest.nexmo.com";

function configured(): boolean {
  return Boolean(VONAGE_API_KEY && VONAGE_API_SECRET);
}

async function vonageFetch(
  path: string,
  method: "GET" | "POST" = "GET",
  params: Record<string, string> = {},
): Promise<any> {
  const qs = new URLSearchParams({
    api_key: VONAGE_API_KEY,
    api_secret: VONAGE_API_SECRET,
    ...params,
  });

  const url =
    method === "GET"
      ? `${BASE}${path}?${qs}`
      : `${BASE}${path}`;

  const opts: RequestInit =
    method === "POST"
      ? { method: "POST", body: qs, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      : { method: "GET" };

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vonage ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const vonageClient = {
  configured,

  async searchNumbers(country: string): Promise<any[]> {
    if (!configured()) return [];
    const data = await vonageFetch("/number/search", "GET", { country, features: "SMS" });
    return data.numbers ?? [];
  },

  async rentNumber(country: string, msisdn: string): Promise<void> {
    if (!configured()) throw new Error("Vonage not configured");
    await vonageFetch("/number/buy", "POST", { country, msisdn });
  },

  async releaseNumber(country: string, msisdn: string): Promise<void> {
    if (!configured()) throw new Error("Vonage not configured");
    await vonageFetch("/number/cancel", "POST", { country, msisdn });
  },
};
