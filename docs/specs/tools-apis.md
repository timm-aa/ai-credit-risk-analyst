# Spec: Tools / APIs (Credit History, PD)

## Общие требования

- Все вызовы **только** из tool layer оркестратора, не из «сырого» LLM-текста.
- Таймауты и retry настраиваются централизованно (`serving-config.md`).

---

## Tool: `get_credit_history`

| Поле | Тип | Описание |
|------|-----|----------|
| `client_id` | string | Идентификатор заёмщика |

**Ответ (успех):** `{ "has_history": bool, "records": [...], "total_debt": number, "delinquency_count": int, "conflict_flag": bool? }`  
**Семантика:** отсутствие истории и конфликт данных — **не HTTP 404**, а поля в теле (для единой обработки в графе).

| Ошибка | Код | Retry | Side effects |
|--------|-----|-------|--------------|
| Timeout | `TIMEOUT` | 2× с backoff | Нет |
| 5xx | `UPSTREAM_ERROR` | 2× | Нет |
| 4xx клиент | `CLIENT_ERROR` | Нет | Нет |

**Защита:** валидация `client_id` (длина, допустимые символы); отклонение при injection-паттернах в ID.

---

## Tool: `call_pd_model`

| Поле | Тип | Описание |
|------|-----|----------|
| `client_id` | string | Идентификатор |
| `loan_amount` | number | Сумма кредита |
| `credit_features` | object? | Агрегаты из credit history (передаёт оркестратор) |

**Ответ (успех):** `{ "pd_score": number, "risk_grade": "A"|"B"|... }`

| Ошибка | Код | Retry | Side effects |
|--------|-----|-------|--------------|
| Timeout | `TIMEOUT` | 2× | Нет |
| Невалидный ввод | `VALIDATION` | Нет | Нет |

**Защита:** сумма в допустимых пределах; типы строго проверяются до вызова.

**Примечание:** расчёт PD на стороне сервиса — детерминированный; LLM **не** подставляет значение `pd_score`.
