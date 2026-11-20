-- Suppression du compte : supprimer_mon_compte().
-- Spec : docs/superpowers/specs/2026-11-20-donnees-du-createur-design.md
-- Un fichier de Storage ne se supprime pas en SQL (voir la spec) : la fonction refuse tant qu'il en
-- reste au nom du Créateur. Ces tests prouvent la base et les lignes de Storage ; l'absence des octets
-- sur le disque se vérifie à la main (essai décrit dans la spec).
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{"nom_affichage": "Bob"}');

create temporary table livre (proprietaire text, projet_id uuid);
grant all on livre to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
insert into livre
select 'alice', public.creer_projet('Le livre d''Alice', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
insert into livre
select 'bob', public.creer_projet('Le livre de Bob', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));
reset role;

-- Une photo et un export pour chaque livre, et des fichiers pour chacun.
insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                          empreinte_fichier, largeur_px, hauteur_px)
select projet_id, gen_random_uuid(), 'webp', 'a.jpg', repeat('a', 64), 4000, 3000 from livre;
insert into public.export (projet_id, cle_stockage) select projet_id, gen_random_uuid() from livre;

insert into storage.objects (bucket_id, name)
select 'photos', case proprietaire when 'alice' then 'aaaaaaaa-0000-4000-8000-000000000001/'
                                   else 'bbbbbbbb-0000-4000-8000-000000000002/' end
                 || projet_id || '/originaux/' || gen_random_uuid() || '.jpg'
from livre
union all
select 'exports', case proprietaire when 'alice' then 'aaaaaaaa-0000-4000-8000-000000000001/'
                                    else 'bbbbbbbb-0000-4000-8000-000000000002/' end
                 || projet_id || '/' || gen_random_uuid() || '.pdf'
from livre;

-- Sans jeton : refusé.
set local role authenticated;
select set_config('request.jwt.claims', '', true);
select throws_ok('select public.supprimer_mon_compte()', '42501', null, 'Sans Créateur connecté, la suppression est refusée');
reset role;
select is((select count(*) from auth.users where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')), 2::bigint,
  'Aucun compte n''a été supprimé sans jeton');

-- Un visiteur (anon) n'a pas le droit d'exécuter la fonction : le droit lui-même est vérifié,
-- un appel sans jeton lèverait 42501 même si le droit était ouvert.
select is(
  has_function_privilege('anon', 'public.supprimer_mon_compte()', 'execute'),
  false,
  'Un visiteur n''a pas le droit d''exécuter la fonction'
);

-- Alice a encore des fichiers : refusé, et rien n'est supprimé.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok('select public.supprimer_mon_compte()', 'P0001', 'fichiers', 'Refusé tant qu''il reste des fichiers');
reset role;
select is((select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint,
  'Le refus laisse le compte en place');
select is((select count(*) from public.projet where id in (select projet_id from livre)), 2::bigint,
  'Le refus laisse les livres en place');

-- Un seul bucket vidé ne suffit pas : l'autre bloque encore.
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'photos' and name like 'aaaaaaaa-0000-4000-8000-000000000001/%';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select throws_ok('select public.supprimer_mon_compte()', 'P0001', 'fichiers', 'Un fichier restant dans exports bloque aussi');
reset role;

-- Les fichiers de Bob ne gênent pas Alice : on vide ceux d'Alice seulement.
delete from storage.objects where name like 'aaaaaaaa-0000-4000-8000-000000000001/%';
select is((select count(*) from storage.objects where name like 'bbbbbbbb-%'), 2::bigint,
  'Les fichiers de Bob sont toujours là');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
select lives_ok('select public.supprimer_mon_compte()', 'Sans fichier, le compte se supprime');
reset role;

select is_empty(
  $$ select 1 from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'La ligne auth.users d''Alice a disparu');
select is_empty(
  $$ select 1 from public.utilisateur where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'Sa ligne utilisateur a disparu');
select is_empty(
  $$ select 1 from public.projet where utilisateur_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  'Ses livres ont disparu');
select is_empty(
  $$ select 1 from public.double_page where projet_id = (select projet_id from livre where proprietaire = 'alice')
     union all select 1 from public.emplacement where projet_id = (select projet_id from livre where proprietaire = 'alice')
     union all select 1 from public.photo where projet_id = (select projet_id from livre where proprietaire = 'alice')
     union all select 1 from public.export where projet_id = (select projet_id from livre where proprietaire = 'alice') $$,
  'Le contenu de ses livres a disparu : doubles pages, emplacements, photos, export');
select is_empty(
  $$ select 1 from storage.objects where name like 'aaaaaaaa-0000-4000-8000-000000000001/%' $$,
  'Il ne reste aucune ligne Storage à son nom');

-- Bob est intact.
select is(
  (select count(*) from public.utilisateur where id = 'bbbbbbbb-0000-4000-8000-000000000002')
  + (select count(*) from public.projet where utilisateur_id = 'bbbbbbbb-0000-4000-8000-000000000002')
  + (select count(*) from public.photo where projet_id = (select projet_id from livre where proprietaire = 'bob'))
  + (select count(*) from public.export where projet_id = (select projet_id from livre where proprietaire = 'bob')),
  4::bigint,
  'Le compte, le livre, la photo et l''export de Bob sont intacts');

select * from finish();
rollback;
