// Trumf (NorgesGruppen) receipt API client.
// Covers Kiwi, Meny, Spar, Joker — all stores in the Trumf program.
//
// Unofficial API used by trumf.no itself. The user supplies a Bearer token
// copied from a logged-in trumf.no browser session (Settings → Butikker).
// Live schema confirmed 2026-06-11 — see
// skills/receipts/store-integration-research.md for the full investigation.

const BASE = "https://platform-rest-prod.ngdata.no/trumf/medlemskap";

export interface TrumfTransaction {
  batchId: string;
  beskrivelse: string; // store name, e.g. "KIWI Lillestrøm"
  partnerId?: string; // chain, e.g. "KIWI"
  butikkId?: string;
  belop: string | number; // total amount
  bonus?: string | number; // bonus earned
  bonusberegningTidspunkt?: string; // date "2026-06-10"
  transaksjonsTidspunkt?: string; // purchase timestamp (preferred date)
  kvitteringsId?: string;
  harKvittering: boolean; // true ⇒ a digital receipt with line items exists
  transaksjonKategori?: string; // "EARN" for purchases, "CONSUME" for bonus payouts
  transaksjonType?: string; // e.g. "ZBANK_PAYMENT" for a bonus bank transfer
}

/** True for bonus withdrawals/redemptions — not grocery spend, skip these. */
export function isBonusConsumption(t: TrumfTransaction): boolean {
  return t.transaksjonKategori === "CONSUME";
}

export interface TrumfLineItem {
  produktBeskrivelse: string; // raw product text, e.g. "REKER FROSNE 70/90"
  antall: string; // quantity as string, may be a weight ("3.098")
  enhetsType?: string; // unit: "KG" | "STK"
  belop: string | number; // line total
  besparelser?: Array<{ belop?: string | number }>; // savings lines
  ukjentVare?: boolean;
  varelinjeGuid?: string;
}

export interface TrumfReceiptDetail {
  batchId: string;
  beskrivelse?: string;
  partnerId?: string;
  butikkId?: string;
  belop?: string | number;
  bonus?: string | number;
  transaksjonsTidspunkt?: string;
  bonusberegningTidspunkt?: string;
  varelinjer?: TrumfLineItem[];
}

export class TrumfAuthError extends Error {
  constructor(message = "Trumf-token er utløpt eller ugyldig") {
    super(message);
    this.name = "TrumfAuthError";
  }
}

function headers(token: string): HeadersInit {
  return {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    Accept: "*/*",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  };
}

async function trumfGet<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new TrumfAuthError();
  if (!res.ok) {
    throw new Error(`Trumf API ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
  }
  return (await res.json()) as T;
}

/** Fetch transactions in [from, to]. Dates as YYYY-MM-DD. */
export async function fetchTrumfTransactions(
  token: string,
  from: string,
  to: string
): Promise<TrumfTransaction[]> {
  const params = new URLSearchParams({ fra: from, til: to });
  return trumfGet<TrumfTransaction[]>(`${BASE}/transaksjoner?${params}`, token);
}

/** Fetch the digital receipt (header + line items) for one transaction. */
export async function fetchTrumfReceiptDetail(
  token: string,
  batchId: string
): Promise<TrumfReceiptDetail> {
  return trumfGet<TrumfReceiptDetail>(
    `${BASE}/transaksjoner/digitalkvittering/${encodeURIComponent(batchId)}`,
    token
  );
}

export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Extract a YYYY-MM-DD date from a Trumf timestamp string. */
export function toDateOnly(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

/** Sum the savings (besparelser) on a line into a single discount amount. */
export function lineDiscount(besparelser?: TrumfLineItem["besparelser"]): number | null {
  if (!Array.isArray(besparelser) || besparelser.length === 0) return null;
  const sum = besparelser.reduce((s, b) => s + (toNumber(b?.belop) ?? 0), 0);
  return sum === 0 ? null : Number(sum.toFixed(2));
}
