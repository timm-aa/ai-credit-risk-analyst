# Spec: Retriever (policy RAG)

## Технологии (реализация PoC)

| Компонент | Технология |
|-----------|------------|
| Язык | TypeScript (Node.js runtime) |
| Источник текста | Файл `data/policy.md`, чтение через `fs` при старте запроса |
| Чанкинг | Разбиение по заголовкам `##` (`lib/retriever/chunks.ts`) |
| Эмбеддинги | OpenAI API `text-embedding-3-small` (`lib/retriever/retrieve.ts`) |
| Векторный поиск | Косинусное сходство, эмбеддинги чанков кэшируются в `Map` в памяти процесса |
| Fallback | Эвристика по ключевым словам (BM25-подобный счёт без внешних библиотек) |
| Конфигурация | `lib/config.ts`: `RETRIEVER_TOP_K`, порог similarity, модель эмбеддингов |

## Назначение

Поиск релевантных фрагментов **кредитной политики банка** для проверки соответствия и для контекста LLM (с цитированием).

## Источники

| Источник | Формат | Версионирование |
|----------|--------|-----------------|
| Документы политики | Markdown | Поле `policy_version` в метаданных чанка (`policy-v1`) |

## Индекс

- **Chunking:** по секциям `##` (PoC); при необходимости — скользящее окно 512–1024 токенов.
- **Embeddings:** `text-embedding-3-small` (OpenAI).
- **Хранилище:** in-memory `Map<chunk_id, embedding[]>`; персистентная БД в PoC не используется (опционально Supabase pgvector позже).

## Поиск

1. **Query builder** — `buildRetrieverQuery` в `lib/retriever/retrieve.ts`: сумма, флаги, PD.
2. **Vector search:** top-k (`retrieverTopK`), порог `vectorSimilarityThreshold`.
3. **Reranking:** в PoC не подключён (см. `LLMOps`: флаг `RERANKER_ENABLED` в спеке serving).

## Ограничения

- Максимум **top-3** чанков в промпт LLM (`retrieverTopForLlm` в `lib/config.ts`).
- Одна коллекция «policy».

## Выходной контракт

```json
{
  "chunks": [
    {
      "chunk_id": "string",
      "policy_version": "string",
      "title": "string",
      "text": "string",
      "score": 0.0
    }
  ],
  "fallback_used": false,
  "retrieval_mode": "vector | bm25 | empty"
}
```

## Ошибки и fallback

| Условие | Действие |
|---------|----------|
| Пустой vector | BM25 по тем же чанкам |
| Снова пусто | `empty` + флаг в отчёте; правила без RAG-контекста |
