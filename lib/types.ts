import { z } from "zod";

export const DecisionSchema = z.enum(["approve", "reject", "manual_review"]);
export type Decision = z.infer<typeof DecisionSchema>;

export const RiskReportSchema = z.object({
  client_id: z.string(),
  loan_amount: z.number(),
  decision: DecisionSchema,
  pd_score: z.number().nullable(),
  risk_grade: z.string().nullable(),
  explanation: z.string(),
  policy_summary: z.string(),
  recommendations: z.array(z.string()),
  flags: z.array(z.string()),
  citations: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["ok", "degraded", "error"]),
      detail: z.string().optional(),
    })
  ),
  llm_degraded: z.boolean().optional(),
});

export type RiskReport = z.infer<typeof RiskReportSchema>;

export type CreditHistoryResult =
  | {
      ok: true;
      has_history: boolean;
      total_debt: number;
      delinquency_count: number;
      conflict_flag: boolean;
      record_count: number;
    }
  | { ok: false; code: "TIMEOUT" | "UPSTREAM_ERROR" | "CLIENT_ERROR"; message: string };

export type PDResult =
  | { ok: true; pd_score: number; risk_grade: string }
  | { ok: false; code: "TIMEOUT" | "VALIDATION" | "UPSTREAM_ERROR"; message: string };

export type PolicyChunk = {
  chunk_id: string;
  policy_version: string;
  title: string;
  text: string;
  score: number;
};

export type RetrievalResult = {
  chunks: PolicyChunk[];
  fallback_used: boolean;
  retrieval_mode: "vector" | "bm25" | "empty";
};
