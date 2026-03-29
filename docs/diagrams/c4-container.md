# C4 — Container

```mermaid
flowchart TB
    subgraph Users[" "]
        UI[Frontend\nминимальный UI]
    end

    subgraph Backend["Backend / API"]
        API[API Gateway\nrate limit, маршрутизация]
    end

    subgraph Core["Ядро агента"]
        ORCH[Orchestrator\nstate graph]
        TL[Tool layer\nадаптеры API]
        RET[Retriever\nembeddings + index]
        LLM[LLM adapter\nstructured + text]
    end

    subgraph Data["Данные"]
        VDB[(Vector store\nчанки политики)]
        CACHE[(Кэш\nопц. embeddings)]
    end

    subgraph Platform["Платформа"]
        O11y[Observability\nлоги / метрики / трейсы]
        CFG[Config + secrets]
    end

    subgraph External["Внешние сервисы"]
        BKI[Credit History API]
        PD[PD service]
        LAPI[LLM provider]
    end

    UI --> API
    API --> ORCH
    ORCH --> TL
    ORCH --> RET
    ORCH --> LLM
    TL --> BKI
    TL --> PD
    LLM --> LAPI
    RET --> VDB
    RET --> CACHE
    ORCH --> O11y
    API --> CFG
```

**Назначение контейнеров**

| Контейнер | Роль |
|-----------|------|
| Frontend | Ввод запроса, отображение отчёта и статусов |
| API Gateway | Единая точка входа, лимиты |
| Orchestrator | Граф шагов, state, ветки ошибок |
| Tool layer | Изолированные вызовы БКИ и PD |
| Retriever | Поиск по политике, citations |
| LLM adapter | Формирование промптов, парсинг ответа, retry |
| Vector store | Индекс политики |
| Observability | Без сырых ПДн в логах по политике governance |
