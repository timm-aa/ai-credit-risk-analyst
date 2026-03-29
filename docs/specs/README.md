# Технические спецификации модулей (PoC)

Краткие контракты для реализации. Агентский трек: оркестратор, LLM, retrieval, guardrails.

| Файл | Модуль |
|------|--------|
| [retriever.md](retriever.md) | RAG: источники, индекс, поиск, rerank |
| [tools-apis.md](tools-apis.md) | Credit History, PD: контракты, ошибки, таймауты |
| [memory-context.md](memory-context.md) | Session state, budget, политика памяти |
| [agent-orchestrator.md](agent-orchestrator.md) | Граф, переходы, stop, retry, fallback |
| [serving-config.md](serving-config.md) | Запуск, конфиг, секреты, версии моделей |
| [observability-evals.md](observability-evals.md) | Метрики, логи, трейсы, evals |
