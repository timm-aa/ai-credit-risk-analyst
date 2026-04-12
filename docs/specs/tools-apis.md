# Spec: Tools / APIs (Credit History, PD)

## Технологии (реализация PoC)

| Аспект | Технология |
|--------|------------|
| Язык | TypeScript |
| Модули | `lib/tools/creditHistory.ts`, `lib/tools/pdModel.ts` |
| Повторные попытки | Цикл retry с backoff в `getCreditHistory`; PD через `withRetry` из `lib/tools/retry.ts` (обёртка `tenacity`-подобная на async) |
| Интеграция | Синхронные async-вызовы из оркестратора; внешнего HTTP в PoC нет — **in-process mock** |
| Будущее | Замена тел функций на `fetch` к реальным REST/gRPC без смены сигнатур |

## Общие требования

- Все вызовы **только** из tool layer оркестратора, не из «сырого» LLM-текста.
- Таймауты и retry настраиваются централизованно (`serving-config.md`, `lib/config.ts`).

---

## Tool: `get_credit_history`

| Поле | Тип | Описание |
|------|-----|----------|
| `client_id` | string | Идентификатор заёмщика |

**Ответ (успех):** агрегаты `has_history`, `total_debt`, `delinquency_count`, `conflict_flag`, `record_count` (в коде — тип `CreditHistoryResult`).

**Семантика:** отсутствие истории и конфликт данных — **не HTTP 404**, а поля в теле (для единой обработки в графе).

| Ошибка | Код | Retry | Side effects |
|--------|-----|-------|--------------|
| Timeout | `TIMEOUT` | 2× с backoff | Нет |
| 5xx | `UPSTREAM_ERROR` | 2× | Нет |
| 4xx клиент | `CLIENT_ERROR` | Нет | Нет |

**Защита:** валидация `client_id` (длина, допустимые символы); отклонение при injection-паттернах в ID.

**Демо-ID:** `no_history`, `conflict`, `timeout_bki` — см. README.

---

## Tool: `call_pd_model`

| Поле | Тип | Описание |
|------|-----|----------|
| `client_id` | string | Идентификатор |
| `loan_amount` | number | Сумма кредита |
| `credit_features` | object? | Агрегаты из credit history (передаёт оркестратор) |

**Ответ (успех):** `{ "pd_score": number, "risk_grade": "A"|"B"|... }` — детерминированный mock в `pdModel.ts`.

| Ошибка | Код | Retry | Side effects |
|--------|-----|-------|--------------|
| Timeout | `TIMEOUT` | 2× | Нет |
| Невалидный ввод | `VALIDATION` | Нет | Нет |

**Защита:** сумма в допустимых пределах; типы строго проверяются до вызова.

**Примечание:** расчёт PD на стороне сервиса — детерминированный; LLM **не** подставляет значение `pd_score`.

**Демо-ID:** `timeout`, `timeout_pd` — симуляция сбоя PD.
