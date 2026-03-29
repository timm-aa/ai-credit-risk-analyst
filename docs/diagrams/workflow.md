# Workflow / graph — выполнение запроса и ветки ошибок

```mermaid
flowchart TD
    START([Запрос аналитика]) --> PARSE{Слоты извлечены?\nclient_id, loan_amount}
    PARSE -->|нет| ASK[Запрос недостающих полей\nили отказ со списком]
    PARSE -->|да| CH[Tool: Credit History]
    CH -->|timeout 2x| CH_ERR[Флаг credit_history_error\nmanual_review path]
    CH -->|ok| PD[Tool: PD]
    CH_ERR --> RULES
    PD -->|timeout / error| PD_FB[Retry → rule-based PD bucket\nфлаг pd_degraded]
    PD -->|ok| RULES[Rules engine +\nRetriever policy]
    PD_FB --> RULES
    RULES --> RET{Чанки\nнайдены?}
    RET -->|нет| RET_FB[BM25 fallback]
    RET -->|да| LLM_IN[Сбор контекста для LLM]
    RET_FB --> LLM_IN
    LLM_IN --> GR1{Pre-guardrail\nOK?}
    GR1 -->|нет| SAFE[Безопасный отказ\nбез вызова LLM]
    GR1 -->|да| LLM[LLM: explanation +\nstructured fields]
    LLM -->|timeout / parse fail| LLM_FB[Шаблон + флаг\nllm_degraded]
    LLM -->|ok| MERGE[Assembler:\nmerge rules + LLM]
    LLM_FB --> MERGE
    MERGE --> GR2{Post-guardrail:\ndecision vs rules}
    GR2 -->|конфликт| FIX[Принудительно decision\nиз rules engine]
    GR2 -->|ok| OUT([Risk report])
    FIX --> OUT
    ASK --> ENDNODE([Ответ пользователю])
    SAFE --> ENDNODE
    OUT --> ENDNODE
```

**Условные остановки (stop conditions)**

- Успех: собран `RiskReport`, post-guardrail пройден.
- Частичный успех: сработал fallback (PD/retriever/LLM) — отчёт выдан с **флагами**, не маскируя деградацию.
- Отказ без LLM: pre-guardrail или домен вне кредитного риска — короткий ответ без вызова тяжёлых сервисов.
