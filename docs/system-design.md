# System Design: AI Credit Risk Analyst (PoC)

Документ фиксирует архитектуру PoC перед реализацией. **Акцент (агентский трек):** взаимодействие с LLM, контроль качества выводов, guardrails и fallback при сбоях модели и инструментов.

---

## 1. Ключевые архитектурные решения

| Решение | Обоснование |
|---------|-------------|
| **Оркестрация через граф состояний (agent graph)** | Детерминированный порядок шагов (данные → скоринг → policy → объяснение), явные ветки ошибок и retry |
| **LLM только для интерпретации и текста** | Решение по лимитам и PD опирается на **детерминированные** правила и ответы API; LLM не «считает» PD и не меняет пороги |
| **RAG для кредитной политики** | Политика в виде документов; retrieval + (опционально) rerank; ответы с привязкой к источникам снижают галлюцинации |
| **Инструменты (tools) как единственный канал к данным** | LLM не получает сырые секреты; контракты API, таймауты, валидация на границе tool layer |
| **Структурированный risk report** | Схема (JSON) для decision, flags, citations; свободный текст объяснения — поле `explanation`, проверяемое на полноту |
| **Guardrails до и после LLM** | Доменный фильтр входа, ограничение длины контекста, запрет финального «одобрения» без human-in-the-loop в PoC |

---

## 2. Модули и роли

| Модуль | Роль |
|--------|------|
| **Frontend (минимальный)** | Ввод запроса аналитика, отображение отчёта и статусов шагов |
| **API / Backend** | Аутентификация (заглушка в PoC), маршрутизация запросов к оркестратору, rate limit |
| **Agent / Orchestrator** | Граф шагов: парсинг намерения → вызов tools → агрегация фактов → retrieval policy → вызов LLM для объяснения → сборка отчёта |
| **Tool layer** | Адаптеры: Credit History API, PD service, internal scoring - опционально; единый формат ошибок и таймаутов |
| **Retriever** | Индекс документов кредитной политики; embedding search; опционально reranking; возврат чанков + метаданных для цитирования |
| **LLM service** | Генерация объяснения и формулировок при фиксированных фактах; structured output где возможно |
| **Memory / Context** | Сессионное состояние: `client_id`, сумма, результаты tools, retrieval hits; без долговременного хранения PII в PoC |
| **Storage** | Векторное хранилище чанков политики; опционально кэш embedding запросов; без production БД заявок в PoC |
| **Observability** | Логи шагов графа, трейсы вызовов LLM/tools, метрики latency и policy-check |

Подробнее: `docs/specs/`.

---

## 3. Основной workflow выполнения задачи

1. Аналитик отправляет **естественноязыковой запрос** (например, оценка клиента X на сумму Y).
2. **Intent + slot filling** (правила + лёгкий LLM-парсинг в PoC): извлечь `client_id`, `loan_amount`; при нехватке — уточнение или отказ с перечнем полей.
3. **Credit History tool** → факты о кредитной истории (или флаг «нет истории» / «конфликт»).
4. **PD tool** → `pd_score`, `risk_grade` или ошибка/таймаут.
5. **Policy rules engine** (детерминированно) + **Retriever** для релевантных фрагментов политики → сводка соответствия + citations.
6. **LLM** получает **только агрегированные факты и чанки политики** (не сырые ПДн сверх необходимого) → генерирует `explanation` и при необходимости уточняет формулировки в рамках схемы.
7. **Assembler** собирает **RiskReport** (JSON + текст): decision из правил, flags из edge cases, explanation от LLM.
8. **Guardrail post-check**: decision не противоречит детерминированным флагам (например, лимит превышен → не «approve»).

Диаграммы: `docs/diagrams/workflow.md`, `docs/diagrams/data-flow.md`, `docs/diagrams/happy-path-sequence.md` (успешный сценарий).

Контракт ответа API: **JSON Schema** для `RiskReport` — `docs/risk-report-schema.md` (в коде — Zod `RiskReportSchema`).

Операционные практики LLM: **LLMOps** — `docs/llmops.md`; пример промпта — `docs/prompts.md`.

---

## 4. State / memory / context handling

| Слой | Содержимое | Политика |
|------|------------|----------|
| **Session state** | `session_id`, `user_message`, извлечённые слоты, результаты каждого tool, retrieval results, финальный отчёт | Живёт на время запроса (и короткой сессии уточнений); TTL минуты |
| **Контекст LLM** | Системный промпт (роль, запреты), сжатые факты (структурированный блок), top-k чанков политики с id, последний user message | **Budget токенов:** верхняя граница на размер политики + facts; при переполнении — сжатие фактов и уменьшение k |
| **Долговременная память** | В PoC **не храним** профили клиентов между сессиями | Явное ограничение для снижения риска PII |

Детали: `docs/specs/memory-context.md`.

---

## 5. Retrieval-контур (RAG)

| Этап | Описание |
|------|----------|
| **Источники** | Markdown/PDF фрагменты кредитной политики (версионирование документа в метаданных) |
| **Индекс** | Chunking (512–1024 токенов, overlap), embeddings, векторное хранилище |
| **Запрос** | Извлекаются ключи из state: сумма кредита, наличие истории, PD bucket (rating) → **query** для semantic search |
| **Поиск** | Top-k (например, k=5), порог similarity; при пустом результате — **fallback:** keyword/BM25 по тем же чанкам |
| **Reranking** (опц.) | Cross-encoder или второй LLM для top-k → top-3 в контекст LLM |
| **Контроль качества** | В отчёт попадают **citations** (id чанка / заголовок раздела); LLM просим ссылаться на переданные фрагменты |

Детали: `docs/specs/retriever.md`.

---

## 6. Tool / API интеграции

Единый паттерн: **вход по контракту → таймаут → retry (идемпотентные GET) → типизированная ошибка → запись в state для оркестратора**.

| Интеграция | Назначение |
|------------|------------|
| **Credit History API** | Кредитная история по `client_id` |
| **PD service** | Вероятность дефолта, grade |
| **Policy documents** | Только через Retriever + rules engine, не прямой «произвольный SQL» из LLM |

Детали: `docs/specs/tools-apis.md`.

---

## 7. Failure modes, fallback и guardrails

### 7.1 Failure modes

| Сбой | Поведение |
|------|-----------|
| Credit History timeout / 5xx | Retry 2× → state `credit_history_error` → отчёт с флагом, decision **manual_review** если нет данных |
| Нет кредитной истории | Флаг `thin_file` → правила + LLM объясняет ограничения |
| Конфликт данных | Флаг `data_conflict` → **manual_review**, LLM не утверждает однозначное одобрение |
| PD timeout | Retry → fallback **rule-based bucket** (грубые пороги) + флаг `pd_degraded` |
| PD вернул ошибку валидации | Без retry тела запроса — исправление на стороне оркестратора или manual_review |
| Retriever пустой | Fallback BM25; если снова пусто — policy только по **жёстким правилам**, в тексте — «политика: уточнить вручную» |
| LLM timeout / rate limit | Retry 1× с укороченным контекстом → шаблонное объяснение по фактам без LLM |
| LLM output не парсится | Валидация JSON → повтор с ужесточённым промптом 1× → частичный отчёт + флаг |

### 7.2 Guardrails (агентский фокус)

- **Вход:** максимальная длина сообщения; блок очевидных injection-паттернов; домен «только кредитный риск».
- **Выход:** запрет строки «одобрено окончательно» / финального юридического обязательства; decision только из **enum**, согласованный с rules engine.
- **Качество:** чеклист полей в отчёте (decision, explanation не пустой при успешном LLM, flags при edge cases).

Детали: `docs/specs/agent-orchestrator.md`.

---

## 8. Ограничения: latency, cost, reliability

| Параметр | Целевое значение (PoC) | Примечание |
|----------|------------------------|------------|
| **Latency (p95)** | ≤ 10 с на один полный анализ | Включает 1–2 вызова LLM, tools, retrieval |
| **Latency (p99)** | ≤ 20 с | Допуск при retry |
| **Стоимость** | < $0.50 на заявку | Кэш embeddings, короткий финальный LLM вызов |
| **Reliability** | Деградация без молчаливого wrong answer | Всегда флаги при fallback; не маскировать отсутствие PD |
| **Availability** | Best-effort в PoC | Нет SLA; при падении LLM — отчёт по правилам + шаблон текста |

---

## 9. Точки контроля

1. После каждого tool — валидация схемы ответа.
2. После retrieval — минимум 1 чанк или зафиксированный fallback.
3. Перед LLM — проверка context budget.
4. После LLM — парсинг structured fields + согласование decision с rules engine.
5. Перед ответом пользователю — финальный guardrail на текст (запрещённые формулировки).

---

## 10. Диаграммы

| Файл | Содержание |
|------|------------|
| `docs/diagrams/c4-context.md` | C4 Context |
| `docs/diagrams/c4-container.md` | C4 Container |
| `docs/diagrams/c4-component.md` | C4 Component (ядро) |
| `docs/diagrams/workflow.md` | Workflow / graph + ветки ошибок |
| `docs/diagrams/data-flow.md` | Поток данных, хранение, логирование |
| `docs/diagrams/happy-path-sequence.md` | Sequence: успешный путь (аналитик → API → tools → RAG → LLM) |

---

## 11. Связь с документами

- Продукт: `docs/product-proposal.md`
- Governance: `docs/governance.md`
- Спецификации модулей: `docs/specs/*.md`
- LLMOps: `docs/llmops.md`
- Промпты (пример): `docs/prompts.md`
- JSON Schema отчёта: `docs/risk-report-schema.md`
