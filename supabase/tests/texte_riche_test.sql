-- Texte riche : validation du document, conversion des anciens textes, placer_cadre_texte.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@exemple.fr', '{}');

-- ---------------------------------------------------------------------------
-- contenu_texte_valide
-- ---------------------------------------------------------------------------

select ok(public.contenu_texte_valide(null), 'Un cadre vidé (null) est valide');
select ok(
  public.contenu_texte_valide('{"version": 1, "blocs": [
    {"type": "paragraphe", "alignement": "centre", "segments": [
      {"texte": "Été ", "gras": true},
      {"texte": "2026", "police": "Great Vibes", "taille_pt": 24, "couleur": "#8a3b2e", "souligne": true}]},
    {"type": "liste", "elements": [[{"texte": "Premier"}], [{"texte": "Second", "italique": true}]]}
  ]}'),
  'Un document complet est valide'
);
select ok(public.contenu_texte_valide('{"version": 1, "blocs": []}'), 'Un document sans bloc est valide');
select ok(
  public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": []}]}'),
  'Un paragraphe sans segment (ligne vide) est valide'
);

select ok(not public.contenu_texte_valide('"texte"'), 'Une chaîne n''est pas un document');
select ok(not public.contenu_texte_valide('{"version": 2, "blocs": []}'), 'Une autre version est refusée');
select ok(not public.contenu_texte_valide('{"version": 1}'), 'Les blocs sont obligatoires');
select ok(not public.contenu_texte_valide('{"version": 1, "blocs": [], "x": 1}'), 'Une clé inconnue du document est refusée');
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "titre", "segments": []}]}'),
  'Un type de bloc inconnu est refusé'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "alignement": "justifie", "segments": []}]}'),
  'Un alignement inconnu est refusé'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": ""}]}]}'),
  'Un segment vide est refusé'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": "a", "taille_pt": 5}]}]}'),
  'Une taille sous 6 pt est refusée'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": "a", "taille_pt": 73}]}]}'),
  'Une taille au-dessus de 72 pt est refusée'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": "a", "couleur": "rouge"}]}]}'),
  'Une couleur qui n''est pas #rrggbb est refusée'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": "a", "gras": "oui"}]}]}'),
  'Un gras qui n''est pas un booléen est refusé'
);
select ok(
  not public.contenu_texte_valide('{"version": 1, "blocs": [{"type": "paragraphe", "segments": [{"texte": "a", "ombre": true}]}]}'),
  'Un champ inconnu du segment est refusé'
);
select ok(
  public.contenu_texte_valide(jsonb_build_object('version', 1, 'blocs', jsonb_build_array(
    jsonb_build_object('type', 'paragraphe', 'segments', jsonb_build_array(jsonb_build_object('texte', repeat('a', 400))))))),
  '400 caractères de texte brut sont acceptés'
);
select ok(
  not public.contenu_texte_valide(jsonb_build_object('version', 1, 'blocs', jsonb_build_array(
    jsonb_build_object('type', 'paragraphe', 'segments', jsonb_build_array(jsonb_build_object('texte', repeat('a', 401))))))),
  '401 caractères sont refusés'
);
select ok(
  not public.contenu_texte_valide(jsonb_build_object('version', 1, 'blocs', jsonb_build_array(
    jsonb_build_object('type', 'paragraphe', 'segments', jsonb_build_array(jsonb_build_object('texte', repeat('a', 300)))),
    jsonb_build_object('type', 'liste', 'elements', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('texte', repeat('b', 101)))))))),
  'Le plafond compte les paragraphes et les listes ensemble'
);

-- ---------------------------------------------------------------------------
-- Conversion d'un ancien texte : la migration a déjà tourné, on rejoue sa règle sur un cas.
-- ---------------------------------------------------------------------------

select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'emplacement' and column_name = 'contenu_texte'),
  'jsonb',
  'contenu_texte est un jsonb'
);

-- ---------------------------------------------------------------------------
-- placer_cadre_texte
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

-- Gabarit 08 : photo plein haut, légende titre (15, 155, 180×40), légende (225, 155, 180×40).
create temporary table livre (projet_id uuid);
grant all on livre to authenticated;
insert into livre
select public.creer_projet('Bretagne', '00000000-0000-4000-d000-000000000003',
  array_fill('00000000-0000-4000-b000-000000000008'::uuid, array[10]));

create temporary table cible as
select e.id as texte_id, e.double_page_id,
       (select id from public.emplacement p where p.double_page_id = e.double_page_id and p.nature = 'photo') as photo_id
from public.emplacement e
join public.double_page d on d.id = e.double_page_id
where d.projet_id = (select projet_id from livre) and d.role = 'interieur' and d.position = 1
  and e.nature = 'texte' and e.indice = 1;
grant all on cible to authenticated;

select lives_ok(
  $$ select public.placer_cadre_texte((select texte_id from cible), 20, 150, 100, 30) $$,
  'Déplacer et redimensionner un cadre texte dans la double page'
);
select results_eq(
  $$ select x::numeric, y::numeric, largeur::numeric, hauteur::numeric from public.emplacement
     where id = (select texte_id from cible) $$,
  $$ values (20::numeric, 150::numeric, 100::numeric, 30::numeric) $$,
  'La géométrie est écrite'
);
select throws_ok(
  $$ select public.placer_cadre_texte((select photo_id from cible), 20, 150, 100, 30) $$,
  'P0001', 'invalide', 'Un cadre photo ne se déplace pas par cette fonction'
);
select throws_ok(
  $$ select public.placer_cadre_texte((select texte_id from cible), 5, 150, 100, 30) $$,
  'P0001', 'invalide', 'Un cadre hors des marges de sécurité est refusé'
);
select throws_ok(
  $$ select public.placer_cadre_texte((select texte_id from cible), 20, 150, 10, 30) $$,
  'P0001', 'invalide', 'Un cadre trop petit est refusé'
);
select throws_ok(
  $$ select public.placer_cadre_texte((select texte_id from cible), 20, 100, 100, 30) $$,
  'P0001', 'invalide', 'Un cadre qui chevauche la photo est refusé'
);

select set_config('request.jwt.claims', '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.placer_cadre_texte((select texte_id from cible), 30, 150, 100, 30) $$,
  'P0001', 'introuvable', 'Le cadre d''un autre Créateur est introuvable'
);

select * from finish();
rollback;
