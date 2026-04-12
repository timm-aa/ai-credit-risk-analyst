import OpenAI from "openai";
import { CONFIG } from "@/lib/config";
import type { PolicyChunk, RetrievalResult } from "@/lib/types";
import { loadPolicyChunks } from "@/lib/retriever/chunks";

let embeddingsCache: Map<string, number[]> | null = null;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

function bm25Score(query: string, text: string): number {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const t = text.toLowerCase();
  let s = 0;
  for (const w of q) {
    if (w.length < 2) continue;
    const c = t.split(w).length - 1;
    s += c * (1 + Math.log(1 + w.length));
  }
  return s;
}

async function embed(openai: OpenAI, input: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: CONFIG.embeddingModel,
    input: input.slice(0, 8000),
  });
  return res.data[0].embedding;
}

function bm25Retrieve(query: string): PolicyChunk[] {
  const chunks = loadPolicyChunks();
  return chunks
    .map((c) => ({
      chunk: c,
      score: bm25Score(query, c.text + c.title),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.retrieverTopK)
    .filter((s) => s.score > 0)
    .map((s) => ({
      chunk_id: s.chunk.chunk_id,
      policy_version: s.chunk.policy_version,
      title: s.chunk.title,
      text: s.chunk.text,
      score: Math.min(1, s.score / 10),
    }));
}

export async function retrievePolicy(input: {
  query: string;
  openai: OpenAI | null;
}): Promise<RetrievalResult> {
  const chunks = loadPolicyChunks();

  if (!input.openai) {
    const out = bm25Retrieve(input.query);
    return {
      chunks: out,
      fallback_used: true,
      retrieval_mode: out.length ? "bm25" : "empty",
    };
  }

  let fallback_used = false;
  let mode: RetrievalResult["retrieval_mode"] = "vector";

  if (!embeddingsCache) {
    embeddingsCache = new Map();
    for (const c of chunks) {
      const e = await embed(input.openai, c.text);
      embeddingsCache.set(c.chunk_id, e);
    }
  }

  const qEmb = await embed(input.openai, input.query);
  const scored = chunks
    .map((c) => ({
      chunk: c,
      score: cosine(qEmb, embeddingsCache!.get(c.chunk_id)!),
    }))
    .filter((s) => s.score >= CONFIG.vectorSimilarityThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.retrieverTopK);

  if (scored.length === 0) {
    fallback_used = true;
    mode = "bm25";
    const out = bm25Retrieve(input.query);
    return {
      chunks: out.length ? out : [],
      fallback_used: true,
      retrieval_mode: out.length ? "bm25" : "empty",
    };
  }

  return {
    chunks: scored.map((s) => ({
      chunk_id: s.chunk.chunk_id,
      policy_version: s.chunk.policy_version,
      title: s.chunk.title,
      text: s.chunk.text,
      score: s.score,
    })),
    fallback_used,
    retrieval_mode: mode,
  };
}

export function buildRetrieverQuery(parts: {
  loanAmount: number;
  flags: string[];
  pdScore: number | null;
}): string {
  const f = parts.flags.join(" ");
  return `кредит ${parts.loanAmount} PD ${parts.pdScore ?? "unknown"} риск политика ${f}`;
}
