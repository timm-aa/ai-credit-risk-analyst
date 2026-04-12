import type { CreditHistoryResult } from "@/lib/types";

function validateClientId(clientId: string): string | null {
  if (clientId.length < 4 || clientId.length > 32) return "Invalid client_id length";
  if (!/^[a-zA-Z0-9_-]+$/.test(clientId)) return "Invalid client_id characters";
  const lower = clientId.toLowerCase();
  if (
    lower.includes("ignore previous") ||
    lower.includes("system prompt") ||
    lower.includes("jailbreak")
  ) {
    return "Suspicious client_id pattern";
  }
  return null;
}

async function fetchMockCreditHistoryOnce(clientId: string): Promise<CreditHistoryResult> {
  const err = validateClientId(clientId);
  if (err) {
    return { ok: false, code: "CLIENT_ERROR", message: err };
  }

  if (clientId === "timeout_bki") {
    await new Promise((r) => setTimeout(r, 80));
    return { ok: false, code: "TIMEOUT", message: "Credit history service timeout" };
  }

  if (clientId === "no_history") {
    return {
      ok: true,
      has_history: false,
      total_debt: 0,
      delinquency_count: 0,
      conflict_flag: false,
      record_count: 0,
    };
  }

  if (clientId === "conflict") {
    return {
      ok: true,
      has_history: true,
      total_debt: 200_000,
      delinquency_count: 2,
      conflict_flag: true,
      record_count: 1,
    };
  }

  return {
    ok: true,
    has_history: true,
    total_debt: 100_000,
    delinquency_count: 0,
    conflict_flag: false,
    record_count: 2,
  };
}

export async function getCreditHistory(clientId: string): Promise<CreditHistoryResult> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    const r = await fetchMockCreditHistoryOnce(clientId);
    if (r.ok) return r;
    if (r.code !== "TIMEOUT" && r.code !== "UPSTREAM_ERROR") return r;
    if (attempt < 2) await new Promise((res) => setTimeout(res, 200 * (attempt + 1)));
    else return r;
  }
  return { ok: false, code: "UPSTREAM_ERROR", message: "unreachable" };
}
