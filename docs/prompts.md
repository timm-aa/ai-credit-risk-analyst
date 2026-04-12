# Промпты: пример для объяснения риска (LLM)

Ниже — **пример** того, что передаётся в модель при генерации объяснения (без реальных ПДн). Реализация в коде: `lib/llm/explain.ts` (функция `generateExplanation`).

---

## Роли и параметры

- **Temperature:** `0.2` (снижение разброса формулировок).
- **Max tokens:** `1200`.
- **Формат ответа:** JSON-объект (`response_format: json_object`).

---

## System message (шаблон)

```
Ты ассистент риск-аналитика банка. Пишешь объяснение по УЖЕ вычисленным фактам.
ЗАПРЕЩЕНО: менять числовые значения PD, придумывать факты, обещать окончательное одобрение кредита.
Решение (decision) уже зафиксировано правилами: {decision}. Твоя задача — объяснить почему это согласуется с данными.
Используй только переданные факты и фрагменты политики. Отвечай на русском.
```

`{decision}` подставляется из rules engine: `approve` | `reject` | `manual_review`.

---

## User message (шаблон)

```
Запрос пользователя: {userMessage}

Факты (JSON): {facts JSON}

Флаги: {flags через запятую или "нет"}

Фрагменты политики (цитировать по chunk_id):
{для каждого чанка: [chunk_id] title + текст, разделитель ---}

Сформируй JSON: { "explanation": "...", "citations": ["chunk_id", ...] }
```

**Пример заполнения (фрагмент user message):**

```
Запрос пользователя: Оцени клиента 12345 для кредита 500000

Факты (JSON): {"client_id":"12345","loan_amount":500000,"credit":{"has_history":true,"total_debt":100000,"delinquency_count":0,"conflict":false},"pd":{"pd_score":0.06,"risk_grade":"A"},"rules_decision":"approve","policy_compliant":true,"retrieval_mode":"vector"}

Флаги: нет

Фрагменты политики (цитировать по chunk_id):
[policy-chunk-0] Лимиты и суммы
## Лимиты и суммы
Максимальная сумма кредита без решения кредитного комитета: **1 000 000** рублей...
---
[policy-chunk-2] Скоринг и PD
...

Сформируй JSON: { "explanation": "...", "citations": ["chunk_id", ...] }
```

---

## Ожидаемый JSON от модели

```json
{
  "explanation": "Краткое обоснование на русском, согласованное с decision и фактами.",
  "citations": ["policy-chunk-0", "policy-chunk-2"]
}
```

Поле `citations` опционально в Zod; валидация — `ResponseSchema` в `lib/llm/explain.ts`.
