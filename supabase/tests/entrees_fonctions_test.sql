-- Entrées des fonctions security definer : aucune ne fait confiance à ses arguments.
-- Spec : docs/superpowers/specs/2026-11-20-donnees-du-createur-design.md (BK-048)
--
-- Une fonction security definer lit des tables que la RLS protège : si elle oubliait de vérifier
-- l'appartenance de l'identifiant reçu, elle donnerait accès au livre d'un autre. Ce fichier appelle
-- chaque fonction exécutable par authenticated avec : le livre ou la double page de Bob (refus
-- « introuvable », jamais « interdit »), un identifiant inventé, et aucun jeton.
-- Les valeurs hors bornes sont déjà éprouvées ailleurs : fonctions_metier_test (creer_projet,
-- inserer, deplacer, changer_gabarit), composer_livre_test, textes_themes_test (changer_theme),
-- texte_riche_test (placer_cadre_texte). Ce fichier ne refait que les arguments nuls.
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Couverture : toute fonction security definer ouverte à authenticated doit avoir son cas ici.
-- Une fonction ajoutée plus tard fait échouer ce test jusqu'à ce qu'on écrive son cas.
select set_eq(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')
       and not exists (select 1 from pg_depend d
                       where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e') $$,
  array[
    'est_mon_projet(uuid)',
    'creer_projet(text,uuid,uuid[])',
    'inserer_double_page(uuid,uuid,integer)',
    'deplacer_double_page(uuid,integer)',
    'supprimer_double_page(uuid)',
    'dupliquer_double_page(uuid)',
    'composer_livre(uuid,jsonb)',
    'changer_gabarit(uuid,uuid)',
    'changer_theme(uuid,uuid)',
    'placer_cadre_texte(uuid,numeric,numeric,numeric,numeric)',
    'supprimer_mon_compte()',
    'lister_fichiers_orphelins()'
  ],
  'Chaque fonction security definer exécutable par authenticated a son cas dans ce fichier'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{"nom_affichage": "Bob"}');

create temporary table livre (proprietaire text, projet_id uuid);
grant all on livre to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
insert into livre select 'alice', public.creer_projet('Alice', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));
select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
insert into livre select 'bob', public.creer_projet('Bob', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));
reset role;

-- Les ids de Bob, lus hors RLS.
create temporary table cible (livre_id uuid, double_page_id uuid, emplacement_id uuid);
grant all on cible to authenticated;
insert into cible
select b.projet_id,
       (select id from public.double_page where projet_id = b.projet_id and role = 'interieur' limit 1),
       (select id from public.emplacement where projet_id = b.projet_id limit 1)
from livre b where b.proprietaire = 'bob';
-- Une double page à Alice, pour les arguments nuls.
create temporary table sienne (livre_id uuid, double_page_id uuid);
grant all on sienne to authenticated;
insert into sienne
select a.projet_id, (select id from public.double_page where projet_id = a.projet_id and role = 'interieur' limit 1)
from livre a where a.proprietaire = 'alice';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- Le livre, la double page ou l'emplacement de Bob : « introuvable »
-- ---------------------------------------------------------------------------

select throws_ok($$ select public.inserer_double_page((select livre_id from cible), '00000000-0000-4000-b000-000000000003', 1) $$,
  'P0001', 'introuvable', 'inserer_double_page : le livre de Bob est introuvable');
select throws_ok($$ select public.deplacer_double_page((select double_page_id from cible), 1) $$,
  'P0001', 'introuvable', 'deplacer_double_page : la double page de Bob est introuvable');
select throws_ok($$ select public.supprimer_double_page((select double_page_id from cible)) $$,
  'P0001', 'introuvable', 'supprimer_double_page : la double page de Bob est introuvable');
select throws_ok($$ select public.dupliquer_double_page((select double_page_id from cible)) $$,
  'P0001', 'introuvable', 'dupliquer_double_page : la double page de Bob est introuvable');
select throws_ok($$ select public.composer_livre((select livre_id from cible), '[{"gabarit_id": "00000000-0000-4000-b000-000000000003"}]') $$,
  'P0001', 'introuvable', 'composer_livre : le livre de Bob est introuvable');
select throws_ok($$ select public.changer_gabarit((select double_page_id from cible), '00000000-0000-4000-b000-000000000003') $$,
  'P0001', 'introuvable', 'changer_gabarit : la double page de Bob est introuvable');
select throws_ok($$ select public.changer_theme((select livre_id from cible), '00000000-0000-4000-a000-000000000002') $$,
  'P0001', 'introuvable', 'changer_theme : le livre de Bob est introuvable');
select throws_ok($$ select public.placer_cadre_texte((select emplacement_id from cible), 20, 150, 100, 30) $$,
  'P0001', 'introuvable', 'placer_cadre_texte : l''emplacement de Bob est introuvable');
select is(public.est_mon_projet((select livre_id from cible)), false, 'est_mon_projet : le livre de Bob n''est pas à Alice');

-- ---------------------------------------------------------------------------
-- Un identifiant inventé : « introuvable » aussi
-- ---------------------------------------------------------------------------

select throws_ok($$ select public.inserer_double_page(gen_random_uuid(), '00000000-0000-4000-b000-000000000003', 1) $$,
  'P0001', 'introuvable', 'inserer_double_page : un livre inventé est introuvable');
select throws_ok($$ select public.deplacer_double_page(gen_random_uuid(), 1) $$,
  'P0001', 'introuvable', 'deplacer_double_page : une double page inventée est introuvable');
select throws_ok($$ select public.supprimer_double_page(gen_random_uuid()) $$,
  'P0001', 'introuvable', 'supprimer_double_page : une double page inventée est introuvable');
select throws_ok($$ select public.dupliquer_double_page(gen_random_uuid()) $$,
  'P0001', 'introuvable', 'dupliquer_double_page : une double page inventée est introuvable');
select throws_ok($$ select public.composer_livre(gen_random_uuid(), '[{"gabarit_id": "00000000-0000-4000-b000-000000000003"}]') $$,
  'P0001', 'introuvable', 'composer_livre : un livre inventé est introuvable');
select throws_ok($$ select public.changer_gabarit(gen_random_uuid(), '00000000-0000-4000-b000-000000000003') $$,
  'P0001', 'introuvable', 'changer_gabarit : une double page inventée est introuvable');
select throws_ok($$ select public.changer_theme(gen_random_uuid(), '00000000-0000-4000-a000-000000000002') $$,
  'P0001', 'introuvable', 'changer_theme : un livre inventé est introuvable');
select throws_ok($$ select public.placer_cadre_texte(gen_random_uuid(), 20, 150, 100, 30) $$,
  'P0001', 'introuvable', 'placer_cadre_texte : un emplacement inventé est introuvable');
select is(public.est_mon_projet(gen_random_uuid()), false, 'est_mon_projet : un livre inventé n''est pas à Alice');

-- ---------------------------------------------------------------------------
-- Arguments nuls
-- ---------------------------------------------------------------------------

select throws_ok($$ select public.inserer_double_page(null, '00000000-0000-4000-b000-000000000003', 1) $$,
  'P0001', null, 'inserer_double_page : un livre nul est refusé');
select throws_ok($$ select public.deplacer_double_page((select double_page_id from sienne), null) $$,
  'P0001', null, 'deplacer_double_page : une position nulle est refusée');
select throws_ok($$ select public.supprimer_double_page(null) $$,
  'P0001', 'introuvable', 'supprimer_double_page : une double page nulle est introuvable');
select throws_ok($$ select public.composer_livre(null, null) $$,
  'P0001', 'introuvable', 'composer_livre : un livre nul est introuvable');
select throws_ok($$ select public.changer_theme((select livre_id from sienne), null) $$,
  'P0001', null, 'changer_theme : un thème nul est refusé');
select throws_ok($$ select public.creer_projet(null, '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10])) $$,
  'P0001', 'invalide', 'creer_projet : un titre nul est refusé');
select throws_ok($$ select public.creer_projet('Livre', '00000000-0000-4000-d000-000000000001', null) $$,
  'P0001', 'invalide', 'creer_projet : une liste de gabarits nulle est refusée');

-- ---------------------------------------------------------------------------
-- Sans jeton : auth.uid() est nul, toute fonction refuse
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);

select throws_ok($$ select public.creer_projet('Livre', '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10])) $$,
  'P0001', 'introuvable', 'creer_projet : sans jeton, refusé');
select throws_ok($$ select public.inserer_double_page((select livre_id from sienne), '00000000-0000-4000-b000-000000000003', 1) $$,
  'P0001', 'introuvable', 'inserer_double_page : sans jeton, son propre livre est introuvable');
select throws_ok($$ select public.supprimer_double_page((select double_page_id from sienne)) $$,
  'P0001', 'introuvable', 'supprimer_double_page : sans jeton, refusé');
select throws_ok($$ select public.changer_theme((select livre_id from sienne), '00000000-0000-4000-a000-000000000002') $$,
  'P0001', 'introuvable', 'changer_theme : sans jeton, refusé');
select is(public.est_mon_projet((select livre_id from sienne)), false, 'est_mon_projet : sans jeton, faux');
select throws_ok('select public.supprimer_mon_compte()', '42501', null, 'supprimer_mon_compte : sans jeton, refusé');
select throws_ok('select * from public.lister_fichiers_orphelins()', '42501', null, 'lister_fichiers_orphelins : sans jeton, refusé');

reset role;
select is((select count(*) from public.projet where id in (select projet_id from livre)), 2::bigint, 'Aucun appel refusé n''a créé ni supprimé de livre');

select * from finish();
rollback;
