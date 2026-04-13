create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  is_public boolean not null default false,
  share_token_hash text,
  current_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  parent_id uuid references blocks(id) on delete cascade,
  type text not null check (
    type in ('paragraph', 'heading_1', 'heading_2', 'todo', 'code', 'divider', 'image')
  ),
  content_json jsonb not null default '{}'::jsonb,
  order_index numeric(20, 10) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists refresh_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists share_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_updated_at on documents(user_id, updated_at desc);
create index if not exists idx_blocks_document_parent_order on blocks(document_id, parent_id, order_index);
create index if not exists idx_refresh_sessions_user_id on refresh_sessions(user_id);
create index if not exists idx_share_sessions_document_id on share_sessions(document_id);
