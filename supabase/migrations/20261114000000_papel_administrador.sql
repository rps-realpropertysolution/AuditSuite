-- ============================================================================
-- Papel 'administrador' — acesso total à plataforma
--
-- O administrador passa em QUALQUER verificação de papel (has_role), é time
-- interno (vê e edita todos os empreendimentos) e gerencia acessos como a
-- diretoria. A diferença para a diretoria: só um administrador concede ou
-- revoga o papel de administrador.
--
-- Comparações com 'administrador' usam role::text porque o valor novo do enum
-- não pode ser usado na mesma transação em que é criado.
-- ============================================================================

alter type public.app_role add value if not exists 'administrador';

create or replace function public.is_administrador(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.user_roles
  where user_id = _user_id and role::text = 'administrador'
) $$;

-- Administrador satisfaz toda checagem de papel (diretoria, gestor…).
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.user_roles
  where user_id = _user_id and (role = _role or role::text = 'administrador')
) $$;

create or replace function public.is_interno(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.user_roles
  where user_id = _user_id and role::text in ('diretoria', 'gestor', 'administrador')
) $$;

revoke execute on function public.is_administrador(uuid) from anon, public;
grant execute on function public.is_administrador(uuid) to authenticated;

-- Diretoria gerencia papéis, exceto o de administrador (reservado a ele).
drop policy if exists "roles: gestao pela diretoria" on public.user_roles;
create policy "roles: gestao pela diretoria" on public.user_roles
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'diretoria')
    and (role::text <> 'administrador' or public.is_administrador(auth.uid()))
  )
  with check (
    public.has_role(auth.uid(), 'diretoria')
    and (role::text <> 'administrador' or public.is_administrador(auth.uid()))
  );
