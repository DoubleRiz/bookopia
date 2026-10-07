-- Composition du livre par le moteur de gabarits (L5).
-- Spécification : docs/superpowers/specs/2026-10-07-moteur-gabarits-design.md (« La fonction composer_livre »).
--
-- Le moteur vit dans le navigateur (packages/shared, composerLivre) : il choisit les gabarits
-- et la place de chaque photo. Cette fonction ne recalcule rien : elle vérifie et écrit.

-- Remplacé par composer_livre : il posait les photos dans des intérieures déjà choisies.
drop function public.remplir_emplacements(uuid);

-- Remplace toutes les intérieures du livre par celles demandées, aux rangs 1 à N, et y pose les photos.
-- p_doubles_pages : [{ "gabarit_id": uuid, "poses": [{ "indice": int, "photo_id": uuid }] }, …]
-- Couverture et 4e ne sont pas touchées. Renvoie le nombre d'intérieures créées.
-- Tout est vérifié avant la première écriture ; à la moindre erreur, rien n'est écrit.
create function public.composer_livre(p_projet_id uuid, p_doubles_pages jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
  v_page record;
  v_double_page_id uuid;
begin
  -- Lève « introuvable » si le livre n'est pas au Créateur. Le verrou fait passer un double clic
  -- après le premier : sans lui, deux compositions mêleraient leurs intérieures.
  perform public.verrouiller_projet(p_projet_id);

  if jsonb_typeof(p_doubles_pages) is distinct from 'array'
     or jsonb_array_length(p_doubles_pages) = 0 then
    raise exception 'invalide' using detail = 'Il faut au moins une double page intérieure';
  end if;

  -- Le projet ne garde pas sa famille : elle vient du modèle dont il est issu.
  select modele_livre.famille into v_famille
  from public.projet
  join public.modele_livre on modele_livre.id = projet.modele_origine_id
  where projet.id = p_projet_id;

  if v_famille is null then
    raise exception 'invalide'
      using detail = 'Le modèle d''origine du livre a disparu : sa famille de gabarits est inconnue';
  end if;

  -- Les doubles pages demandées, numérotées, et leurs poses mises à plat.
  -- Une valeur qui n'est pas un objet ou une liste se lit comme vide : la vérification la refuse.
  create temporary table composition_page on commit drop as
  select page.rang::integer as rang,
         case when jsonb_typeof(page.valeur) = 'object'
              then (page.valeur ->> 'gabarit_id')::uuid end as gabarit_id,
         case when jsonb_typeof(page.valeur -> 'poses') = 'array'
              then page.valeur -> 'poses' else '[]'::jsonb end as poses
  from jsonb_array_elements(p_doubles_pages) with ordinality as page (valeur, rang);

  create temporary table composition_pose on commit drop as
  select composition_page.rang,
         composition_page.gabarit_id,
         (pose.valeur ->> 'indice')::integer as indice,
         (pose.valeur ->> 'photo_id')::uuid as photo_id
  from composition_page
  cross join jsonb_array_elements(composition_page.poses) as pose (valeur);

  if exists (
    select 1
    from composition_page
    where not exists (
      select 1 from public.gabarit
      where gabarit.id = composition_page.gabarit_id
        and gabarit.actif
        and gabarit.role = 'interieur'
        and gabarit.famille = v_famille
    )
  ) then
    raise exception 'invalide'
      using detail = format('Chaque gabarit doit être un intérieur actif de la famille %s', v_famille);
  end if;

  if exists (
    select 1
    from composition_pose
    join public.gabarit on gabarit.id = composition_pose.gabarit_id
    where not exists (
      select 1 from jsonb_array_elements(gabarit.definition) as cadre (valeur)
      where (cadre.valeur ->> 'indice')::integer = composition_pose.indice
        and cadre.valeur ->> 'nature' = 'photo'
    )
  ) then
    raise exception 'invalide'
      using detail = 'Chaque photo doit viser un cadre photo de son gabarit';
  end if;

  if exists (
    select 1 from composition_pose
    group by rang, indice
    having count(*) > 1
  ) then
    raise exception 'invalide' using detail = 'Deux photos visent le même cadre';
  end if;

  if exists (
    select 1 from composition_pose
    where not exists (
      select 1 from public.photo
      where photo.id = composition_pose.photo_id
        and photo.projet_id = p_projet_id
    )
  ) then
    raise exception 'invalide' using detail = 'Chaque photo doit appartenir au livre';
  end if;

  -- Les emplacements des intérieures partent en cascade ; leurs photos restent dans la réserve.
  delete from public.double_page
  where projet_id = p_projet_id
    and role = 'interieur';

  for v_page in select rang, gabarit_id from composition_page order by rang loop
    v_double_page_id := public.creer_double_page(p_projet_id, 'interieur', v_page.gabarit_id, v_page.rang);

    -- Cadrage neutre : photo centrée, sans zoom. Le Créateur l'ajustera dans l'éditeur.
    update public.emplacement
    set photo_id = composition_pose.photo_id,
        cadrage_x = 0.5,
        cadrage_y = 0.5,
        cadrage_zoom = 1
    from composition_pose
    where composition_pose.rang = v_page.rang
      and emplacement.double_page_id = v_double_page_id
      and emplacement.indice = composition_pose.indice;
  end loop;

  -- Supprimées tout de suite : un second appel dans la même transaction les recréera.
  drop table composition_pose, composition_page;

  return jsonb_array_length(p_doubles_pages);
end;
$$;

revoke execute on function public.composer_livre(uuid, jsonb) from public, anon;
grant execute on function public.composer_livre(uuid, jsonb) to authenticated;
