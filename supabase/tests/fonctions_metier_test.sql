-- Fonctions métier : création d'un projet, ordre des intérieures, automatismes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

insert into auth.users (id, email, raw_user_meta_data)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}');

-- Rangs des intérieures dans l'ordre, et la suite attendue 1..N sans doublon ni trou.
create function pg_temp.rangs(p_projet_id uuid) returns integer[]
language sql as $$
  select coalesce(array_agg(position order by position), '{}')
  from public.double_page where projet_id = p_projet_id and role = 'interieur';
$$;
create function pg_temp.suite(n integer) returns integer[]
language sql as $$ select array(select generate_series(1, n)) $$;

create temporary table livre (projet_id uuid);
grant all on livre to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------------
-- creer_projet : entrées refusées
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.creer_projet('   ', '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-b000-000000000001'::uuid, array[10])) $$,
  'P0001', 'invalide', 'Un titre vide est refusé'
);

select throws_ok(
  $$ select public.creer_projet('Livre', gen_random_uuid(),
       array_fill('00000000-0000-4000-b000-000000000001'::uuid, array[10])) $$,
  'P0001', 'introuvable', 'Un modèle inconnu est introuvable'
);

select throws_ok(
  $$ select public.creer_projet('Livre', '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-b000-000000000001'::uuid, array[9])) $$,
  'P0001', 'invalide', 'Le nombre d''intérieures doit être celui du modèle'
);

select throws_ok(
  $$ select public.creer_projet('Livre', '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-b000-000000000004'::uuid, array[10])) $$,
  'P0001', 'invalide', 'Les intérieures doivent être de la famille du modèle'
);

select throws_ok(
  $$ select public.creer_projet('Livre', '00000000-0000-4000-d000-000000000001',
       array_fill('00000000-0000-4000-c000-000000000001'::uuid, array[10])) $$,
  'P0001', 'invalide', 'Un gabarit de couverture ne sert pas d''intérieure'
);

select is((select count(*) from public.projet), 0::bigint, 'Aucun projet n''a été écrit par les appels refusés');

-- ---------------------------------------------------------------------------
-- creer_projet : création complète
-- ---------------------------------------------------------------------------

-- Intérieures alternées : 01 (un cadre) et 03 (deux cadres).
insert into livre
select public.creer_projet('  Été 2026  ', '00000000-0000-4000-d000-000000000001',
  array(select case when rang % 2 = 1 then '00000000-0000-4000-b000-000000000001'::uuid
                    else '00000000-0000-4000-b000-000000000003'::uuid end
        from generate_series(1, 10) as rang));

select results_eq(
  'select titre, utilisateur_id, theme_id, modele_origine_id, brouillon from public.projet',
  $$ values ('Été 2026', 'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
             '00000000-0000-4000-a000-000000000001'::uuid,
             '00000000-0000-4000-d000-000000000001'::uuid, true) $$,
  'Le projet reprend le modèle, au nom du Créateur, titre nettoyé'
);

select results_eq(
  $$ select role::text, count(*) from public.double_page
     where projet_id = (select projet_id from livre) group by role order by role $$,
  $$ values ('couverture', 1::bigint), ('interieur', 10::bigint), ('quatrieme', 1::bigint) $$,
  'Le projet naît avec sa couverture, ses intérieures et sa 4e'
);

select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(10), 'Les intérieures vont de 1 à 10');

select is(
  (select count(*) from public.emplacement where projet_id = (select projet_id from livre)),
  -- couverture 3 + 5 × 1 + 5 × 2 + 4e 2
  20::bigint,
  'La géométrie de chaque gabarit est copiée dans les emplacements'
);

select results_eq(
  $$ select e.nature::text, e.x, e.y, e.largeur, e.hauteur
     from public.emplacement e join public.double_page d on d.id = e.double_page_id
     where d.projet_id = (select projet_id from livre) and d.position = 2 order by e.indice $$,
  $$ values ('photo', 0::float8, 0::float8, 200::float8, 210::float8),
            ('photo', 220::float8, 0::float8, 200::float8, 210::float8) $$,
  'Les emplacements reprennent exactement les cadres du gabarit'
);

-- ---------------------------------------------------------------------------
-- Ordre des intérieures
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.inserer_double_page((select projet_id from livre), '00000000-0000-4000-b000-000000000001', 12) $$,
  'P0001', 'invalide', 'Insérer au-delà de N + 1 est refusé'
);

select throws_ok(
  $$ select public.inserer_double_page((select projet_id from livre), '00000000-0000-4000-c000-000000000001', 1) $$,
  'P0001', 'invalide', 'Un gabarit de couverture ne s''insère pas comme intérieure'
);

select throws_ok(
  $$ select public.inserer_double_page((select projet_id from livre), '00000000-0000-4000-b000-000000000004', 1) $$,
  'P0001', 'invalide', 'Un gabarit d''une autre famille ne s''insère pas'
);

-- Les rangs ont été décalés avant l'échec sur le gabarit : la transaction de la fonction les a annulés.
select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(10), 'Un appel refusé ne laisse aucune trace');

-- Insertion en tête.
create temporary table nouvelle as
select public.inserer_double_page((select projet_id from livre), '00000000-0000-4000-b000-000000000002', 1) as id;

select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(11), 'Après insertion : 1 à 11');
select is(
  (select position from public.double_page where id = (select id from nouvelle)),
  1,
  'La double page insérée est au rang demandé'
);

-- Déplacement vers l'arrière, puis vers l'avant.
select lives_ok(
  $$ select public.deplacer_double_page((select id from nouvelle), 6) $$,
  'Déplacer du rang 1 au rang 6'
);
select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(11), 'Après déplacement : 1 à 11');
select is((select position from public.double_page where id = (select id from nouvelle)), 6, 'La double page est au rang 6');

select lives_ok(
  $$ select public.deplacer_double_page((select id from nouvelle), 2) $$,
  'Déplacer du rang 6 au rang 2'
);
select is((select position from public.double_page where id = (select id from nouvelle)), 2, 'La double page est au rang 2');

select throws_ok(
  $$ select public.deplacer_double_page(
       (select id from public.double_page where role = 'couverture'), 1) $$,
  'P0001', 'invalide', 'La couverture ne se déplace pas'
);

-- Duplication : la copie suit la source et porte les mêmes photos.
insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                          empreinte_fichier, largeur_px, hauteur_px)
select projet_id, gen_random_uuid(), 'webp', 'plage.jpg', repeat('a', 64), 4000, 3000 from livre;

update public.emplacement
set photo_id = (select id from public.photo), cadrage_x = 0.4, cadrage_y = 0.6, cadrage_zoom = 1.5
where double_page_id = (select id from nouvelle);

create temporary table copie as
select public.dupliquer_double_page((select id from nouvelle)) as id;

select is((select position from public.double_page where id = (select id from copie)), 3, 'La copie se place juste après la source');
select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(12), 'Après duplication : 1 à 12');
select results_eq(
  $$ select indice, photo_id, cadrage_x, cadrage_y, cadrage_zoom from public.emplacement
     where double_page_id = (select id from copie) order by indice $$,
  $$ select indice, photo_id, cadrage_x, cadrage_y, cadrage_zoom from public.emplacement
     where double_page_id = (select id from nouvelle) order by indice $$,
  'La copie porte les mêmes photos, au même cadrage'
);

-- Suppression : le trou se referme, la photo reste dans la réserve.
select lives_ok($$ select public.supprimer_double_page((select id from nouvelle)) $$, 'Supprimer la double page source');
select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(11), 'Après suppression : 1 à 11');

-- ---------------------------------------------------------------------------
-- Changement de gabarit
-- ---------------------------------------------------------------------------

-- La copie est au rang 2, gabarit 02 (un cadre), photo posée.
select throws_ok(
  $$ select public.changer_gabarit(
       (select id from public.double_page where role = 'couverture'), '00000000-0000-4000-c000-000000000001') $$,
  'P0001', 'invalide', 'La couverture ne change pas de gabarit ici'
);

select throws_ok(
  $$ select public.changer_gabarit((select id from copie), '00000000-0000-4000-b000-000000000004') $$,
  'P0001', 'invalide', 'Un gabarit d''une autre famille est refusé'
);

select throws_ok(
  $$ select public.changer_gabarit((select id from copie), '00000000-0000-4000-c000-000000000001') $$,
  'P0001', 'invalide', 'Un gabarit de couverture n''habille pas une intérieure'
);

reset role;
update public.gabarit set actif = false where id = '00000000-0000-4000-b000-000000000003';
set local role authenticated;

select throws_ok(
  $$ select public.changer_gabarit((select id from copie), '00000000-0000-4000-b000-000000000003') $$,
  'P0001', 'invalide', 'Un gabarit inactif est refusé'
);

reset role;
update public.gabarit set actif = true where id = '00000000-0000-4000-b000-000000000003';
set local role authenticated;

create temporary table avant as
select id, photo_id from public.emplacement where double_page_id = (select id from copie);

select lives_ok(
  $$ select public.changer_gabarit((select id from copie), '00000000-0000-4000-b000-000000000002') $$,
  'Reprendre le gabarit actuel est accepté'
);
select results_eq(
  $$ select id, photo_id from public.emplacement where double_page_id = (select id from copie) $$,
  $$ select id, photo_id from avant $$,
  'Reprendre le gabarit actuel ne touche à rien'
);

select lives_ok(
  $$ select public.changer_gabarit((select id from copie), '00000000-0000-4000-b000-000000000003') $$,
  'Passer au gabarit 03'
);
select results_eq(
  $$ select gabarit_origine_id, position from public.double_page where id = (select id from copie) $$,
  $$ values ('00000000-0000-4000-b000-000000000003'::uuid, 2) $$,
  'La double page porte le nouveau gabarit et garde son rang'
);
select results_eq(
  $$ select nature::text, x, y, largeur, hauteur, photo_id, contenu_texte from public.emplacement
     where double_page_id = (select id from copie) order by indice $$,
  $$ values ('photo', 0::float8, 0::float8, 200::float8, 210::float8, null::uuid, null::text),
            ('photo', 220::float8, 0::float8, 200::float8, 210::float8, null::uuid, null::text) $$,
  'Les cadres du nouveau gabarit sont recréés, vides'
);
select is((select count(*) from public.photo), 1::bigint, 'La photo retirée reste dans la réserve');
select is(pg_temp.rangs((select projet_id from livre)), pg_temp.suite(11), 'Changer de gabarit ne touche pas aux rangs');

-- ---------------------------------------------------------------------------
-- Automatismes
-- ---------------------------------------------------------------------------

select lives_ok($$ delete from public.photo $$, 'Supprimer la photo de la réserve');
select is(
  (select count(*) from public.emplacement where photo_id is not null),
  0::bigint,
  'Supprimer une photo vide les emplacements qui la portaient'
);

-- now() est figé pour la transaction : on recule modifie_le, puis on regarde s'il revient à now().
reset role;
alter table public.projet disable trigger dater_modification;
update public.projet set modifie_le = '2000-01-01';
alter table public.projet enable trigger dater_modification;
set local role authenticated;

insert into public.export (projet_id, cle_stockage) select projet_id, gen_random_uuid() from livre;
select is((select modifie_le from public.projet), '2000-01-01'::timestamptz, 'Un export ne modifie pas le livre');

update public.emplacement set contenu_texte = 'Titre' where nature = 'texte' and indice = 1
  and double_page_id = (select id from public.double_page where role = 'couverture');
select is((select modifie_le from public.projet), now(), 'Écrire dans un emplacement date la modification du livre');

select * from finish();
rollback;
