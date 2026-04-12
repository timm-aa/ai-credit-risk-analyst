import type { Decision } from "@/lib/types";

const FORBIDDEN = [
  /окончательно\s+одобрен/i,
  /гарантированн/i,
  /юридически\s+обязательн/i,
  /final\s+approval/i,
];

export function guardrailPostText(text: string): string {
  let t = text;
  for (const re of FORBIDDEN) {
    t = t.replace(re, "[формулировка снята политикой PoC]");
  }
  return t;
}

/** Enforce: limit exceeded or high PD cannot become approve */
export function enforceDecisionInvariant(
  decision: Decision,
  rules: { limit_exceeded: boolean; pdAboveThreshold: boolean }
): Decision {
  if (rules.limit_exceeded) return "reject";
  if (rules.pdAboveThreshold) return "reject";
  return decision;
}
