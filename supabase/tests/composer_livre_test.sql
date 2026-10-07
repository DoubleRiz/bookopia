-- composer_livre : intérieures remplacées d'un coup, couverture et 4e intactes, entrées revérifiées.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{"nom_affichage": "Bob"}');

-- genereux : le livre composé ; raconte : un second livre d'Alice, pour les cadres texte
-- et la photo d'un autre projet.
create temporary table livre (nom text primary key, projet_id uuid);
create temporary table avant (id uuid);
grant all on livre, avant to authenticated;

create function pg_temp.livre(p_nom text) returns uuid
language sql as $$ select projet_id from livre where nom = p_nom $$;

create function pg_temp.gabarit(p_suffixe text) returns uuid
language sql as $$ select ('00000000-0000-4000-' || p_suffixe)::uuid $$;

create function pg_temp.photo(p_numero integer) returns uuid
language sql as $$ select ('00000000-0000-4000-e000-' || lpad(p_numero::text, 12, '0'))::uuid $$;

-- Photos d'identifiant lisible, importées dans un livre.
create function pg_temp.importer(p_projet_id uuid, p_numeros integer[]) returns void
language sql as $$
  insert into public.photo (id, projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                            empreinte_fichier, largeur_px, hauteur_px, cree_le)
  select pg_temp.photo(numero), p_projet_id, gen_random_uuid(), 'webp', numero || '.jpg',
         lpad(to_hex(numero), 64, '0'), 4000, 3000,
         timestamptz '2026-10-07' + numero * interval '1 minute'
  from unnest(p_numeros) as numero;
$$;

-- Une double page pour composer_livre : un gabarit et ses poses [indice, numéro de photo].
create function pg_temp.page(p_gabarit uuid, p_poses integer[][] default '{}')
returns jsonb
language sql as $$
  select jsonb_build_object(
    'gabarit_id', p_gabarit,
    'poses', coalesce((
      select jsonb_agg(jsonb_build_object('indice', p_poses[i][1], 'photo_id', pg_temp.photo(p_poses[i][2])))
      from generate_subscripts(p_poses, 1) as i
    ), '[]'::jsonb)
  );
$$;

create function pg_temp.composer(p_projet_id uuid, variadic p_pages jsonb[])
returns integer
language sql as $$ select public.composer_livre(p_projet_id, to_jsonb(p_pages)) $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

insert into livre values
  ('genereux', public.creer_projet('Vacances', '00000000-0000-4000-d000-000000000001',
    array_fill('00000000-0000-4000-b000-000000000001'::uuid, array[10]))),
  ('raconte', public.creer_projet('Carnet', '00000000-0000-4000-d000-000000000003',
    array_fill('00000000-0000-4000-b000-000000000008'::uuid, array[10])));

reset role;
select pg_temp.importer(pg_temp.livre('genereux'), array[1, 2, 3, 4]);
select pg_temp.importer(pg_temp.livre('raconte'), array[9]);
set local role authenticated;

-- La photo 1 est posée sur la couverture : la composition ne doit pas l'en retirer.
update public.emplacement
set photo_id = pg_temp.photo(1), cadrage_x = 0.2, cadrage_y = 0.3, cadrage_zoom = 1.5
where double_page_id = (
  select id from public.double_page
  where projet_id = pg_temp.livre('genereux') and role = 'couverture'
) and nature = 'photo';

insert into avant
select id from public.double_page
where projet_id = pg_temp.livre('genereux') and role <> 'interieur';

-- ---------------------------------------------------------------------------
-- Cas nominal
-- ---------------------------------------------------------------------------

select is(
  pg_temp.composer(pg_temp.livre('genereux'),
    pg_temp.page(pg_temp.gabarit('b000-000000000003'), array[[0, 2], [1, 3]]),
    pg_temp.page(pg_temp.gabarit('b000-000000000001'), array[[0, 4]])),
  2, 'Renvoie le nombre d''intérieures créées');

select results_eq(
  $$ select position, gabarit_origine_id from public.double_page
     where projet_id = pg_temp.livre('genereux') and role = 'interieur'
     order by position $$,
  $$ values (1, '00000000-0000-4000-b000-000000000003'::uuid),
            (2, '00000000-0000-4000-b000-000000000001'::uuid) $$,
  'Les dix intérieures sont remplacées par les deux demandées, aux rangs 1 et 2'
);

select results_eq(
  $$ select double_page.position, emplacement.indice, emplacement.photo_id
     from public.emplacement
     join public.double_page on double_page.id = emplacement.double_page_id
     where double_page.projet_id = pg_temp.livre('genereux')
       and double_page.role = 'interieur'
       and emplacement.photo_id is not null
     order by double_page.position, emplacement.indice $$,
  $$ values (1, 0, pg_temp.photo(2)), (1, 1, pg_temp.photo(3)), (2, 0, pg_temp.photo(4)) $$,
  'Chaque photo est posée dans le cadre demandé'
);

select is(
  (select count(*)::integer from public.emplacement
   join public.double_page on double_page.id = emplacement.double_page_id
   where double_page.projet_id = pg_temp.livre('genereux')
     and double_page.role = 'interieur'
     and emplacement.photo_id is not null
     and (cadrage_x, cadrage_y, cadrage_zoom) is distinct from (0.5::float8, 0.5::float8, 1::float8)),
  0, 'Cadrage neutre : centrée, sans zoom');

select set_eq(
  $$ select id from public.double_page
     where projet_id = pg_temp.livre('genereux') and role <> 'interieur' $$,
  $$ select id from avant $$,
  'Couverture et 4e ne sont pas recréées'
);

select results_eq(
  $$ select photo_id, cadrage_x, cadrage_y, cadrage_zoom from public.emplacement
     join public.double_page on double_page.id = emplacement.double_page_id
     where double_page.projet_id = pg_temp.livre('genereux')
       and double_page.role = 'couverture' and emplacement.nature = 'photo' $$,
  $$ values (pg_temp.photo(1), 0.2::float8, 0.3::float8, 1.5::float8) $$,
  'La photo de la couverture et son cadrage sont conservés'
);

select is(
  pg_temp.composer(pg_temp.livre('genereux'),
    pg_temp.page(pg_temp.gabarit('b000-000000000002'), array[[0, 4]])),
  1, 'Une recomposition remplace la précédente');

select results_eq(
  $$ select count(*)::integer, count(emplacement.photo_id)::integer
     from public.double_page
     left join public.emplacement on emplacement.double_page_id = double_page.id
     where double_page.projet_id = pg_temp.livre('genereux') and double_page.role = 'interieur' $$,
  $$ values (1, 1) $$,
  'Les intérieures et les poses de la composition précédente ont disparu'
);

select is(
  pg_temp.composer(pg_temp.livre('raconte'),
    pg_temp.page(pg_temp.gabarit('b000-000000000008'), array[[0, 9]])),
  1, 'Les cadres texte restent vides : seul le cadre photo est posé');

-- ---------------------------------------------------------------------------
-- Entrées refusées
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.composer_livre(%L, %L)', pg_temp.livre('genereux'), '[]'),
  'P0001', 'invalide', 'Une liste vide est refusée'
);

select throws_ok(
  format('select public.composer_livre(%L, %L)', pg_temp.livre('genereux'), '{"gabarit_id": null}'),
  'P0001', 'invalide', 'Une entrée qui n''est pas une liste est refusée'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2]]))',
         pg_temp.livre('genereux'), 'b000-000000000004'),
  'P0001', 'invalide', 'Un gabarit d''une autre famille est refusé'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2]]))',
         pg_temp.livre('genereux'), 'c000-000000000001'),
  'P0001', 'invalide', 'Un gabarit de couverture est refusé'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2]]))',
         pg_temp.livre('genereux'), 'b000-0000000000ff'),
  'P0001', 'invalide', 'Un gabarit inconnu est refusé'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[1, 9]]))',
         pg_temp.livre('raconte'), 'b000-000000000008'),
  'P0001', 'invalide', 'Une photo dans un cadre texte est refusée'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[5, 2]]))',
         pg_temp.livre('genereux'), 'b000-000000000001'),
  'P0001', 'invalide', 'Un indice absent du gabarit est refusé'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2], [0, 3]]))',
         pg_temp.livre('genereux'), 'b000-000000000003'),
  'P0001', 'invalide', 'Deux photos dans le même cadre sont refusées'
);

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 9]]))',
         pg_temp.livre('genereux'), 'b000-000000000001'),
  'P0001', 'invalide', 'La photo d''un autre livre est refusée'
);

reset role;
update public.gabarit set actif = false where id = pg_temp.gabarit('b000-000000000002');
set local role authenticated;

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2]]))',
         pg_temp.livre('genereux'), 'b000-000000000002'),
  'P0001', 'invalide', 'Un gabarit retiré du catalogue est refusé'
);

select is(
  (select count(*)::integer from public.double_page
   where projet_id = pg_temp.livre('genereux') and role = 'interieur'),
  1, 'Un refus n''écrit rien : l''intérieure précédente est toujours là');

reset role;
update public.projet set modele_origine_id = null where id = pg_temp.livre('raconte');
set local role authenticated;

select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 9]]))',
         pg_temp.livre('raconte'), 'b000-000000000008'),
  'P0001', 'invalide', 'Un livre sans modèle d''origine ne peut pas être composé'
);

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  format('select pg_temp.composer(%L, pg_temp.page(pg_temp.gabarit(%L), array[[0, 2]]))',
         pg_temp.livre('genereux'), 'b000-000000000001'),
  'P0001', 'introuvable', 'Le livre d''un autre est introuvable'
);

select * from finish();
rollback;
