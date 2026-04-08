# Architecture Overview

## Stack & Decision Rationale
- Next.js 14 App Router: один стек для UI, API routes и deploy на Vercel без отдельного backend-сервиса.
- Supabase (PostgreSQL + Realtime-ready infra): простая managed БД для хранения диалогов, сообщений, настроек и метрик без отдельной DevOps-настройки.
- Groq API (`llama-3.3-70b-versatile`) через OpenAI SDK: быстрые ответы и совместимый клиент; OpenAI SDK использован как стабильный интерфейс к Groq endpoint.
- Tailwind CSS: быстрый UI polish и точный контроль над интерфейсом в стилистике крупного классифайда без отдельной дизайн-системы.

## Project Structure
- `app/page.tsx`: главная страница-каталог с карточками объявлений.
- `app/chat/page.tsx`: клиентский чат арендатора с mobile/desktop layout.
- `app/admin/page.tsx`: админка с PIN, метриками, воронкой и AI-саммари.
- `app/api/chat/route.ts`: основной message pipeline для ответа агента.
- `app/api/admin/metrics/route.ts`: агрегированные метрики и funnel по стадиям.
- `app/api/admin/conversations/route.ts`: список диалогов для админки.
- `app/api/admin/settings/route.ts`: чтение и сохранение tone preset.
- `app/api/admin/summary/route.ts`: on-demand AI summary конкретного разговора.
- `app/api/test/route.ts`: технический endpoint для диагностики env и внешних API.
- `data/listings.ts`: structured knowledge base и UI-данные по 5 объявлениям.
- `lib/prompts.ts`: extraction/generation prompts, strategy и stage transitions.
- `lib/types.ts`: общие типы стадий, сигналов и сущностей диалога.
- `lib/supabase.ts`: Supabase client helpers.
- `supabase/schema.sql`: базовая схема таблиц проекта.
- `public/listings/*`: фотографии квартир для главной и карточек чата.

## Data Flow: Single Message Lifecycle
1. Пользователь открывает `/chat?listing=<slug>` и UI выбирает нужный листинг из `data/listings.ts`.
2. При отправке сообщения клиент шлёт `message`, `sessionId` и `listingId` в `POST /api/chat`.
3. API ищет разговор по `session_id`; если его нет, создаёт новый conversation.
4. API загружает последние сообщения разговора и собирает текстовую историю.
5. Входящее сообщение пользователя сохраняется в таблицу `messages`.
6. Первый LLM-вызов (`buildExtractionPrompt`) извлекает intent, sentiment, interest level, readiness to view и objection signals.
7. Оркестрационный слой вычисляет следующую стадию диалога и стратегию ответа.
8. Второй LLM-вызов (`buildGenerationPrompt`) генерирует финальную реплику агента с учётом KB, stage, tone и strategy.
9. Ответ агента сохраняется в `messages`, а `conversations` обновляется по stage, sentiment, signals и booking flags.
10. Клиент получает `reply`, `stage`, `signals`, `responseTime` и дорисовывает сообщение в чате.

## Dialogue State Machine
- `greeting`: первое касание, приветствие и запуск разговора.
- `qualification`: уточнение сроков заезда, состава жильцов и базовых условий.
- `info_exchange`: ответы на конкретные вопросы строго по KB.
- `objection_handling`: обработка сомнений по цене, условиям, животным или локации.
- `soft_nudge`: мягкий перевод заинтересованного пользователя к просмотру.
- `appointment`: согласование времени просмотра.
- `closed`: завершение разговора.

Переходы:
- `appointment_request` переводит сразу в `appointment`.
- `farewell` переводит в `closed`.
- `has_objection = true` переводит в `objection_handling`.
- высокий `readiness_to_view` или высокий `interest_level` после `info_exchange` переводит в `soft_nudge`.
- базовый линейный путь: `greeting -> qualification -> info_exchange`.

## Double LLM Call Pipeline
- Extraction call: дешёвый и более детерминированный вызов с низкой temperature для структурного анализа сообщения.
- Generation call: отдельный вызов для живого ответа в нужном тоне.

Почему два вызова:
- проще контролировать stage transitions и product logic;
- меньше риск, что модель одновременно и анализирует, и отвечает с галлюцинациями;
- аналитические поля можно сохранять в БД и использовать в админке;
- легче дебажить pipeline и улучшать каждый слой отдельно.

## Knowledge Base Architecture
- KB хранится как structured JSON в `data/listings.ts`, отдельно для каждого листинга.
- Это быстрее и надёжнее для MVP, чем RAG/vector DB:
  - объём знаний маленький и заранее известный;
  - нет отдельного retrieval слоя;
  - проще жёстко ограничить факты и снизить галлюцинации;
  - легче управлять различиями между объектами.
- Такая схема хорошо подходит для pilot/demo, где важнее controllability, чем масштаб retrieval.

## Database Schema
- `listings`: исходно предусмотренная таблица объявлений, пока не является source of truth для runtime KB.
- `conversations`: одна строка на диалог; хранит stage, sentiment, appointment state, session id и служебные сигналы.
- `messages`: все входящие и исходящие сообщения, а также intent/strategy/response time metadata.
- `settings`: single-row таблица с глобальными настройками тона агента.

Связи:
- `messages.conversation_id -> conversations.id`
- `conversations` логически связано с текущим UI listing через `listing_slug` и query-параметр `listing`.

## Key Design Decisions
- Structured KB in code instead of DB-first CMS: минимизирует время на MVP и делает ответы контролируемыми.
- Client-side chat shell + server-side orchestration: UI остаётся лёгким, а логика диалога централизована в API.
- Multi-listing через query param `listing`: один чатовый surface обслуживает разные объекты без дублирования кода.
- AI summary on demand: саммари не сохраняется в БД, а генерируется только по запросу админки, что упрощает схему.
- Classified-like UI without fake flows: интерфейс выглядит знакомо пользователю маркетплейса объявлений, но не притворяется функционалом, которого нет.
