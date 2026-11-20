-- Droits d'exécution des fonctions de public.
-- Une fonction ajoutée plus tard sans « revoke » fait échouer ce fichier.
-- Les fonctions d'une extension (pgTAP compris) sont laissées de côté.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

create temporary view fonction_du_projet as
select p.oid, p.oid::regprocedure::text as signature, p.prosecdef, p.proconfig
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  );

select is_empty(
  $$ select signature from fonction_du_projet
     where has_function_privilege('anon', oid, 'execute') $$,
  'Aucune fonction de public n''est exécutable par anon'
);

-- La liste blanche : les fonctions que le navigateur appelle par rpc,
-- et celles qu'une policy ou une contrainte évalue au nom du Créateur.
select set_eq(
  $$ select signature from fonction_du_projet
     where has_function_privilege('authenticated', oid, 'execute') $$,
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
    'segments_texte_valides(jsonb)',
    'contenu_texte_valide(jsonb)',
    'placer_cadre_texte(uuid,numeric,numeric,numeric,numeric)'
  ],
  'authenticated n''exécute que la liste blanche'
);

select is_empty(
  $$ select signature from fonction_du_projet
     where prosecdef and not exists (
       select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%'
     ) $$,
  'Chaque fonction security definer fixe son search_path'
);

select * from finish();
rollback;
