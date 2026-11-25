-- Vérification de l'étape 2 : à coller dans Supabase → SQL Editor, puis Run (après le fichier des tables).
-- Crée deux personnes fictives (A et B), vérifie que chacune ne voit et ne modifie que ses propres données,
-- puis ANNULE tout (rollback) : rien n'est gardé dans ta base.
-- Résultat attendu : une ligne « Tout est bon ». Sinon, un message « ÉCHEC : … » en rouge.
-- (Les tests automatiques du projet exécutent aussi ce fichier : tests/database.test.ts.)

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'verif-a@stage-tracker.invalid'),
  ('00000000-0000-4000-8000-00000000000b', 'verif-b@stage-tracker.invalid');

set local role authenticated;

-- A crée des données en une seule écriture groupée (les {"$ref": n} renvoient à l'id créé par l'opération n).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);
select set_config('verif.ids', public.apply_plan('[
  {"table": "applications", "op": "insert", "values": {"company": "Verif SA", "status": "sent"}},
  {"table": "status_changes", "op": "insert", "values": {"application_id": {"$ref": 0}, "to_status": "sent", "changed_at": "2026-11-25T10:00:00.000Z"}},
  {"table": "tasks", "op": "insert", "values": {"title": "Relancer Verif SA", "application_id": {"$ref": 0}, "origin": "auto_followup"}},
  {"table": "contacts", "op": "insert", "values": {"name": "Camille"}},
  {"table": "application_contacts", "op": "insert", "values": {"application_id": {"$ref": 0}, "contact_id": {"$ref": 3}}},
  {"table": "tags", "op": "insert", "values": {"name": "IA"}},
  {"table": "application_tags", "op": "insert", "values": {"application_id": {"$ref": 0}, "tag_id": {"$ref": 5}}},
  {"table": "keywords", "op": "insert", "values": {"label": "Python", "aliases": ["py"], "mine": true}},
  {"table": "settings", "op": "insert", "values": {"key": "weeklyGoal", "value": 5}}
]')::text, true);

do $$
declare
  ids constant jsonb := current_setting('verif.ids')::jsonb;
  app constant bigint := (ids ->> 0)::bigint;
  task constant bigint := (ids ->> 2)::bigint;
  refused boolean;
begin
  if (select count(*) from public.applications) <> 1
     or (select count(*) from public.application_contacts where application_id = app) <> 1
     or (select count(*) from public.application_tags where application_id = app) <> 1
     or (select aliases from public.keywords) <> '["py"]'
     or (select value from public.settings where key = 'weeklyGoal') <> '5' then
    raise exception 'ÉCHEC : A ne retrouve pas ce qu''il vient de créer';
  end if;
  if (select user_id from public.applications where id = app) <> '00000000-0000-4000-8000-00000000000a' then
    raise exception 'ÉCHEC : user_id n''est pas rempli avec la personne connectée';
  end if;

  -- Modifier et supprimer d'un bloc.
  perform public.apply_plan(jsonb_build_array(
    jsonb_build_object('table', 'applications', 'op', 'update', 'values', '{"status": "followed_up"}'::jsonb, 'match', jsonb_build_object('id', app)),
    jsonb_build_object('table', 'tasks', 'op', 'update', 'values', '{"done_at": "2026-11-25T11:00:00.000Z", "title": "Relancé"}'::jsonb, 'match', jsonb_build_object('id', jsonb_build_array(task))),
    jsonb_build_object('table', 'application_tags', 'op', 'delete', 'match', jsonb_build_object('application_id', app))
  ));
  if (select status from public.applications where id = app) <> 'followed_up'
     or (select done_at from public.tasks where id = task) is null
     or exists (select 1 from public.application_tags) then
    raise exception 'ÉCHEC : la modification groupée n''a pas été appliquée';
  end if;

  -- Tout ou rien : la 2e écriture est invalide, la 1re ne doit pas rester.
  refused := false;
  begin
    perform public.apply_plan('[
      {"table": "applications", "op": "insert", "values": {"company": "Doit disparaître"}},
      {"table": "applications", "op": "insert", "values": {"company": "Statut inconnu", "status": "n_importe_quoi"}}
    ]');
  exception when check_violation then refused := true;
  end;
  if not refused or exists (select 1 from public.applications where company = 'Doit disparaître') then
    raise exception 'ÉCHEC : une écriture groupée invalide a été gardée à moitié';
  end if;

  -- apply_plan n'écrit que dans les tables de l'app.
  refused := false;
  begin
    perform public.apply_plan('[{"table": "invitations", "op": "insert", "values": {"email": "intrus@example.com", "is_admin": true}}]');
  exception when raise_exception then refused := true;
  end;
  if not refused then raise exception 'ÉCHEC : apply_plan a accepté une table hors de l''app'; end if;
end;
$$;

-- B ne voit rien de A, ne peut rien modifier ni s'y relier.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}', true);

do $$
declare
  ids constant jsonb := current_setting('verif.ids')::jsonb;
  app constant bigint := (ids ->> 0)::bigint;
  contact constant bigint := (ids ->> 3)::bigint;
  t text;
  n bigint;
  refused boolean;
begin
  foreach t in array array[
    'applications', 'status_changes', 'tags', 'application_tags', 'contacts', 'application_contacts',
    'interactions', 'documents', 'application_documents', 'tasks', 'keywords', 'templates',
    'interview_preps', 'prep_questions', 'companies', 'settings'
  ] loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'ÉCHEC : B voit % ligne(s) de A dans la table %', n, t; end if;
  end loop;

  update public.applications set company = 'Piraté' where id = app;
  delete from public.contacts where id = contact;
  perform public.apply_plan(jsonb_build_array(
    jsonb_build_object('table', 'applications', 'op', 'delete', 'match', jsonb_build_object('id', app))
  ));

  refused := false;
  begin
    insert into public.tasks (title, application_id) values ('Intrus', app);
  exception when foreign_key_violation then refused := true;
  end;
  if not refused then raise exception 'ÉCHEC : B a pu relier une tâche à la candidature de A'; end if;

  refused := false;
  begin
    insert into public.applications (company) values ('Ma candidature');
    insert into public.application_contacts (application_id, contact_id)
      values ((select id from public.applications where company = 'Ma candidature'), contact);
  exception when foreign_key_violation then refused := true;
  end;
  if not refused then raise exception 'ÉCHEC : B a pu relier sa candidature au contact de A'; end if;

  refused := false;
  begin
    insert into public.applications (company, user_id) values ('Usurpation', '00000000-0000-4000-8000-00000000000a');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'ÉCHEC : B a pu créer une ligne au nom de A'; end if;
end;
$$;

-- Les données de A sont intactes.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}', true);

do $$
begin
  if not exists (select 1 from public.applications where company = 'Verif SA')
     or not exists (select 1 from public.contacts where name = 'Camille') then
    raise exception 'ÉCHEC : B a modifié ou supprimé les données de A';
  end if;
end;
$$;

-- Un visiteur non connecté ne lit rien et ne peut pas utiliser apply_plan.
set local role anon;
select set_config('request.jwt.claims', '', true);

do $$
declare
  n bigint := 0;
  refused boolean := false;
begin
  begin
    select count(*) into n from public.applications;
  exception when insufficient_privilege then null;
  end;
  if n > 0 then raise exception 'ÉCHEC : un visiteur non connecté voit des candidatures'; end if;

  begin
    perform public.apply_plan('[]');
  exception when insufficient_privilege then refused := true;
  end;
  if not refused then raise exception 'ÉCHEC : un visiteur non connecté peut utiliser apply_plan'; end if;
end;
$$;

rollback;

select 'Tout est bon : chaque personne ne voit et ne modifie que ses propres données (test annulé, rien n''a été gardé).' as resultat;
