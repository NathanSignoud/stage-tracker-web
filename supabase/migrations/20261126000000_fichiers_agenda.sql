-- Étape 4 : fichiers des documents (CV, lettres) et abonnement agenda.
-- À coller une fois dans Supabase → SQL Editor, puis Run.

-- 1. Fichiers : un espace privé « documents » ; chaque personne n'accède qu'à son dossier (son identifiant).
--    Chemin d'un fichier : <user_id>/<nom aléatoire>-<nom du fichier>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760, -- 10 Mo
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.oasis.opendocument.text',
    'text/markdown',
    'text/plain'
  ]
);

create policy "documents : son dossier seulement"
  on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Abonnement agenda : l'adresse secrète contient un jeton (réglage calendarToken de la personne).
--    Appelée sans connexion (par Outlook, Google, Apple Calendrier) via le serveur du site (worker/calendar.ts) :
--    security definer pour trouver la personne, mais ne renvoie que SES rendez-vous et dates limites,
--    et seulement les colonnes utiles à l'agenda.
create function public.calendar_feed(feed_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with owner as (
    select user_id from public.settings
    where key = 'calendarToken' and value = to_jsonb(feed_token) and length(feed_token) >= 20
    limit 1
  )
  select case when not exists (select 1 from owner) then null else jsonb_build_object(
    'timeZone', (select value #>> '{}' from public.settings
                 where user_id = (select user_id from owner) and key = 'calendarTimeZone' and jsonb_typeof(value) = 'string'),
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'company', a.company, 'title', a.title, 'status', a.status,
                                          'deadline', a.deadline, 'deleted_at', a.deleted_at))
      from public.applications a where a.user_id = (select user_id from owner)), '[]'),
    'interactions', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'application_id', i.application_id, 'contact_id', i.contact_id,
                                          'date', i.date, 'type', i.type, 'interview_kind', i.interview_kind,
                                          'summary', i.summary, 'content', i.content, 'location', i.location,
                                          'duration_minutes', i.duration_minutes, 'updated_at', i.updated_at))
      from public.interactions i
      where i.user_id = (select user_id from owner) and i.deleted_at is null and i.type in ('interview', 'call', 'meeting')), '[]'),
    'contacts', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name))
      from public.contacts c where c.user_id = (select user_id from owner)), '[]')
  ) end
$$;

revoke execute on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
