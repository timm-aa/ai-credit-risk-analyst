# Sequence diagram — happy path

Основной успешный сценарий: запрос аналитика → инструменты → правила → RAG → LLM → отчёт **без** деградации и без срабатывания guardrail на отказ.

```mermaid
sequenceDiagram
    actor Analyst as Риск-аналитик
    participant UI as UI / API
    participant Orch as Orchestrator
    participant Pre as Pre-guardrail
    participant CH as Credit History (mock)
    participant PD as PD model (mock)
    participant Rules as Rules engine
    participant Ret as Retriever
    participant Emb as OpenAI Embeddings
    participant LLM as OpenAI Chat
    participant Post as Post-guardrail

    Analyst->>UI: POST /api/assess { message }
    UI->>Orch: runAssessment(message)
    Orch->>Pre: guardrailPre(message)
    Pre-->>Orch: ok

    Orch->>Orch: parseSlots()
    Orch->>CH: getCreditHistory(client_id)
    CH-->>Orch: ok, has_history, aggregates

    Orch->>PD: callPdModel(client_id, loan_amount, credit)
    PD-->>Orch: pd_score, risk_grade

    Orch->>Rules: applyRules(...)
    Rules-->>Orch: decision, flags, policy_summary

    Orch->>Ret: retrievePolicy(query)
    Ret->>Emb: embed(query) + cached chunk embeddings
    Emb-->>Ret: vectors
    Ret-->>Orch: chunks[], retrieval_mode=vector

    Orch->>LLM: chat completions JSON (facts + policy chunks)
    LLM-->>Orch: explanation, citations

    Orch->>Post: guardrailPostText, enforceDecisionInvariant
    Post-->>Orch: final text + decision

    Orch-->>UI: RiskReport JSON
    UI-->>Analyst: 200 + report
```

**Примечание:** при отсутствии `OPENAI_API_KEY` шаги Emb/LLM заменяются на BM25-only retrieval и шаблонное объяснение (не показано на диаграмме как happy-path с LLM).
