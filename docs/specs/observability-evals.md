# Spec: Observability / Evals

## Стек наблюдаемости (PoC)

| Компонент | Технология / примечание |
|-----------|-------------------------|
| HTTP API | Next.js 14 Route Handlers (`app/api/assess/route.ts`) |
| Логи (цель production) | Структурированный JSON в stdout → сборщик (Datadog, CloudWatch, Axiom и т.д.) |
| Трейсы (цель production) | OpenTelemetry + экспортер, либо встроенные трейсы провайдера хостинга (Vercel) |
| Метрики | Prometheus-совместимые endpoint или сторонний SaaS; в PoC — ручной разбор логов |

## Метрики

| Метрика | Тип | Назначение |
|---------|-----|------------|
| `latency_seconds` | Histogram | Полный запрос, отдельно по узлам графа |
| `tool_latency_ms` | Histogram | по `credit_history`, `pd` |
| `llm_latency_ms` | Histogram | Время генерации |
| `retrieval_hit_rate` | Counter | Успешный vector hit vs fallback BM25 |
| `guardrail_blocks` | Counter | Срабатывания pre/post guardrail |
| `policy_check_accuracy` | Gauge / eval | На золотом наборе (офлайн) |
| `decision_match_rate` | Gauge / eval | Совпадение с эталоном rules engine |
| `llm_degraded_rate` | Gauge | Доля ответов с шаблоном вместо LLM |

## Логи

| Событие | Поля |
|---------|------|
| `graph_step` | `step_name`, `duration_ms`, `session_id`, `status` |
| `tool_call` | `tool`, `status_code`, `latency_ms`, **без** сырого тела с ПДн |
| `llm_call` | `model`, `tokens_in`, `tokens_out`, `retry_count` |
| `report` | `decision`, `flags[]`, `policy_version` |

## Трейсы

- Один trace на запрос аналитика; spans: parse → tools → retrieve → LLM → assemble.
- Связь `session_id` / `trace_id` для отладки без хранения ПДн в логах.

---

## Golden dataset (offline eval)

Набор **фиксированных сценариев** с заранее заданным ожидаемым результатом **rules engine** (эталон хранится в репозитории как JSON/таблица или генерируется тестами). LLM **не** участвует в эталоне `decision` — только детерминированный слой.

### Структура записи

| Поле | Описание |
|------|----------|
| `id` | Уникальный идентификатор кейса |
| `message` | Текст запроса аналитика |
| `expected_decision` | `approve` \| `reject` \| `manual_review` |
| `expected_flags_contain` | Минимальный набор флагов, которые должны присутствовать (подмножество) |
| `notes` | Зачем кейс (лимит, thin file, конфликт и т.д.) |

### Примеры строк (логические)

| id | message (фрагмент) | expected_decision | expected_flags_contain |
|----|--------------------|-------------------|-------------------------|
| G-001 | клиент `12345`, сумма 500000 | `approve` | — (или пустой набор критичных флагов) |
| G-002 | клиент `no_history`, сумма 300000 | `manual_review` | `thin_file` |
| G-003 | клиент `conflict` | `manual_review` | `data_conflict` |
| G-004 | сумма **1 500 000** | `reject` | `limit_exceeded` |
| G-005 | клиент `timeout_bki` | `manual_review` | `credit_history_error` |
| G-006 | клиент `timeout` (сбой PD) | зависит от правил после fallback | `pd_degraded` |

Полный набор расширяется при появлении новых edge cases; регрессия — `npm test` (при добавлении тестов) или скрипт сравнения JSON ответа API с эталоном.

### Метрики на golden set

| Метрика | Определение | Порог успеха (PoC) |
|---------|-------------|---------------------|
| **Decision accuracy** | Доля кейсов, где `report.decision === expected_decision` | **≥ 0.95** (19/20 кейсов) |
| **Flag recall** | Для кейсов с обязательными флагами: все из `expected_flags_contain` присутствуют в `report.flags` | **≥ 0.90** по таким кейсам |
| **Policy consistency** | Согласованность `decision` с инвариантами (лимит, PD-порог) — автоматическая проверка | **1.0** (обязательно) |

Пороги согласованы с продуктовыми целями в `docs/product-proposal.md` (точность policy / решений); при снижении метрик — блокировать смену промпта или модели до разбора.

---

## Прочие проверки качества

| Проверка | Метод | Порог / критерий |
|----------|--------|------------------|
| Полнота объяснения | Чеклист: упоминание PD, decision, при наличии — флагов | **≥ 90%** кейсов с валидным LLM-ответом проходят чеклист |
| Галлюцинации чисел | Извлечённые числа в `explanation` ⊆ допустимые из `facts` | **0** нарушений на golden |
| Устойчивость к injection | Набор adversarial строк в `message` | Pre-guardrail отклоняет **100%** из набора PoC |
| Latency | p95 времени `POST /api/assess` | **≤ 10 с** (цель из system-design; на Vercel Hobby учитывать лимит 10 с функции) |

## Алерты (целевой production)

- Доля ошибок tool > **5%** за 15 минут.
- p95 latency > **12 с** за 1 час.
- `llm_degraded_rate` > **25%** за сутки (сигнал по стоимости/качеству).
