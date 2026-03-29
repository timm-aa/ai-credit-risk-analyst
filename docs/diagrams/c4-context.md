# C4 — Context

Уровень **Context**: пользователь, система PoC, внешние сервисы. Диаграмма в стандартном Mermaid (рендер на GitHub).

```mermaid
flowchart LR
    subgraph External["Вне системы"]
        A[Риск-аналитик]
    end

    subgraph PoC["AI Credit Risk Analyst"]
        CRA[Агент и оркестрация]
    end

    BKI[(Credit History API)]
    PD[(PD / Scoring)]
    LLM[(LLM API)]
    OBS[(Observability)]

    A -->|запрос / отчёт| CRA
    CRA -->|кредитная история| BKI
    CRA -->|PD, grade| PD
    CRA -->|объяснение| LLM
    CRA -->|события без PII| OBS
```

**Граница ответственности:** аналитик не обращается напрямую к БКИ/PD/LLM; все вызовы идут через PoC (контроль контрактов, таймаутов, guardrails).
