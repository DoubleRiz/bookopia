-- Textes et thèmes (L6, 6c) : style des cadres texte, typographie des thèmes, choix du thème.
-- Spécification : docs/superpowers/specs/2026-10-07-textes-themes-design.md.

-- ---------------------------------------------------------------------------
-- Style d'un cadre texte : copié du gabarit, comme la nature et la géométrie
-- ---------------------------------------------------------------------------

-- titre_page : le titre de la page de titre, seul texte que le thème Silence laisse visible.
create type public.style_texte as enum ('titre', 'titre_page', 'legende');

alter table public.emplacement add column style_texte public.style_texte;

-- Les cadres texte créés avant les styles deviennent des légendes : le plus courant des gabarits.
update public.emplacement
set style_texte = 'legende'
where nature = 'texte';

alter table public.emplacement
  -- Un cadre texte a toujours un style, un cadre photo jamais.
  add constraint emplacement_style_selon_nature check (
    (nature = 'texte') = (style_texte is not null)
  ),
  -- Garde-fou de la base : elle ne sait pas mesurer une police. La limite fine, celle qui
  -- empêche un texte de déborder de son cadre, est mesurée dans le navigateur.
  add constraint emplacement_plafond_texte check (
    char_length(contenu_texte) <= 400
  );

-- La géométrie, la nature et le style du gabarit, copiés dans des emplacements vides.
-- Un cadre texte sans style fait échouer la création sur emplacement_style_selon_nature.
create or replace function public.copier_geometrie(
  p_projet_id uuid,
  p_double_page_id uuid,
  p_definition jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.emplacement (
    projet_id, double_page_id, indice, nature, style_texte, x, y, largeur, hauteur
  )
  select p_projet_id, p_double_page_id, cadre.indice, cadre.nature, cadre.style,
         cadre.x, cadre.y, cadre.largeur, cadre.hauteur
  from jsonb_to_recordset(p_definition) as cadre (
    indice integer,
    nature public.nature_emplacement,
    style public.style_texte,
    x double precision,
    y double precision,
    largeur double precision,
    hauteur double precision
  );
$$;

-- Copie une intérieure juste après la source. La copie porte les mêmes photos et le même texte :
-- dupliquer ne copie aucun fichier.
create or replace function public.dupliquer_double_page(p_double_page_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.double_page := public.verrouiller_interieure(p_double_page_id);
  v_copie_id uuid;
begin
  update public.double_page
  set position = position + 1
  where projet_id = v_source.projet_id
    and role = 'interieur'
    and position > v_source.position;

  insert into public.double_page (projet_id, role, position, gabarit_origine_id)
  values (v_source.projet_id, 'interieur', v_source.position + 1, v_source.gabarit_origine_id)
  returning id into v_copie_id;

  insert into public.emplacement (
    projet_id, double_page_id, indice, nature, style_texte, x, y, largeur, hauteur,
    photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte
  )
  select projet_id, v_copie_id, indice, nature, style_texte, x, y, largeur, hauteur,
         photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte
  from public.emplacement
  where double_page_id = v_source.id;

  return v_copie_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Typographie des thèmes
-- ---------------------------------------------------------------------------

-- Polices, tailles, alignement, ancrage et styles masqués : un seul JSON, validé par Zod au
-- chargement comme la définition d'un gabarit. Il remplace les deux noms de police, insuffisants :
-- il faut aussi la graisse, l'italique et la taille. Le catalogue n'est écrit que par seed.sql.
alter table public.theme
  drop column police_titre,
  drop column police_texte,
  add column typographie jsonb not null;

-- ---------------------------------------------------------------------------
-- Choix du thème
-- ---------------------------------------------------------------------------

-- Habille le livre d'un autre thème. Rien d'autre ne change : un thème ne touche jamais
-- la géométrie ni les textes, il se défait en choisissant l'ancien.
-- Une fonction plutôt qu'un droit sur theme_id : la clé étrangère ne refuse pas un thème désactivé.
create function public.changer_theme(
  p_projet_id uuid,
  p_theme_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Projet à soi, verrouillé : un changement de thème attend la fin d'une opération d'ordre.
  perform public.verrouiller_projet(p_projet_id);

  perform 1
  from public.theme
  where id = p_theme_id
    and actif;

  if not found then
    raise exception 'invalide'
      using detail = 'Le thème doit exister et être proposé au catalogue';
  end if;

  update public.projet
  set theme_id = p_theme_id
  where id = p_projet_id;
end;
$$;

-- Supabase accorde par défaut l'exécution de toute nouvelle fonction à anon et authenticated.
revoke execute on function public.copier_geometrie(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.changer_theme(uuid, uuid) from public, anon;
grant execute on function public.changer_theme(uuid, uuid) to authenticated;
