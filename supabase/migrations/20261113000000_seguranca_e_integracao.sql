-- ============================================================================
-- Segurança + integração com o LiveFacilities (RP Smart)
-- Idempotente: pode rodar de novo no SQL Editor sem quebrar nada.
--
-- 1. Papel automático do domínio interno só depois do e-mail CONFIRMADO.
-- 2. Funções auxiliares fora do alcance do papel anônimo.
-- 3. Fotos do Storage visíveis só para quem enxerga o relatório.
-- 4. Relatório publicado não muda no banco (antes só a tela bloqueava).
-- 5. Códigos do LiveFacilities e ficha técnica no cadastro do empreendimento.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Papel 'gestor' para o domínio interno — somente com e-mail confirmado
--
-- Antes o papel era concedido no INSERT em auth.users, quando o e-mail ainda
-- não foi confirmado. Se a confirmação estivesse desligada no painel (o
-- README chegou a sugerir isso), qualquer pessoa se cadastrava como
-- fulano@rpsglobal.com.br e via o financeiro de todos os clientes.
--
-- Agora o papel só sai quando auth.users.email_confirmed_at é preenchido — no
-- cadastro (usuário criado já confirmado pelo painel) ou na confirmação.
--
-- ATENÇÃO: mantenha "Confirm email" LIGADO em Authentication > Providers >
-- Email. Com ele desligado, o Supabase marca todo cadastro como confirmado e a
-- proteção acima perde o efeito.
-- ---------------------------------------------------------------------------
create or replace function public.concede_papel_dominio_interno(_user_id uuid, _email text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  dominio_interno constant text := '@rpsglobal.com.br';
begin
  if lower(coalesce(_email, '')) like '%' || dominio_interno then
    insert into public.user_roles (user_id, role) values (_user_id, 'gestor')
    on conflict (user_id, role) do nothing;
  end if;
end; $$;

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

  if new.email_confirmed_at is not null then
    perform public.concede_papel_dominio_interno(new.id, new.email);
  end if;

  return new;
end; $$;

create or replace function public.handle_user_confirmed()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.concede_papel_dominio_interno(new.id, new.email);
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- A diretoria gerencia papéis pela tela Acessos (mesma policy da migration
-- 20260815010000 — repetida aqui, idempotente, caso aquela não tenha rodado).
drop policy if exists "roles: gestao pela diretoria" on public.user_roles;
create policy "roles: gestao pela diretoria" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'diretoria'))
  with check (public.has_role(auth.uid(), 'diretoria'));

-- Remove o papel de quem recebeu 'gestor' sem nunca ter confirmado o e-mail.
delete from public.user_roles ur
using auth.users u
where ur.user_id = u.id
  and ur.role = 'gestor'
  and u.email_confirmed_at is null;

-- ---------------------------------------------------------------------------
-- 2. Funções auxiliares: o papel anônimo não precisa delas
--
-- A migration inicial deu EXECUTE em todas as funções para `anon`. Com isso,
-- qualquer visitante podia perguntar ao banco "o usuário X é diretoria?".
-- ---------------------------------------------------------------------------
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_interno(uuid) from anon, public;
revoke execute on function public.pode_ver_empreendimento(uuid) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_user_confirmed() from anon, authenticated, public;
revoke execute on function public.concede_papel_dominio_interno(uuid, text) from anon, authenticated, public;

alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- 3. Storage: a foto segue a permissão do relatório (ou do empreendimento)
--
-- Antes: qualquer usuário autenticado lia o bucket inteiro — inclusive quem
-- ainda está "em análise" e o síndico de outro prédio.
--
-- Caminhos usados pela aplicação:
--   <relatorio_id>/<arquivo>              evidências do relatório
--   empreendimento/<empreendimento_id>/…  foto de capa do ativo
-- ---------------------------------------------------------------------------
create or replace function public.pode_ver_foto(_nome text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when (storage.foldername(_nome))[1] = 'empreendimento' then exists (
      select 1 from public.empreendimentos e
      where e.id::text = (storage.foldername(_nome))[2]
        and public.pode_ver_empreendimento(e.id)
    )
    else exists (
      select 1 from public.relatorios r
      where r.id::text = (storage.foldername(_nome))[1]
        and public.pode_ver_empreendimento(r.empreendimento_id)
        and (public.is_interno(auth.uid()) or r.status = 'publicado')
    )
  end
$$;

create or replace function public.pode_gravar_foto(_nome text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_interno(auth.uid()) and case
    when (storage.foldername(_nome))[1] = 'empreendimento' then exists (
      select 1 from public.empreendimentos e
      where e.id::text = (storage.foldername(_nome))[2]
    )
    else exists (
      select 1 from public.relatorios r
      where r.id::text = (storage.foldername(_nome))[1]
        and public.pode_ver_empreendimento(r.empreendimento_id)
    )
  end
$$;

revoke execute on function public.pode_ver_foto(text) from anon, public;
revoke execute on function public.pode_gravar_foto(text) from anon, public;
grant execute on function public.pode_ver_foto(text) to authenticated;
grant execute on function public.pode_gravar_foto(text) to authenticated;

drop policy if exists "fotos: leitura autenticada" on storage.objects;
drop policy if exists "fotos: leitura por relatorio" on storage.objects;
create policy "fotos: leitura por relatorio" on storage.objects
  for select to authenticated
  using (bucket_id = 'relatorio-fotos' and public.pode_ver_foto(name));

drop policy if exists "fotos: upload interno" on storage.objects;
create policy "fotos: upload interno" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'relatorio-fotos' and public.pode_gravar_foto(name));

drop policy if exists "fotos: update interno" on storage.objects;
create policy "fotos: update interno" on storage.objects
  for update to authenticated
  using (bucket_id = 'relatorio-fotos' and public.pode_gravar_foto(name));

drop policy if exists "fotos: delete interno" on storage.objects;
create policy "fotos: delete interno" on storage.objects
  for delete to authenticated
  using (bucket_id = 'relatorio-fotos' and public.pode_gravar_foto(name));

-- ---------------------------------------------------------------------------
-- 4. Relatório publicado é imutável no banco
--
-- A tela já bloqueava a edição, mas qualquer gestor com a chave pública podia
-- alterar o conteúdo publicado direto pela API. Agora:
--   - publicado: só pode mudar o status (reabrir) — o conteúdo fica congelado;
--   - excluir um publicado: só a diretoria.
-- ---------------------------------------------------------------------------
create or replace function public.protege_relatorio_publicado()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'publicado' then
    if new.dados is distinct from old.dados
       or new.indice_executivo is distinct from old.indice_executivo
       or new.competencia is distinct from old.competencia
       or new.empreendimento_id is distinct from old.empreendimento_id then
      raise exception 'Relatório publicado não pode ser alterado. Reabra para edição antes.'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and old.status = 'publicado'
     and not public.has_role(auth.uid(), 'diretoria') then
    raise exception 'Somente a diretoria pode excluir um relatório publicado.'
      using errcode = 'insufficient_privilege';
  end if;

  return coalesce(new, old);
end; $$;

revoke execute on function public.protege_relatorio_publicado() from anon, authenticated, public;

drop trigger if exists trg_relatorios_protege_publicado on public.relatorios;
create trigger trg_relatorios_protege_publicado
  before update or delete on public.relatorios
  for each row execute function public.protege_relatorio_publicado();

-- ---------------------------------------------------------------------------
-- 5. Empreendimento: códigos do LiveFacilities e ficha técnica
--
-- id_empreendimento (número interno) e cd_condominio (4 dígitos no topo do
-- sistema) NÃO são iguais em vários prédios — por isso os dois campos.
-- A ficha (área, torres, vagas, elevadores…) era texto repetido todo mês
-- no PPTX; agora é cadastro do ativo e alimenta o slide "O empreendimento".
-- ---------------------------------------------------------------------------
alter table public.empreendimentos add column if not exists lf_id_empreendimento integer;
alter table public.empreendimentos add column if not exists lf_cd_condominio text;
alter table public.empreendimentos add column if not exists ficha jsonb not null default '{}'::jsonb;
alter table public.empreendimentos add column if not exists foto_path text;

do $$ begin
  alter table public.empreendimentos
    add constraint empreendimentos_lf_cd_condominio_formato
    check (lf_cd_condominio is null or lf_cd_condominio ~ '^[0-9]{1,6}$');
exception when duplicate_object then null; end $$;

create unique index if not exists idx_empreendimentos_lf_id
  on public.empreendimentos (lf_id_empreendimento)
  where lf_id_empreendimento is not null;
