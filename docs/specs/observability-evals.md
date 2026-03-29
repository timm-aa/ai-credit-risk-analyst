# Spec: Observability / Evals

## Метрики

| Метрика | Тип | Назначение |
|---------|-----|------------|
| `latency_seconds` | Histogram | Полный запрос, отдельно по узлам графа |
| `tool_latency_ms` | Histogram | по `credit_history`, `pd` |
| `llm_latency_ms` | Histogram | Время генерации |
| `retrieval_hit_rate` | Counter | Успешный vector hit vs fallback BM25 |
| `guardrail_blocks` | Counter | Срабатывания pre/post guardrail |
| `policy_check_accuracy` | Gauge / eval | На золотом наборе (офлайн) |
| `decision_match_rate` | Gauge / eval | Совпадение с экспертной разметкой |

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

## Evals (качество агента)

| Проверка | Метод |
|----------|--------|
| Полнота объяснения | Чеклист на тестовых кейсах (наличие PD, политики, флагов) |
| Соответствие decision правилам | Автоматическое сравнение с эталоном rules engine |
| Галлюцинации | Сравнение утверждений LLM с переданными фактами (LLM-as-judge или правила) |
| Устойчивость к injection | Набор adversarial prompts в CI (опц. для PoC) |

## Алерты (PoC — упрощённо)

- Доля ошибок tool > порога за окно.
- p95 latency > SLO из `system-design.md`.
