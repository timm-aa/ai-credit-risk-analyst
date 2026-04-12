# Spec: Agent / Orchestrator

## Технологии (реализация PoC)

| Компонент | Технология |
|-----------|------------|
| Оркестрация | Последовательный async-пайплайн в `lib/agent/orchestrator.ts` (функция `runAssessment`) |
| Точка входа | Next.js **Route Handler** `POST` `app/api/assess/route.ts` |
| Парсинг слотов | `lib/agent/parseSlots.ts` (регулярные выражения + демо-алиасы) |
| Правила | Чистые функции `lib/rules/engine.ts` |
| Guardrails | `lib/guardrails/pre.ts`, `lib/guardrails/post.ts` |
| LLM | `lib/llm/explain.ts` (OpenAI Chat Completions + Zod) |
| Граф как библиотека | LangGraph **не** используется в PoC; эквивалентность шагам — явный код (проще отладка на Vercel) |

## Назначение

Управление **цепочкой шагов**: условные переходы, вызовы tools и LLM, сборка отчёта. Фокус агентского трека: **качество выводов**, **guardrails**, **fallback и согласованность decision с правилами**.

## Шаги (узлы графа)

Порядок в коде `runAssessment`:

1. `guardrail_pre` — домен, длина сообщения, шаблоны injection.
2. `parse_slots` — извлечение `client_id`, `loan_amount` и демо-алиасов.
3. `fetch_credit_history` — вызов tool.
4. `fetch_pd` — вызов tool (или fallback при недоступности кредитной истории).
5. `apply_rules` — детерминированные правила (лимиты, пороги PD, флаги edge cases).
6. `retrieve_policy` — retriever + fallback BM25.
7. `generate_explanation` — LLM (JSON) или шаблон при отсутствии ключа API.
8. `guardrail_post` + инварианты — текст и финальный `decision`.
9. Сборка `RiskReport` с массивом `steps` для UI.

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

- Успех: отчёт собран, post-guardrail применён.
- Частичный успех: отчёт с флагами деградации.
- Жёсткий стоп: критичная ошибка валидации входа (без вызова внешних API).

## Retry / fallback

| Операция | Retry | Fallback |
|----------|-------|----------|
| Credit history | 2× | Флаги + manual_review path |
| PD | 2× | Rule-based оценка + флаг |
| LLM | 1× (укороченный контекст) | Шаблон объяснения по фактам |

## Инварианты

- `decision` в отчёте **не может** противоречить детерминированным флагам (лимит, порог PD).
- LLM **не** может изменить числовой `pd_score` (только цитировать/обяснять переданные значения).
