-- Textes et thèmes : style des cadres texte, plafond des textes, changer_theme.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{}');

create temporary table livre (projet_id uuid);
grant all on livre to authenticated;

-- Les styles d'une double page, dans l'ordre des cadres.
create function pg_temp.styles(p_double_page_id uuid) returns text[]
language sql as $$
  select array_agg(coalesce(style_texte::text, '-') order by indice)
  from public.emplacement where double_page_id = p_double_page_id;
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.theme where typographie ? 'titre' and typographie ? 'legende'
     and typographie ? 'styles_masques'),
  4::bigint,
  'Chaque thème du catalogue a une typographie'
);

select is(
  (select count(*) from public.gabarit, jsonb_array_elements(definition) as cadre
   where cadre ->> 'nature' = 'texte' and not cadre ? 'style'),
  0::bigint,
  'Chaque cadre texte du catalogue porte un style'
);

-- ---------------------------------------------------------------------------
-- Style copié du gabarit
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- Livre raconté : intérieures 08, 09, 10, 11 puis 08.
insert into livre
select public.creer_projet('Bretagne', '00000000-0000-4000-d000-000000000003', array[
  '00000000-0000-4000-b000-000000000008', '00000000-0000-4000-b000-000000000009',
  '00000000-0000-4000-b000-000000000010', '00000000-0000-4000-b000-000000000011',
  '00000000-0000-4000-b000-000000000008', '00000000-0000-4000-b000-000000000008',
  '00000000-0000-4000-b000-000000000008', '00000000-0000-4000-b000-000000000008',
  '00000000-0000-4000-b000-000000000008', '00000000-0000-4000-b000-000000000008'
]::uuid[]);

create temporary table page as
select role, position, id from public.double_page where projet_id = (select projet_id from livre);
grant all on page to authenticated;

select is(
  pg_temp.styles((select id from page where position = 1)),
  array['-', 'titre', 'legende'],
  'Gabarit 08 : la photo sans style, un titre, une légende'
);
select is(
  pg_temp.styles((select id from page where position = 3)),
  array['-', 'titre_page'],
  'Gabarit 10 : le titre de la page de titre'
);
select is(
  pg_temp.styles((select id from page where role = 'couverture')),
  array['-', 'titre_page', 'legende'],
  'La couverture reçoit les styles de son gabarit : son titre reste visible sous Silence'
);

select lives_ok(
  $$ select public.changer_gabarit((select id from page where position = 1), '00000000-0000-4000-b000-000000000011') $$,
  'Passer du gabarit 08 au gabarit 11'
);
select is(
  pg_temp.styles((select id from page where position = 1)),
  array['-', '-', '-', 'legende', 'legende', 'legende'],
  'Changer de gabarit recrée les styles du nouveau gabarit'
);

update public.emplacement set contenu_texte = 'Le phare'
where double_page_id = (select id from page where position = 3) and nature = 'texte';

create temporary table copie (id uuid);
grant all on copie to authenticated;

select lives_ok(
  $$ insert into copie select public.dupliquer_double_page((select id from page where position = 3)) $$,
  'Dupliquer la page de titre'
);
select results_eq(
  $$ select style_texte::text, contenu_texte from public.emplacement
     where double_page_id = (select id from copie) and nature = 'texte' $$,
  $$ values ('titre_page', 'Le phare') $$,
  'La copie garde le style et le texte'
);

-- ---------------------------------------------------------------------------
-- Contraintes
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  $$ update public.emplacement set style_texte = null where nature = 'texte' $$,
  '23514', null, 'Un cadre texte sans style est refusé'
);
select throws_ok(
  $$ update public.emplacement set style_texte = 'legende' where nature = 'photo' $$,
  '23514', null, 'Un cadre photo avec un style est refusé'
);

reset role;
insert into public.gabarit (id, nom, role, famille, definition)
values ('00000000-0000-4000-b000-0000000000ff', 'Sans style', 'interieur', 'raconte',
  '[{"indice": 0, "nature": "texte", "x": 15, "y": 15, "largeur": 100, "hauteur": 20}]');
set local role authenticated;

select throws_ok(
  $$ select public.changer_gabarit((select id from page where position = 2), '00000000-0000-4000-b000-0000000000ff') $$,
  '23514', null, 'Un gabarit dont un cadre texte n''a pas de style ne crée rien'
);

select lives_ok(
  $$ update public.emplacement set contenu_texte = repeat('a', 400)
     where double_page_id = (select id from page where position = 2) and indice = 1 $$,
  '400 caractères sont acceptés'
);
select throws_ok(
  $$ update public.emplacement set contenu_texte = repeat('a', 401)
     where double_page_id = (select id from page where position = 2) and indice = 1 $$,
  '23514', null, 'Au-delà de 400 caractères, la base refuse'
);

-- ---------------------------------------------------------------------------
-- changer_theme
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.changer_theme((select projet_id from livre), '00000000-0000-4000-a000-000000000004') $$,
  'Passer au thème Silence'
);
select is(
  (select theme_id from public.projet where id = (select projet_id from livre)),
  '00000000-0000-4000-a000-000000000004'::uuid,
  'Le livre porte le nouveau thème'
);

reset role;
update public.theme set actif = false where id = '00000000-0000-4000-a000-000000000002';
set local role authenticated;

select throws_ok(
  $$ select public.changer_theme((select projet_id from livre), '00000000-0000-4000-a000-000000000002') $$,
  'P0001', 'invalide', 'Un thème désactivé est refusé'
);
select throws_ok(
  $$ select public.changer_theme((select projet_id from livre), gen_random_uuid()) $$,
  'P0001', 'invalide', 'Un thème inconnu est refusé'
);

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.changer_theme((select projet_id from livre), '00000000-0000-4000-a000-000000000001') $$,
  'P0001', 'introuvable', 'Le livre d''un autre est introuvable'
);

select * from finish();
rollback;
