-- ============================================================================
-- RGM RPS Insights — schema completo
-- Rodar UMA VEZ no SQL Editor do Supabase. É idempotente: pode rodar de novo.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('diretoria', 'gestor', 'sindico', 'proprietario');
exception when duplicate_object then null; end $$;

-- Projetos antigos podem ter o enum sem os valores novos.
do $$ begin alter type public.app_role add value if not exists 'proprietario'; exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nome       text,
  cargo      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- SECURITY DEFINER evita recursão infinita de RLS ao checar papel dentro de policy
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- "Time interno da RPS": enxerga todos os empreendimentos
create or replace function public.is_interno(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.user_roles
  where user_id = _user_id and role in ('diretoria', 'gestor')
) $$;

-- Novo usuário -> profile + papel padrão 'gestor'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'gestor')
  on conflict (user_id, role) do nothing;

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Empreendimentos
-- ---------------------------------------------------------------------------
create table if not exists public.empreendimentos (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  endereco          text,
  cidade            text,
  tipo              text not null default 'comercial',
  unidades          integer,
  area_total        numeric,
  sindico_nome      text,
  proprietario_nome text,
  gestor_nome       text,
  ativo             boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.empreendimentos enable row level security;

drop trigger if exists trg_empreendimentos_updated on public.empreendimentos;
create trigger trg_empreendimentos_updated before update on public.empreendimentos
  for each row execute function public.touch_updated_at();

-- Vínculo de clientes externos (síndico / proprietário) com o ativo
create table if not exists public.empreendimento_acessos (
  id                uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references public.empreendimentos(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (empreendimento_id, user_id)
);
alter table public.empreendimento_acessos enable row level security;

create or replace function public.pode_ver_empreendimento(_emp uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_interno(auth.uid())
      or exists (
        select 1 from public.empreendimento_acessos
        where empreendimento_id = _emp and user_id = auth.uid()
      )
$$;

-- ---------------------------------------------------------------------------
-- Relatórios (um por empreendimento/mês). O corpo vive em JSONB.
-- ---------------------------------------------------------------------------
create table if not exists public.relatorios (
  id                uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references public.empreendimentos(id) on delete cascade,
  competencia       date not null,           -- sempre o dia 1 do mês de referência
  status            text not null default 'rascunho'
                    check (status in ('rascunho', 'revisao', 'publicado')),
  dados             jsonb not null default '{}'::jsonb,
  indice_executivo  numeric,
  publicado_em      timestamptz,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (empreendimento_id, competencia)
);
alter table public.relatorios enable row level security;

create index if not exists idx_relatorios_emp_comp
  on public.relatorios (empreendimento_id, competencia desc);

drop trigger if exists trg_relatorios_updated on public.relatorios;
create trigger trg_relatorios_updated before update on public.relatorios
  for each row execute function public.touch_updated_at();

-- Trava a competência no primeiro dia do mês (garante 1 relatório por mês)
create or replace function public.normaliza_competencia()
returns trigger language plpgsql as $$
begin new.competencia = date_trunc('month', new.competencia)::date; return new; end; $$;

drop trigger if exists trg_relatorios_competencia on public.relatorios;
create trigger trg_relatorios_competencia before insert or update on public.relatorios
  for each row execute function public.normaliza_competencia();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: leitura propria" on public.profiles;
create policy "profiles: leitura propria" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_interno(auth.uid()));

drop policy if exists "profiles: update proprio" on public.profiles;
create policy "profiles: update proprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "roles: leitura propria" on public.user_roles;
create policy "roles: leitura propria" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_interno(auth.uid()));

drop policy if exists "emp: leitura" on public.empreendimentos;
create policy "emp: leitura" on public.empreendimentos
  for select to authenticated using (public.pode_ver_empreendimento(id));

drop policy if exists "emp: escrita interna" on public.empreendimentos;
create policy "emp: escrita interna" on public.empreendimentos
  for all to authenticated
  using (public.is_interno(auth.uid()))
  with check (public.is_interno(auth.uid()));

drop policy if exists "acessos: leitura" on public.empreendimento_acessos;
create policy "acessos: leitura" on public.empreendimento_acessos
  for select to authenticated
  using (user_id = auth.uid() or public.is_interno(auth.uid()));

drop policy if exists "acessos: escrita interna" on public.empreendimento_acessos;
create policy "acessos: escrita interna" on public.empreendimento_acessos
  for all to authenticated
  using (public.is_interno(auth.uid()))
  with check (public.is_interno(auth.uid()));

-- Interno enxerga rascunho; cliente externo só o que foi publicado.
drop policy if exists "relatorios: leitura" on public.relatorios;
create policy "relatorios: leitura" on public.relatorios
  for select to authenticated using (
    public.pode_ver_empreendimento(empreendimento_id)
    and (public.is_interno(auth.uid()) or status = 'publicado')
  );

drop policy if exists "relatorios: escrita interna" on public.relatorios;
create policy "relatorios: escrita interna" on public.relatorios
  for all to authenticated
  using (public.is_interno(auth.uid()) and public.pode_ver_empreendimento(empreendimento_id))
  with check (public.is_interno(auth.uid()) and public.pode_ver_empreendimento(empreendimento_id));

-- ---------------------------------------------------------------------------
-- Storage: evidências fotográficas (bucket privado, acesso por URL assinada)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatorio-fotos', 'relatorio-fotos', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: leitura autenticada" on storage.objects;
create policy "fotos: leitura autenticada" on storage.objects
  for select to authenticated using (bucket_id = 'relatorio-fotos');

drop policy if exists "fotos: upload interno" on storage.objects;
create policy "fotos: upload interno" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'relatorio-fotos' and public.is_interno(auth.uid()));

drop policy if exists "fotos: update interno" on storage.objects;
create policy "fotos: update interno" on storage.objects
  for update to authenticated using (bucket_id = 'relatorio-fotos' and public.is_interno(auth.uid()));

drop policy if exists "fotos: delete interno" on storage.objects;
create policy "fotos: delete interno" on storage.objects
  for delete to authenticated using (bucket_id = 'relatorio-fotos' and public.is_interno(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants. A segurança de fato é a RLS acima; sem estes grants o PostgREST
-- responde 401 mesmo com a chave pública correta.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: usuários que já existiam antes deste schema
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, nome)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'gestor' from auth.users
on conflict (user_id, role) do nothing;
