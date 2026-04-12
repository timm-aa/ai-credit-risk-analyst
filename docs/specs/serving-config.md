# Spec: Serving / Config

## Технологии (реализация PoC)

| Слой | Технология |
|------|------------|
| Фреймворк | **Next.js 14** (App Router) |
| Язык | **TypeScript 5** |
| Runtime API | Node.js (Serverless Function на **Vercel** или `next dev` локально) |
| HTTP | Route Handler `app/api/assess/route.ts` |
| LLM / embeddings | **OpenAI** official SDK (`openai` npm package) |
| Валидация JSON | **Zod** (`lib/types.ts`, парсинг ответа LLM) |
| Секреты | Переменные окружения Vercel / `.env` локально (`OPENAI_API_KEY`) |
| Лимит времени serverless | `vercel.json`: `maxDuration` 60 с для API (на плане Hobby у провайдера может действовать меньший лимит) |

## Запуск (PoC)

| Режим | Описание |
|-------|----------|
| Локальный | `npm run dev` — один процесс Next.js |
| Production | `npm run build` + `npm start` или деплой на **Vercel** из Git |

## Конфигурация (переменные окружения)

| Ключ | Назначение |
|------|------------|
| `OPENAI_API_KEY` | Ключ OpenAI API (обязателен для LLM + embeddings) |
| `OPENAI_LLM_MODEL` | Имя чат-модели (по умолчанию `gpt-4o-mini` в `lib/config.ts`) |
| `LLM_MODEL` | Синоним в документации; в коде используется `OPENAI_LLM_MODEL` / дефолт в CONFIG |

Внутренние константы (`retrieverTopK`, таймауты tools) — в `lib/config.ts`.

## Секреты

- Ключи **не** коммитить; в Vercel — **Settings → Environment Variables**.
- Для командной разработки — менеджер секретов или 1Password; не дублировать ключи в чатах.

## Версии моделей

- Зафиксировать в `.env.example` и в деплое **имена** моделей чата и эмбеддингов.
- При смене `text-embedding-3-small` — сбросить кэш эмбеддингов (перезапуск процесса / новый деплой).

## Feature flags (PoC)

| Флаг | Назначение |
|------|------------|
| `RERANKER_ENABLED` | Зарезервировано: вкл/выкл rerank после retrieval (не реализовано в коде) |
| Отсутствие `OPENAI_API_KEY` | Поведение: BM25-only retrieval + шаблонное объяснение без LLM |
