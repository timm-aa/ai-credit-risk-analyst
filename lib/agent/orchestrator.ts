import OpenAI from "openai";
import type { RiskReport } from "@/lib/types";
import { getCreditHistory } from "@/lib/tools/creditHistory";
import { callPdModel, pdFallbackBucket } from "@/lib/tools/pdModel";
import { applyRules } from "@/lib/rules/engine";
import { guardrailPre } from "@/lib/guardrails/pre";
import { enforceDecisionInvariant, guardrailPostText } from "@/lib/guardrails/post";
import { retrievePolicy, buildRetrieverQuery } from "@/lib/retriever/retrieve";
import { generateExplanationWithRetry } from "@/lib/llm/explain";
import { parseSlots } from "@/lib/agent/parseSlots";
import { CONFIG } from "@/lib/config";

function step(
  name: string,
  status: RiskReport["steps"][0]["status"],
  detail?: string
): RiskReport["steps"][0] {
  return { name, status, detail };
}

export async function runAssessment(userMessage: string): Promise<RiskReport> {
  const steps: RiskReport["steps"] = [];

  const pre = guardrailPre(userMessage);
  if (!pre.ok) {
    return {
      client_id: "—",
      loan_amount: 0,
      decision: "manual_review",
      pd_score: null,
      risk_grade: null,
      explanation: pre.safe_message,
      policy_summary: "Запрос не обработан (pre-guardrail).",
      recommendations: ["Переформулируйте запрос в рамках кредитного риска."],
      flags: ["guardrail_pre"],
      steps: [step("guardrail_pre", "error", pre.reason)],
    };
  }
  steps.push(step("guardrail_pre", "ok"));

  const slots = parseSlots(userMessage);
  steps.push(step("parse_slots", "ok", `${slots.client_id} / ${slots.loan_amount}`));

  const credit = await getCreditHistory(slots.client_id);
  if (!credit.ok) {
    steps.push(step("credit_history", "error", credit.message));
  } else {
    steps.push(step("credit_history", "ok"));
  }

  let pdFallbackUsed = false;
  let pd = credit.ok
    ? await callPdModel(slots.client_id, slots.loan_amount, credit)
    : pdFallbackBucket(slots.loan_amount, {
        ok: true,
        has_history: false,
        total_debt: 0,
        delinquency_count: 0,
        conflict_flag: false,
        record_count: 0,
      });

  if (!pd.ok) {
    pdFallbackUsed = true;
    steps.push(step("pd_model", "degraded", pd.message));
    pd = pdFallbackBucket(
      slots.loan_amount,
      credit.ok
        ? credit
        : {
            ok: true,
            has_history: false,
            total_debt: 0,
            delinquency_count: 0,
            conflict_flag: false,
            record_count: 0,
          }
    );
  } else {
    steps.push(step("pd_model", "ok"));
  }

  const rules = applyRules({
    loanAmount: slots.loan_amount,
    credit,
    pd,
    pdDegradedFallback: pdFallbackUsed,
  });
  const ruleFlags = [...rules.flags];
  steps.push(step("rules_engine", "ok", rules.decision));

  const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  const retrieval = await retrievePolicy({
    openai,
    query: buildRetrieverQuery({
      loanAmount: slots.loan_amount,
      flags: ruleFlags,
      pdScore: pd.ok ? pd.pd_score : null,
    }),
  });

  if (retrieval.retrieval_mode === "empty") {
    steps.push(step("retriever", "degraded", "empty"));
  } else if (retrieval.fallback_used) {
    steps.push(step("retriever", "degraded", retrieval.retrieval_mode));
  } else {
    steps.push(step("retriever", "ok", retrieval.retrieval_mode));
  }

  const facts = {
    client_id: slots.client_id,
    loan_amount: slots.loan_amount,
    credit: credit.ok
      ? {
          has_history: credit.has_history,
          total_debt: credit.total_debt,
          delinquency_count: credit.delinquency_count,
          conflict: credit.conflict_flag,
        }
      : { error: credit.message },
    pd: pd.ok ? { pd_score: pd.pd_score, risk_grade: pd.risk_grade } : { degraded: true },
    rules_decision: rules.decision,
    policy_compliant: rules.compliant,
    retrieval_mode: retrieval.retrieval_mode,
  };

  let explanation: string;
  let citations: string[] = [];
  let llm_degraded = false;

  if (openai) {
    const gen = await generateExplanationWithRetry({
      openai,
      userMessage,
      facts,
      policyChunks: retrieval.chunks,
      decision: rules.decision,
      flags: ruleFlags,
    });
    explanation = gen.explanation;
    citations = gen.citations;
    llm_degraded = gen.degraded;
    steps.push(step("llm", llm_degraded ? "degraded" : "ok"));
  } else {
    explanation = guardrailPostText(
      `Отчёт PoC без LLM: решение ${rules.decision}. Факты: ${JSON.stringify(facts)}`
    );
    llm_degraded = true;
    steps.push(step("llm", "degraded", "no_openai_key"));
  }

  const pdAbove = pd.ok && pd.pd_score > CONFIG.pdRejectThreshold;
  const finalDecision = enforceDecisionInvariant(rules.decision, {
    limit_exceeded: rules.limit_exceeded,
    pdAboveThreshold: pdAbove,
  });

  explanation = guardrailPostText(explanation);

  const flags = [...ruleFlags];
  if (retrieval.retrieval_mode === "empty") flags.push("retrieval_empty");
  if (llm_degraded) flags.push("llm_degraded");

  return {
    client_id: slots.client_id,
    loan_amount: slots.loan_amount,
    decision: finalDecision,
    pd_score: pd.ok ? pd.pd_score : null,
    risk_grade: pd.ok ? pd.risk_grade : null,
    explanation,
    policy_summary: rules.policy_summary,
    recommendations:
      finalDecision === "approve"
        ? ["Проверить остальные условия банка перед окончательным решением (human-in-the-loop)."]
        : finalDecision === "reject"
          ? ["Уведомить клиента согласно внутреннему регламенту.", "Не использовать ответ как единственный источник."]
          : ["Направить на ручную проверку риск-аналитику."],
    flags: Array.from(new Set(flags)),
    citations,
    steps,
    llm_degraded,
  };
}
