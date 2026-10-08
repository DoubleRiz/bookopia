-- Texte riche et cadres texte déplaçables : contenu_texte devient un document JSON,
-- la géométrie d'un cadre texte se modifie par placer_cadre_texte.
-- Spécification : docs/superpowers/specs/2026-10-08-texte-riche-design.md.

-- ---------------------------------------------------------------------------
-- Validation du document
-- ---------------------------------------------------------------------------

-- Vérifie une liste de segments et renvoie le nombre de caractères de texte brut qu'elle porte,
-- ou -1 si elle est mal formée. Interne : appelée par contenu_texte_valide.
-- Un segment est un objet { texte, gras?, italique?, souligne?, police?, taille_pt?, couleur? } ;
-- tout champ inconnu le rend invalide, pour qu'un document ne cache rien d'imprévu.
-- Le nom de police n'est pas vérifié : la base ne connaît pas le catalogue, le rendu le refusera.
create function public.segments_texte_valides(p_segments jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_segment jsonb;
  v_total integer := 0;
  v_champ text;
begin
  if jsonb_typeof(p_segments) is distinct from 'array' then
    return -1;
  end if;

  for v_segment in select jsonb_array_elements(p_segments) loop
    if jsonb_typeof(v_segment) is distinct from 'object' then
      return -1;
    end if;

    -- Aucune clé hors de la liste.
    if exists (
      select 1 from jsonb_object_keys(v_segment) as cle
      where cle <> all (array['texte', 'gras', 'italique', 'souligne', 'police', 'taille_pt', 'couleur'])
    ) then
      return -1;
    end if;

    -- Le texte est obligatoire et non vide : un segment vide n'a pas de sens.
    if jsonb_typeof(v_segment -> 'texte') is distinct from 'string' or (v_segment ->> 'texte') = '' then
      return -1;
    end if;
    v_total := v_total + char_length(v_segment ->> 'texte');

    -- Les trois mises en forme sont des booléens.
    foreach v_champ in array array['gras', 'italique', 'souligne'] loop
      if v_segment ? v_champ and jsonb_typeof(v_segment -> v_champ) is distinct from 'boolean' then
        return -1;
      end if;
    end loop;

    if v_segment ? 'police'
       and (jsonb_typeof(v_segment -> 'police') is distinct from 'string' or (v_segment ->> 'police') = '') then
      return -1;
    end if;

    -- Taille de 6 à 72 pt.
    if v_segment ? 'taille_pt'
       and (jsonb_typeof(v_segment -> 'taille_pt') is distinct from 'number'
            or (v_segment ->> 'taille_pt')::numeric not between 6 and 72) then
      return -1;
    end if;

    -- Couleur #rrggbb.
    if v_segment ? 'couleur'
       and (jsonb_typeof(v_segment -> 'couleur') is distinct from 'string'
            or (v_segment ->> 'couleur') !~ '^#[0-9a-fA-F]{6}$') then
      return -1;
    end if;
  end loop;

  return v_total;
end;
$$;

-- Dit si un document de texte riche est bien formé : { version: 1, blocs: [...] }.
-- Un bloc est un paragraphe { type, alignement?, segments } ou une liste à puces { type, elements },
-- chaque élément étant une liste de segments. Le texte brut est limité à 400 caractères et le
-- document à 20 000 octets. null est valide : un cadre vidé de son texte.
-- La limite fine, celle qui empêche un texte de déborder de son cadre, est mesurée dans le navigateur.
create function public.contenu_texte_valide(p_contenu jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bloc jsonb;
  v_element jsonb;
  v_nombre integer;
  v_total integer := 0;
begin
  if p_contenu is null then
    return true;
  end if;

  if jsonb_typeof(p_contenu) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_contenu) as cle where cle <> all (array['version', 'blocs']))
     or p_contenu -> 'version' is distinct from '1'::jsonb
     or jsonb_typeof(p_contenu -> 'blocs') is distinct from 'array' then
    return false;
  end if;

  if octet_length(p_contenu::text) > 20000 then
    return false;
  end if;

  for v_bloc in select jsonb_array_elements(p_contenu -> 'blocs') loop
    if jsonb_typeof(v_bloc) is distinct from 'object' then
      return false;
    end if;

    case v_bloc ->> 'type'
      when 'paragraphe' then
        if exists (select 1 from jsonb_object_keys(v_bloc) as cle
                   where cle <> all (array['type', 'alignement', 'segments'])) then
          return false;
        end if;
        if v_bloc ? 'alignement'
           and coalesce(v_bloc ->> 'alignement', '') <> all (array['gauche', 'centre', 'droite']) then
          return false;
        end if;
        v_nombre := public.segments_texte_valides(v_bloc -> 'segments');
        if v_nombre < 0 then
          return false;
        end if;
        v_total := v_total + v_nombre;

      when 'liste' then
        if exists (select 1 from jsonb_object_keys(v_bloc) as cle
                   where cle <> all (array['type', 'elements'])) then
          return false;
        end if;
        if jsonb_typeof(v_bloc -> 'elements') is distinct from 'array' then
          return false;
        end if;
        for v_element in select jsonb_array_elements(v_bloc -> 'elements') loop
          v_nombre := public.segments_texte_valides(v_element);
          if v_nombre < 0 then
            return false;
          end if;
          v_total := v_total + v_nombre;
        end loop;

      else
        return false;
    end case;
  end loop;

  return v_total <= 400;
end;
$$;

-- ---------------------------------------------------------------------------
-- contenu_texte : text → jsonb
-- ---------------------------------------------------------------------------

-- L'ancien plafond de 400 caractères est repris par contenu_texte_valide.
alter table public.emplacement drop constraint emplacement_plafond_texte;

-- Convertit un ancien texte : un paragraphe par ligne, une ligne vide devient un paragraphe sans segment.
-- Un texte vide devient null. Fonction de migration, supprimée juste après : un ALTER ... USING
-- n'accepte pas de sous-requête.
create function pg_temp.texte_en_document(p_texte text)
returns jsonb
language sql
immutable
as $$
  select case
    when p_texte is null or p_texte = '' then null
    else jsonb_build_object(
      'version', 1,
      'blocs', (
        select jsonb_agg(
          jsonb_build_object(
            'type', 'paragraphe',
            'segments', case when ligne = '' then '[]'::jsonb
                             else jsonb_build_array(jsonb_build_object('texte', ligne)) end
          )
          order by rang
        )
        from unnest(string_to_array(p_texte, E'\n')) with ordinality as lignes (ligne, rang)
      )
    )
  end;
$$;

alter table public.emplacement
  alter column contenu_texte type jsonb using pg_temp.texte_en_document(contenu_texte);

alter table public.emplacement
  add constraint emplacement_contenu_texte_valide check (public.contenu_texte_valide(contenu_texte));

-- ---------------------------------------------------------------------------
-- Géométrie d'un cadre texte
-- ---------------------------------------------------------------------------

-- Déplace et redimensionne un cadre texte dans sa double page. Rien d'autre ne change :
-- le texte, le style et les autres cadres restent tels quels.
-- Une fonction plutôt qu'un droit sur les colonnes : les règles ci-dessous ne sont pas
-- des contraintes de ligne, elles regardent les autres cadres de la double page.
--   1. l'emplacement est à soi et de nature texte ;
--   2. le cadre reste à 12 mm au moins des bords de la double page (marge de sécurité) ;
--   3. il mesure au moins 20 mm sur 6 mm ;
--   4. il ne chevauche aucun autre emplacement de la même double page (les bords qui se touchent sont permis).
-- La base accepte un cadre trop petit pour son texte : le rendu le tronquera et l'éditeur le signale.
create function public.placer_cadre_texte(
  p_emplacement_id uuid,
  p_x numeric,
  p_y numeric,
  p_largeur numeric,
  p_hauteur numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emplacement public.emplacement;
  v_marge constant numeric := 12;
  v_largeur_double_page constant numeric := 420;
  v_hauteur_double_page constant numeric := 210;
begin
  select * into v_emplacement
  from public.emplacement
  where id = p_emplacement_id;

  -- Un emplacement d'un autre Créateur est « introuvable » : répondre « interdit » révélerait qu'il existe.
  if not found then
    raise exception 'introuvable' using detail = 'Emplacement introuvable';
  end if;

  -- Projet à soi, verrouillé : un déplacement attend la fin d'une opération d'ordre.
  perform public.verrouiller_projet(v_emplacement.projet_id);

  -- Les entrées sont revérifiées ici, même quand le front a déjà borné le geste.
  if p_x is null or p_y is null or p_largeur is null or p_hauteur is null then
    raise exception 'invalide' using detail = 'La position et la taille sont obligatoires';
  end if;

  if v_emplacement.nature <> 'texte' then
    raise exception 'invalide' using detail = 'Seul un cadre texte se déplace';
  end if;

  if p_largeur < 20 or p_hauteur < 6 then
    raise exception 'invalide' using detail = 'Le cadre est trop petit (20 mm sur 6 mm au minimum)';
  end if;

  if p_x < v_marge
     or p_y < v_marge
     or p_x + p_largeur > v_largeur_double_page - v_marge
     or p_y + p_hauteur > v_hauteur_double_page - v_marge then
    raise exception 'invalide' using detail = 'Le cadre sort des marges de sécurité (12 mm)';
  end if;

  -- Deux rectangles se chevauchent quand ils se recouvrent sur les deux axes.
  perform 1
  from public.emplacement
  where double_page_id = v_emplacement.double_page_id
    and id <> v_emplacement.id
    and x < p_x + p_largeur and x + largeur > p_x
    and y < p_y + p_hauteur and y + hauteur > p_y;

  if found then
    raise exception 'invalide' using detail = 'Le cadre chevauche un autre emplacement';
  end if;

  update public.emplacement
  set x = p_x, y = p_y, largeur = p_largeur, hauteur = p_hauteur
  where id = v_emplacement.id;
end;
$$;

-- Supabase accorde par défaut l'exécution de toute nouvelle fonction à anon et authenticated.
-- Les deux fonctions de validation restent appelables par authenticated : la contrainte
-- emplacement_contenu_texte_valide s'exécute avec les droits de celui qui écrit. Elles sont pures.
revoke execute on function public.segments_texte_valides(jsonb) from public, anon;
revoke execute on function public.contenu_texte_valide(jsonb) from public, anon;
grant execute on function public.segments_texte_valides(jsonb) to authenticated;
grant execute on function public.contenu_texte_valide(jsonb) to authenticated;
revoke execute on function public.placer_cadre_texte(uuid, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.placer_cadre_texte(uuid, numeric, numeric, numeric, numeric) to authenticated;
