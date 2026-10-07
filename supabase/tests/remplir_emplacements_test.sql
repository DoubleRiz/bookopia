-- remplir_emplacements : ordre du livre, emplacements remplis et photos posées respectés, propriétaire vérifié.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{"nom_affichage": "Bob"}');

create temporary table livre (projet_id uuid);
grant all on livre to authenticated;

-- Photo posée dans le premier emplacement photo d'une double page : null si vide.
create function pg_temp.photo_de(p_role public.role_double_page, p_position integer)
returns uuid
language sql as $$
  select emplacement.photo_id
  from public.emplacement
  join public.double_page on double_page.id = emplacement.double_page_id
  where double_page.projet_id = (select projet_id from livre)
    and double_page.role = p_role
    and double_page.position is not distinct from p_position
    and emplacement.nature = 'photo'
  order by emplacement.indice
  limit 1;
$$;

-- Photos d'identifiant lisible, importées dans l'ordre de leur numéro.
create function pg_temp.importer(p_numeros integer[]) returns void
language sql as $$
  insert into public.photo (id, projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                            empreinte_fichier, largeur_px, hauteur_px, cree_le)
  select ('00000000-0000-4000-e000-' || lpad(numero::text, 12, '0'))::uuid,
         (select projet_id from livre), gen_random_uuid(), 'webp', numero || '.jpg',
         lpad(to_hex(numero), 64, '0'), 4000, 3000,
         timestamptz '2026-10-07' + numero * interval '1 minute'
  from unnest(p_numeros) as numero;
$$;

create function pg_temp.photo(p_numero integer) returns uuid
language sql as $$ select ('00000000-0000-4000-e000-' || lpad(p_numero::text, 12, '0'))::uuid $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- Modèle Généreux, dix « Pleine double page » : un emplacement photo par double page,
-- plus celui de la couverture et celui de la 4e. Douze en tout.
insert into livre
select public.creer_projet('Vacances', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000001'::uuid, array[10]));

select is(public.remplir_emplacements((select projet_id from livre)), 0,
  'Réserve vide : aucune photo posée');

reset role;
select pg_temp.importer(array[1, 2, 3]);
set local role authenticated;

select is(public.remplir_emplacements((select projet_id from livre)), 3,
  'Trois photos, trois photos posées');
select is(pg_temp.photo_de('couverture', null), pg_temp.photo(1),
  'La première photo importée va sur la couverture');
select is(pg_temp.photo_de('interieur', 1), pg_temp.photo(2),
  'La deuxième va sur la première intérieure');
select is(pg_temp.photo_de('interieur', 2), pg_temp.photo(3),
  'La troisième va sur la deuxième intérieure');
select results_eq(
  $$ select cadrage_x, cadrage_y, cadrage_zoom from public.emplacement
     where photo_id = pg_temp.photo(1) $$,
  $$ values (0.5::float8, 0.5::float8, 1::float8) $$,
  'Cadrage neutre : centrée, sans zoom'
);

select is(public.remplir_emplacements((select projet_id from livre)), 0,
  'Une photo déjà posée n''est pas posée une seconde fois');

-- La couverture est vidée : la photo 1 redevient libre. La photo 4 arrive.
update public.emplacement set photo_id = null
where photo_id = pg_temp.photo(1);
reset role;
select pg_temp.importer(array[4]);
set local role authenticated;

select is(public.remplir_emplacements((select projet_id from livre)), 2,
  'Seuls les emplacements vides sont remplis');
select ok(
  pg_temp.photo_de('couverture', null) = pg_temp.photo(1)
  and pg_temp.photo_de('interieur', 1) = pg_temp.photo(2)
  and pg_temp.photo_de('interieur', 3) = pg_temp.photo(4),
  'Les emplacements déjà remplis gardent leur photo, les libres suivent l''ordre'
);

-- Huit emplacements restent : sept intérieures puis la 4e, servie en dernier.
reset role;
select pg_temp.importer(array[5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
set local role authenticated;
select remplir_emplacements((select projet_id from livre));
select is(pg_temp.photo_de('quatrieme', null), pg_temp.photo(12),
  'La 4e est remplie après la dernière intérieure');

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  format('select public.remplir_emplacements(%L)', (select projet_id from livre)),
  'P0001', 'introuvable', 'Le livre d''un autre est introuvable'
);

select * from finish();
rollback;
