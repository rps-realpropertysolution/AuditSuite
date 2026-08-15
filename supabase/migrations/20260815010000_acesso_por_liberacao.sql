-- ============================================================================
-- Controle de acesso: cadastro não concede mais papel automaticamente
--
-- Antes: todo usuário novo recebia 'gestor', e 'gestor' enxerga TODOS os
-- empreendimentos. Ou seja, qualquer pessoa que descobrisse a URL se cadastrava
-- e via o financeiro de todos os clientes.
--
-- Agora: só e-mail do domínio corporativo recebe 'gestor' automaticamente.
-- Qualquer outro cadastro fica SEM papel — entra na plataforma, mas vê a tela
-- de "acesso em análise" até a administração vincular o empreendimento e
-- conceder o papel de síndico/proprietário.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  -- Domínio interno da RPS. Ajuste aqui se a empresa passar a usar outro.
  dominio_interno constant text := '@rpsglobal.com.br';
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  if lower(new.email) like '%' || dominio_interno then
    insert into public.user_roles (user_id, role) values (new.id, 'gestor')
    on conflict (user_id, role) do nothing;
  end if;
  -- Sem papel para os demais: liberação é ato explícito da administração.

  return new;
end; $$;

-- Remove o papel 'gestor' concedido em massa pelo backfill da migration
-- anterior de quem não é do domínio interno e nunca foi liberado de fato.
delete from public.user_roles ur
using auth.users u
where ur.user_id = u.id
  and ur.role = 'gestor'
  and lower(u.email) not like '%@rpsglobal.com.br';

-- Permite à diretoria conceder e revogar papéis pela própria aplicação.
drop policy if exists "roles: gestao pela diretoria" on public.user_roles;
create policy "roles: gestao pela diretoria" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'diretoria'))
  with check (public.has_role(auth.uid(), 'diretoria'));
