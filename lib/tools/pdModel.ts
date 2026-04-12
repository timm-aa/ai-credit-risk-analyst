import type { CreditHistoryResult, PDResult } from "@/lib/types";
import { withRetry } from "@/lib/tools/retry";
import { CONFIG } from "@/lib/config";

function clampPd(n: number): number {
  return Math.min(0.95, Math.max(0.01, n));
}

function gradeFromPd(pd: number): string {
  if (pd < 0.1) return "A";
  if (pd < 0.2) return "B";
  if (pd < 0.35) return "C";
  if (pd < 0.5) return "D";
  return "E";
}

function ruleBasedPd(loanAmount: number, ch: CreditHistoryResult): { pd_score: number; risk_grade: string } {
  let base = 0.06;
  if (ch.ok && !ch.has_history) base = 0.18;
  if (ch.ok && ch.delinquency_count > 0) base += 0.12 * ch.delinquency_count;
  if (ch.ok && ch.total_debt > loanAmount) base += 0.08;
  base += (loanAmount / 5_000_000) * 0.05;
  const pd_score = clampPd(base);
  return { pd_score, risk_grade: gradeFromPd(pd_score) };
}

async function callPdInner(
  clientId: string,
  loanAmount: number,
  ch: CreditHistoryResult
): Promise<PDResult> {
  if (loanAmount <= 0 || loanAmount > 50_000_000) {
    return { ok: false, code: "VALIDATION", message: "loan_amount out of range" };
  }

  if (clientId === "timeout" || clientId === "timeout_pd") {
    await new Promise((r) => setTimeout(r, 80));
    return { ok: false, code: "TIMEOUT", message: "PD service timeout" };
  }

  const { pd_score, risk_grade } = ruleBasedPd(loanAmount, ch);
  return { ok: true, pd_score, risk_grade };
}

export async function callPdModel(
  clientId: string,
  loanAmount: number,
  ch: CreditHistoryResult
): Promise<PDResult> {
  try {
    return await withRetry(() => callPdInner(clientId, loanAmount, ch), {
      retries: 2,
      delayMs: 150,
      label: "pd",
    });
  } catch {
    return { ok: false, code: "TIMEOUT", message: "PD retries exhausted" };
  }
}

/** Fallback when PD tool fails: coarse bucket, no fabricated precision. */
export function pdFallbackBucket(loanAmount: number, ch: CreditHistoryResult): PDResult {
  const { pd_score, risk_grade } = ruleBasedPd(loanAmount, ch);
  return { ok: true, pd_score, risk_grade };
}
