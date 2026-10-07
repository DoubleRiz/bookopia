-- Autorisations : deux Créateurs, Alice et Bob, et un visiteur.
-- Chacun ne voit et ne modifie que ses livres ; le navigateur n'écrit que ce qui lui est accordé.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Mise en place, en superutilisateur
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{}');

select is(
  (select array_agg(nom_affichage order by nom_affichage) from public.utilisateur
   where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002')),
  array['Alice', 'bob'],
  'L''inscription crée la ligne utilisateur, nom tiré des métadonnées ou de l''email'
);

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'La RLS est activée sur toutes les tables de public'
);

-- Un livre chacun, créé par la fonction, au nom de son propriétaire.
create temporary table livre (proprietaire text primary key, projet_id uuid, photo_id uuid);
grant all on livre to authenticated, anon;

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);
insert into livre (proprietaire, projet_id)
select 'alice', public.creer_projet('Le livre d''Alice', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
insert into livre (proprietaire, projet_id)
select 'bob', public.creer_projet('Le livre de Bob', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));

-- Bob ajoute une photo à son livre.
insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                          empreinte_fichier, largeur_px, hauteur_px)
select projet_id, gen_random_uuid(), 'webp', 'bob.jpg', repeat('b', 64), 4000, 3000
from livre where proprietaire = 'bob';
update livre set photo_id = (select id from public.photo where nom_fichier_origine = 'bob.jpg')
where proprietaire = 'bob';

-- ---------------------------------------------------------------------------
-- Alice
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

select results_eq(
  'select titre from public.projet',
  array['Le livre d''Alice'],
  'Alice ne voit que son livre'
);

select is(
  (select count(*) from public.utilisateur),
  1::bigint,
  'Alice ne voit que sa ligne utilisateur'
);

select is(
  (select count(*) from public.double_page where projet_id = (select projet_id from livre where proprietaire = 'bob')),
  0::bigint,
  'Alice ne voit pas les doubles pages de Bob'
);

select is(
  (select count(*) from public.emplacement where projet_id = (select projet_id from livre where proprietaire = 'bob')),
  0::bigint,
  'Alice ne voit pas les emplacements de Bob'
);

select is(
  (select count(*) from public.photo),
  0::bigint,
  'Alice ne voit pas les photos de Bob'
);

select is_empty(
  $$ update public.projet set titre = 'Volé' where id = (select projet_id from livre where proprietaire = 'bob') returning id $$,
  'Alice ne renomme pas le livre de Bob'
);

select is_empty(
  $$ delete from public.projet where id = (select projet_id from livre where proprietaire = 'bob') returning id $$,
  'Alice ne supprime pas le livre de Bob'
);

select is_empty(
  $$ delete from public.photo where id = (select photo_id from livre where proprietaire = 'bob') returning id $$,
  'Alice ne supprime pas la photo de Bob'
);

select lives_ok(
  $$ update public.projet set titre = 'Vacances', brouillon = false where id = (select projet_id from livre where proprietaire = 'alice') $$,
  'Alice renomme son livre et change son intention'
);

select throws_ok(
  $$ update public.projet set utilisateur_id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  '42501', null,
  'Alice ne rattache pas son livre à quelqu''un d''autre'
);

select throws_ok(
  $$ insert into public.projet (utilisateur_id, titre, theme_id)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'Sans couverture', '00000000-0000-4000-a000-000000000001') $$,
  '42501', null,
  'Un projet ne se crée que par creer_projet'
);

select throws_ok(
  $$ insert into public.double_page (projet_id, role, position)
     select projet_id, 'interieur', 11 from livre where proprietaire = 'alice' $$,
  '42501', null,
  'Le navigateur n''écrit jamais dans double_page'
);

select throws_ok(
  $$ update public.emplacement set largeur = 1 $$,
  '42501', null,
  'La géométrie d''un emplacement ne se modifie pas'
);

select lives_ok(
  $$ update public.emplacement set contenu_texte = 'Été 2026'
     where nature = 'texte' and projet_id = (select projet_id from livre where proprietaire = 'alice') $$,
  'Alice écrit dans les emplacements texte de son livre'
);

select throws_ok(
  $$ insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                               empreinte_fichier, largeur_px, hauteur_px)
     select projet_id, gen_random_uuid(), 'webp', 'intrus.jpg', repeat('c', 64), 10, 10
     from livre where proprietaire = 'bob' $$,
  '42501', null,
  'Alice n''ajoute pas de photo au livre de Bob'
);

select lives_ok(
  $$ insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                               empreinte_fichier, largeur_px, hauteur_px)
     select projet_id, gen_random_uuid(), 'jpeg', 'alice.jpg', repeat('a', 64), 4000, 3000
     from livre where proprietaire = 'alice' $$,
  'Alice ajoute une photo à son livre'
);

select throws_ok(
  $$ update public.emplacement
     set photo_id = (select photo_id from livre where proprietaire = 'bob'),
         cadrage_x = 0.5, cadrage_y = 0.5, cadrage_zoom = 1
     where id = (select id from public.emplacement where nature = 'photo' limit 1) $$,
  '23503', null,
  'Alice ne pose pas dans son livre une photo de Bob'
);

select lives_ok(
  $$ insert into public.export (projet_id, cle_stockage)
     select projet_id, gen_random_uuid() from livre where proprietaire = 'alice'
     on conflict (projet_id) do update set projet_id = excluded.projet_id, cle_stockage = excluded.cle_stockage $$,
  'Alice enregistre l''export de son livre'
);

select lives_ok(
  $$ insert into public.export (projet_id, cle_stockage)
     select projet_id, gen_random_uuid() from livre where proprietaire = 'alice'
     on conflict (projet_id) do update set projet_id = excluded.projet_id, cle_stockage = excluded.cle_stockage $$,
  'Alice remplace l''export de son livre'
);

select throws_ok(
  $$ select public.inserer_double_page((select projet_id from livre where proprietaire = 'bob'),
                                       '00000000-0000-4000-b000-000000000001', 1) $$,
  'P0001', 'introuvable',
  'Le livre de Bob est introuvable pour les fonctions d''Alice'
);

select throws_ok(
  $$ select public.creer_double_page((select projet_id from livre where proprietaire = 'alice'),
                                     'interieur', '00000000-0000-4000-b000-000000000001', 1) $$,
  '42501', null,
  'Les outils internes ne sont pas appelables par rpc'
);

-- Fichiers
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos', 'aaaaaaaa-0000-4000-8000-000000000001/projet/originaux/une.jpg') $$,
  'Alice dépose un fichier dans son dossier'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos', 'bbbbbbbb-0000-4000-8000-000000000002/projet/originaux/intrus.jpg') $$,
  '42501', null,
  'Alice ne dépose rien dans le dossier de Bob'
);

-- ---------------------------------------------------------------------------
-- Bob
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);

select results_eq(
  'select titre from public.projet',
  array['Le livre de Bob'],
  'Bob ne voit que son livre, intact'
);

select is(
  (select count(*) from public.export),
  0::bigint,
  'Bob ne voit pas l''export d''Alice'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'photos'),
  0::bigint,
  'Bob ne voit pas les fichiers d''Alice'
);

-- ---------------------------------------------------------------------------
-- Visiteur
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is(
  (select count(*) from public.modele_livre),
  3::bigint,
  'Le visiteur voit les modèles de livre'
);

select throws_ok(
  'select count(*) from public.projet',
  '42501', null,
  'Le visiteur ne lit aucun livre'
);

select throws_ok(
  'select count(*) from public.gabarit',
  '42501', null,
  'Le visiteur ne lit pas les gabarits'
);

select throws_ok(
  $$ select public.creer_projet('Visiteur', '00000000-0000-4000-d000-000000000001', '{}') $$,
  '42501', null,
  'Le visiteur ne crée pas de livre'
);

select * from finish();
rollback;
