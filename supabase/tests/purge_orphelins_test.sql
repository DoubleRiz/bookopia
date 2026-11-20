-- Fichiers orphelins : lister_fichiers_orphelins().
-- Spec : docs/superpowers/specs/2026-11-20-donnees-du-createur-design.md
-- Délai : 24 heures. Le navigateur supprime ensuite les fichiers listés par l'API Storage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

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

-- Clés fixes pour lire les noms de fichiers.
create function pg_temp.cle(n integer) returns text language sql as
  $$ select '00000000-0000-4000-9000-' || lpad(n::text, 12, '0') $$;
create function pg_temp.livre(p text) returns text language sql as
  $$ select projet_id::text from livre where proprietaire = p $$;

-- Alice : une photo référencée (clé 1), un export référencé (clé 11).
insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                          empreinte_fichier, largeur_px, hauteur_px)
values (pg_temp.livre('alice')::uuid, pg_temp.cle(1)::uuid, 'webp', 'a.jpg', repeat('a', 64), 4000, 3000);
insert into public.export (projet_id, cle_stockage) values (pg_temp.livre('alice')::uuid, pg_temp.cle(11)::uuid);

-- Fichiers d'Alice. « vieux » : 48 h ; « récent » : 1 h.
create function pg_temp.fichier(p_bucket text, p_nom text, p_age interval) returns void language sql as
  $$ insert into storage.objects (bucket_id, name, created_at) values (p_bucket, p_nom, now() - p_age) $$;
select pg_temp.fichier('photos',  'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/originaux/' || pg_temp.cle(1) || '.jpg', '48 hours');
select pg_temp.fichier('photos',  'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/vignettes/' || pg_temp.cle(1) || '.webp', '48 hours');
select pg_temp.fichier('photos',  'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/originaux/' || pg_temp.cle(2) || '.jpg', '48 hours');
select pg_temp.fichier('photos',  'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/originaux/' || pg_temp.cle(3) || '.jpg', '1 hour');
select pg_temp.fichier('exports', 'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/' || pg_temp.cle(11) || '.pdf', '48 hours');
select pg_temp.fichier('exports', 'aaaaaaaa-0000-4000-8000-000000000001/' || pg_temp.livre('alice') || '/' || pg_temp.cle(12) || '.pdf', '48 hours');
-- D'un livre supprimé : le dossier du livre n'existe plus en base.
select pg_temp.fichier('photos',  'aaaaaaaa-0000-4000-8000-000000000001/' || gen_random_uuid() || '/originaux/' || pg_temp.cle(5) || '.jpg', '48 hours');
-- Bob : un orphelin ancien, qui ne regarde pas Alice.
select pg_temp.fichier('photos',  'bbbbbbbb-0000-4000-8000-000000000002/' || pg_temp.livre('bob') || '/originaux/' || pg_temp.cle(4) || '.jpg', '48 hours');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select set_eq(
  $$ select bucket_id, regexp_replace(chemin, '^.*/', '') from public.lister_fichiers_orphelins() $$,
  $$ values ('photos', '00000000-0000-4000-9000-000000000002.jpg'),
            ('exports', '00000000-0000-4000-9000-000000000012.pdf'),
            ('photos', '00000000-0000-4000-9000-000000000005.jpg') $$,
  'Seuls les fichiers anciens et sans ligne sont listés, livre supprimé compris'
);

select is_empty(
  $$ select 1 from public.lister_fichiers_orphelins()
     where regexp_replace(chemin, '^.*/', '') in (
       '00000000-0000-4000-9000-000000000001.jpg', '00000000-0000-4000-9000-000000000001.webp',
       '00000000-0000-4000-9000-000000000011.pdf') $$,
  'Un fichier encore référencé, original, vignette ou PDF, n''est jamais listé'
);

select is_empty(
  $$ select 1 from public.lister_fichiers_orphelins()
     where regexp_replace(chemin, '^.*/', '') = '00000000-0000-4000-9000-000000000003.jpg' $$,
  'Un orphelin de moins de 24 heures n''est pas listé : son import peut être en cours'
);

select is_empty(
  $$ select 1 from public.lister_fichiers_orphelins() where chemin like 'bbbbbbbb-%' $$,
  'Les fichiers d''un autre Créateur ne sont jamais listés'
);

select set_config('request.jwt.claims', '', true);
select throws_ok('select * from public.lister_fichiers_orphelins()', '42501', null, 'Sans Créateur connecté, la liste est refusée');

select * from finish();
rollback;
