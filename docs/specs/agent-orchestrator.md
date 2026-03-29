# Spec: Agent / Orchestrator

## Назначение

Управление **графом состояний**: последовательность шагов, условные переходы, вызовы tools и LLM, сборка отчёта. Фокус агентского трека: **качество выводов**, **guardrails**, **fallback и согласованность decision с правилами**.

## Шаги (узлы графа)

1. `parse_intent` — извлечение слотов; при нехватке — ветка уточнения или стоп.
2. `fetch_credit_history` — вызов tool.
3. `fetch_pd` — вызов tool с учётом фактов из credit history.
4. `apply_rules` — детерминированные правила (лимиты, пороги PD, флаги edge cases).
5. `retrieve_policy` — retriever + fallback BM25.
6. `guardrail_pre` — домен, длина, запрет опасных паттернов.
7. `generate_explanation` — LLM с structured + text полями.
8. `guardrail_post` — согласование `decision` enum с rules engine; запрет запрещённых формулировок.
9. `assemble_report` — финальный JSON + текст пользователю.

## Правила переходов

| Условие | Переход |
|---------|---------|
| Слоты неполные | → `ask_clarification` или `reject_missing_fields` |
| Credit history tool fail после retry | → `apply_rules` с флагом `no_credit_data` |
| PD fail после retry | → `apply_rules` с `pd_degraded` + rule-based bucket |
| Retriever empty | → `apply_rules` только rules + флаг |
| Pre-guardrail fail | → `safe_refusal` без LLM |
| LLM fail | → `template_explanation` + флаг `llm_degraded` |

## Stop conditions

- Успех: `assemble_report` выполнен, post-guardrail OK.
- Частичный успех: отчёт с флагами деградации.
- Жёсткий стоп: критичная ошибка валидации входа (без вызова внешних API).

## Retry / fallback

| Операция | Retry | Fallback |
|----------|-------|----------|
| Credit history | 2× | Флаги + manual_review path |
| PD | 2× | Rule-based оценка + флаг |
| LLM | 1× (укороченный контекст) | Шаблон объяснения по фактам |

## Инварианты

- `decision` в отчёте **не может** противоречить детерминированным флагам (лимит, запрет по policy rules engine).
- LLM **не** может изменить числовой `pd_score` (только цитировать/объяснять переданные значения).
