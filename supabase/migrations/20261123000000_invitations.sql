-- Étape 1 : site sur invitation.
-- Seules les adresses de cette liste peuvent créer un compte (Google ou lien par email).
-- À coller une fois dans Supabase → SQL Editor (en remplaçant l'adresse du premier administrateur en bas).

create table public.invitations (
  email text primary key check (email = lower(email)),
  is_admin boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;
-- Ce projet ne donne aucun accès par défaut aux nouvelles tables : on l'accorde, les règles ci-dessous filtrent ensuite.
grant select, insert, delete on public.invitations to authenticated;

-- Vrai si la personne connectée est administratrice (security definer : lit la table sans passer par les règles).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitations
    where email = lower(auth.jwt() ->> 'email') and is_admin
  );
$$;

create policy "voir sa propre invitation, ou toutes si admin"
  on public.invitations for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') or public.is_admin());

create policy "admin : inviter"
  on public.invitations for insert to authenticated
  with check (public.is_admin());

-- Un admin ne peut pas se retirer lui-même (sinon plus personne ne peut inviter).
create policy "admin : retirer une invitation"
  on public.invitations for delete to authenticated
  using (public.is_admin() and email <> lower(auth.jwt() ->> 'email'));

-- Hook « Before User Created » : appelé par Supabase avant toute création de compte.
-- À activer dans Authentication → Hooks → Before User Created → fonction public.hook_before_user_created.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.invitations where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Cette adresse n''est pas invitée sur Stage Tracker. Demande une invitation à la personne qui t''a envoyé le lien.'
  ));
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;

-- Premier administrateur : REMPLACE par l'adresse avec laquelle tu te connectes (ton compte Google).
insert into public.invitations (email, is_admin) values (lower('ton.adresse@gmail.com'), true);
