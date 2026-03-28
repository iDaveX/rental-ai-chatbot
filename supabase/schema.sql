create extension if not exists pgcrypto;

-- Основной диалог арендатора по конкретному объявлению
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  listing_slug text not null,
  stage text not null default 'greeting',
  signals jsonb not null default '{
    "intent": "general_question",
    "interest_level": 0,
    "has_objection": false,
    "objection_type": "none",
    "urgency": "low",
    "readiness_to_view": 0,
    "sentiment": "neutral"
  }'::jsonb,
  sentiment text not null default 'neutral',
  appointment_booked boolean not null default false,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists conversations_listing_slug_idx
  on conversations(listing_slug);

create index if not exists conversations_last_message_at_idx
  on conversations(last_message_at desc);

-- Все сообщения внутри диалога
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  intent jsonb,
  strategy text,
  response_time_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on messages(conversation_id);

create index if not exists messages_conversation_created_at_idx
  on messages(conversation_id, created_at);

-- Одна строка с настройками админки
create table if not exists settings (
  id integer primary key default 1,
  agent_name text not null default 'Марина',
  tone_preset text not null default '{}',
  constraint settings_single_row check (id = 1)
);

insert into settings (id, agent_name, tone_preset)
values (
  1,
  'Марина',
  '{
    "usacheva-11": "warm",
    "mitino-studio": "friendly",
    "vykhino-1room": "friendly",
    "presnya-3room": "formal",
    "lyublino-1room": "business"
  }'
)
on conflict (id) do nothing;
