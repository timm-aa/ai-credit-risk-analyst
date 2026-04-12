export const CONFIG = {
  maxLoanWithoutCommittee: 1_000_000,
  pdRejectThreshold: 0.35,
  creditHistoryTimeoutMs: 8000,
  pdTimeoutMs: 8000,
  maxUserMessageChars: 8000,
  retrieverTopK: 5,
  retrieverTopForLlm: 3,
  vectorSimilarityThreshold: 0.45,
  embeddingModel: "text-embedding-3-small",
  llmModel: process.env.OPENAI_LLM_MODEL ?? "gpt-4o-mini",
  policyVersion: "policy-v1",
} as const;
