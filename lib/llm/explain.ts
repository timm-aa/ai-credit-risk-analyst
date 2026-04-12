import OpenAI from "openai";
import { z } from "zod";
import { CONFIG } from "@/lib/config";
import type { Decision, PolicyChunk } from "@/lib/types";
import { guardrailPostText } from "@/lib/guardrails/post";

const ResponseSchema = z.object({
  explanation: z.string(),
  citations: z.array(z.string()).optional(),
});

export async function generateExplanation(input: {
  openai: OpenAI;
  userMessage: string;
  facts: Record<string, unknown>;
  policyChunks: PolicyChunk[];
  decision: Decision;
  flags: string[];
}): Promise<{ explanation: string; citations: string[]; degraded: boolean }> {
  const policyText = input.policyChunks
    .slice(0, CONFIG.retrieverTopForLlm)
    .map((c) => `[${c.chunk_id}] ${c.title}\n${c.text}`)
    .join("\n\n---\n\n");

  const system = `Ты ассистент риск-аналитика банка. Пишешь объяснение по УЖЕ вычисленным фактам.
ЗАПРЕЩЕНО: менять числовые значения PD, придумывать факты, обещать окончательное одобрение кредита.
Решение (decision) уже зафиксировано правилами: ${input.decision}. Твоя задача — объяснить почему это согласуется с данными.
Используй только переданные факты и фрагменты политики. Отвечай на русском.`;

  const user = `Запрос пользователя: ${input.userMessage}

Факты (JSON): ${JSON.stringify(input.facts)}

Флаги: ${input.flags.join(", ") || "нет"}

Фрагменты политики (цитировать по chunk_id):
${policyText || "(нет релевантных чанков — опирайся только на факты)"}

Сформируй JSON: { "explanation": "...", "citations": ["chunk_id", ...] }`;

  try {
    const res = await input.openai.chat.completions.create({
      model: CONFIG.llmModel,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = ResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        explanation: templateExplanation(input.facts, input.decision, input.flags),
        citations: [],
        degraded: true,
      };
    }
    return {
      explanation: guardrailPostText(parsed.data.explanation),
      citations: parsed.data.citations ?? [],
      degraded: false,
    };
  } catch {
    return {
      explanation: templateExplanation(input.facts, input.decision, input.flags),
      citations: [],
      degraded: true,
    };
  }
}

/** Один retry с укороченным контекстом политики (спека agent-orchestrator). */
export async function generateExplanationWithRetry(
  input: Parameters<typeof generateExplanation>[0]
): Promise<ReturnType<typeof generateExplanation>> {
  const first = await generateExplanation(input);
  if (!first.degraded) return first;
  return generateExplanation({
    ...input,
    policyChunks: input.policyChunks.slice(0, 1),
  });
}

function templateExplanation(
  facts: Record<string, unknown>,
  decision: Decision,
  flags: string[]
): string {
  return [
    `Решение по правилам: ${decision}.`,
    `Ключевые факты: ${JSON.stringify(facts)}`,
    flags.length ? `Флаги: ${flags.join(", ")}.` : "",
    "LLM недоступен для развёрнутого объяснения; используйте шаблонный отчёт PoC.",
  ]
    .filter(Boolean)
    .join(" ");
}
