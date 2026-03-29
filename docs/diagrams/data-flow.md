# Data flow — данные, хранение, логирование

Показывает, **что** течёт через систему, **где** хранится и **что** попадает в логи (без дублирования полного текста system-design).

```mermaid
flowchart LR
    subgraph Input["Вход"]
        U[Сообщение аналитика]
    end

    subgraph Transient["В рамках запроса (session state)"]
        S[Slots + результаты tools +\nretrieval hits + черновик отчёта]
    end

    subgraph Persisted["Хранение PoC"]
        V[(Vector index\nполитика)]
        C[(Кэш embeddings\nопц.)]
    end

    subgraph External["Внешние"]
        BKI[БКИ / mock]
        PD[PD / mock]
        L[LLM API]
    end

    subgraph Logs["Логи / observability"]
        L1[Шаги графа\nбез PII]
        L2[Latency, errors\nкоды tool]
        L3[Трейс span\nLLM tokens meta]
    end

    U --> S
    S --> BKI
    S --> PD
    S --> V
    S --> C
    S --> L
    S --> L1
    S --> L2
    S --> L3
```

**Что хранится**

| Данные | Где | PoC |
|--------|-----|-----|
| Чанки кредитной политики + embeddings | Vector store + файлы источников | Да |
| Профиль заёмщика между сессиями | — | Нет |
| Сессионный state | Память процесса / Redis опц. | Только на время запроса |

**Что логируется**

| Категория | Содержимое | Чего нет |
|-----------|------------|----------|
| Шаги оркестратора | Имена узлов, длительность, success/fail | ФИО, полный текст БКИ |
| Tools | Код ответа, latency, **обезличенный** client_id hash | Сырые ответы API с ПДн |
| Retrieval | k, similarity stats, id чанков | Полный текст чанков в production-логах — по политике |
| LLM | Модель, токены in/out, retry | Содержимое промпта с PII — маскирование |

Согласование с `docs/governance.md`: минимизация ПДн, структурированные логи.
