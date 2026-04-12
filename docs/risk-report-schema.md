# JSON Schema: RiskReport

Ответ API `POST /api/assess` и логический контракт отчёта. В коде дублируется проверка через **Zod** (`RiskReportSchema` в `lib/types.ts`); ниже — эквивалент в **JSON Schema Draft 2020-12** для документации и интеграций.

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/risk-report.json",
  "title": "RiskReport",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "client_id",
    "loan_amount",
    "decision",
    "pd_score",
    "risk_grade",
    "explanation",
    "policy_summary",
    "recommendations",
    "flags",
    "steps"
  ],
  "properties": {
    "client_id": {
      "type": "string",
      "description": "Идентификатор заёмщика в рамках PoC (mock или введённый слот)."
    },
    "loan_amount": {
      "type": "number",
      "description": "Запрошенная сумма кредита в условных единицах."
    },
    "decision": {
      "type": "string",
      "enum": ["approve", "reject", "manual_review"],
      "description": "Итоговая рекомендация по правилам и инвариантам; не из свободного текста LLM."
    },
    "pd_score": {
      "type": ["number", "null"],
      "description": "Вероятность дефолта от PD-сервиса или null при недоступности."
    },
    "risk_grade": {
      "type": ["string", "null"],
      "description": "Буквенная оценка риска (A–E) или null."
    },
    "explanation": {
      "type": "string",
      "description": "Текстовое объяснение; при LLM — из поля explanation JSON, иначе шаблон."
    },
    "policy_summary": {
      "type": "string",
      "description": "Краткий вывод по кредитной политике (rules engine)."
    },
    "recommendations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Следующие шаги для аналитика."
    },
    "flags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Служебные флаги: thin_file, limit_exceeded, llm_degraded и т.д."
    },
    "citations": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Идентификаторы чанков политики из ответа LLM (опционально)."
    },
    "steps": {
      "type": "array",
      "description": "Шаги пайплайна для наблюдаемости.",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "status"],
        "properties": {
          "name": { "type": "string" },
          "status": { "type": "string", "enum": ["ok", "degraded", "error"] },
          "detail": { "type": "string" }
        }
      }
    },
    "llm_degraded": {
      "type": "boolean",
      "description": "Использовался шаблонный объяснение вместо LLM."
    }
  }
}
```

---

## Соответствие коду

| Поле | Обязательность в Zod |
|------|----------------------|
| `citations` | optional |
| `llm_degraded` | optional |
| остальные из `required` выше | required |

При изменении схемы — обновить `lib/types.ts` и этот документ.
