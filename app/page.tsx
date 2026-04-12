"use client";

import { useState } from "react";

type Step = { name: string; status: string; detail?: string };

export default function Home() {
  const [message, setMessage] = useState(
    "Оцени клиента 12345 для кредита 500000"
  );
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setReport(null);
    setSteps(null);
    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setReport(JSON.stringify(data, null, 2));
      setSteps(data.steps ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>AI Credit Risk Analyst</h1>
      <p className="lead">
        PoC: кредитная история → PD → правила → RAG по политике → объяснение LLM (решение
        фиксируется правилами, не моделью).
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Запрос аналитика…"
        aria-label="Запрос"
      />
      <div>
        <button type="button" onClick={submit} disabled={loading}>
          {loading ? "Анализ…" : "Оценить риск"}
        </button>
      </div>
      {error && (
        <pre className="report" style={{ borderColor: "var(--bad)" }}>
          {error}
        </pre>
      )}
      {steps && steps.length > 0 && (
        <div className="steps">
          <strong>Шаги:</strong>
          {steps.map((s) => (
            <span key={s.name}>
              <span
                className={`badge ${
                  s.status === "ok" ? "ok" : s.status === "degraded" ? "degraded" : "error"
                }`}
              >
                {s.name}: {s.status}
              </span>
            </span>
          ))}
        </div>
      )}
      {report && <pre className="report">{report}</pre>}
      <p className="hint">
        Демо-ID: <code>12345</code> — обычный клиент; <code>no_history</code>,{" "}
        <code>conflict</code>, <code>timeout</code> (сбой PD), <code>timeout_bki</code> (сбой
        БКИ). Сумма &gt; 1 000 000 — лимит (reject).
        Нужен <code>OPENAI_API_KEY</code> для LLM и embeddings.
      </p>
    </main>
  );
}
