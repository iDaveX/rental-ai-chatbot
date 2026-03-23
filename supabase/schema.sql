-- Объявление
create table listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  address text not null,
  price integer not null,
  description text,
  kb_json jsonb not null default '{}',
  tone_preset text not null default 'friendly',
  agent_name text not null default 'Марина',
  created_at timestamptz default now()
);

-- Разговор (сессия арендатора)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  session_id text not null unique,
  stage text not null default 'greeting',
  signals jsonb not null default '{"interest_level": 0, "has_objection": false, "urgency": "low", "readiness_to_view": 0}',
  sentiment text not null default 'neutral',
  appointment_booked boolean default false,
  started_at timestamptz default now(),
  last_message_at timestamptz default now()
);

-- Сообщения
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  intent jsonb,
  strategy text,
  response_time_ms integer,
  created_at timestamptz default now()
);

create table settings (
  id integer primary key default 1,
  agent_name text not null default 'Марина',
  tone_preset text not null default 'friendly',
  constraint single_row check (id = 1)
);

insert into settings (id, agent_name, tone_preset)
values (1, 'Марина', 'friendly');
