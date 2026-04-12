import type { CreditHistoryResult, PDResult } from "@/lib/types";
import { CONFIG } from "@/lib/config";

export type RulesOutcome = {
  decision: "approve" | "reject" | "manual_review";
  policy_summary: string;
  flags: string[];
  limit_exceeded: boolean;
  compliant: boolean;
};

export function applyRules(input: {
  loanAmount: number;
  credit: CreditHistoryResult;
  pd: PDResult;
  /** PD получен из rule-based fallback после сбоя сервиса */
  pdDegradedFallback?: boolean;
}): RulesOutcome {
  const flags: string[] = [];
  let limit_exceeded = false;

  if (input.loanAmount > CONFIG.maxLoanWithoutCommittee) {
    limit_exceeded = true;
    flags.push("limit_exceeded");
  }

  if (input.credit.ok && !input.credit.has_history) {
    flags.push("thin_file");
  }

  if (input.credit.ok && input.credit.conflict_flag) {
    flags.push("data_conflict");
  }

  if (!input.credit.ok) {
    flags.push("credit_history_error");
  }

  if (input.pdDegradedFallback) {
    flags.push("pd_degraded");
  }

  let decision: RulesOutcome["decision"] = "manual_review";
  let compliant = true;

  if (limit_exceeded) {
    decision = "reject";
    compliant = false;
  } else if (input.credit.ok && input.credit.conflict_flag) {
    decision = "manual_review";
    compliant = false;
  } else if (!input.credit.ok) {
    decision = "manual_review";
    compliant = false;
  } else if (input.pd.ok && input.pd.pd_score > CONFIG.pdRejectThreshold) {
    decision = "reject";
    compliant = false;
  } else if (
    input.pd.ok &&
    input.credit.ok &&
    input.credit.has_history &&
    !input.credit.conflict_flag &&
    input.pd.pd_score <= CONFIG.pdRejectThreshold
  ) {
    decision = "approve";
  } else if (flags.includes("thin_file") || flags.includes("pd_degraded")) {
    decision = "manual_review";
    compliant = flags.includes("thin_file") ? false : compliant;
  }

  const policy_summary = compliant
    ? "Проверка по жёстким правилам: условия выполнены (в рамках PoC)."
    : "Есть отклонения от автоматических критериев или недостаточно данных; требуется ручная проверка или отказ.";

  return {
    decision,
    policy_summary,
    flags,
    limit_exceeded,
    compliant,
  };
}
