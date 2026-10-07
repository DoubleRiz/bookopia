-- L'éditeur change le gabarit d'une intérieure : les cadres sont détruits et recréés vides (RG-17).
-- La copie de la géométrie sort de creer_double_page pour servir aux deux fonctions.

-- Copie la géométrie d'un gabarit dans les emplacements d'une double page, cadres vides.
-- Un cadre incomplet laisse une colonne vide : les not null d'emplacement le refusent.
-- Interne : l'appelant a déjà vérifié le projet et le gabarit.
create function public.copier_geometrie(
  p_projet_id uuid,
  p_double_page_id uuid,
  p_definition jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.emplacement (projet_id, double_page_id, indice, nature, x, y, largeur, hauteur)
  select p_projet_id, p_double_page_id, cadre.indice, cadre.nature,
         cadre.x, cadre.y, cadre.largeur, cadre.hauteur
  from jsonb_to_recordset(p_definition) as cadre (
    indice integer,
    nature public.nature_emplacement,
    x double precision,
    y double precision,
    largeur double precision,
    hauteur double precision
  );
$$;

-- Crée une double page et copie la géométrie du gabarit dans ses emplacements.
-- Copiée, pas référencée : modifier un gabarit ne doit pas déplacer les photos d'un livre composé.
-- Interne : l'appelant a déjà vérifié le projet et choisi le rang.
create or replace function public.creer_double_page(
  p_projet_id uuid,
  p_role public.role_double_page,
  p_gabarit_id uuid,
  p_position integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_gabarit public.gabarit;
  v_double_page_id uuid;
begin
  select * into v_gabarit
  from public.gabarit
  where id = p_gabarit_id
    and actif;

  if not found then
    raise exception 'introuvable' using detail = 'Gabarit introuvable';
  end if;

  if v_gabarit.role <> p_role then
    raise exception 'invalide'
      using detail = format('Un gabarit de rôle %s ne peut pas habiller une double page de rôle %s',
                            v_gabarit.role, p_role);
  end if;

  insert into public.double_page (projet_id, role, position, gabarit_origine_id)
  values (p_projet_id, p_role, p_position, v_gabarit.id)
  returning id into v_double_page_id;

  perform public.copier_geometrie(p_projet_id, v_double_page_id, v_gabarit.definition);

  return v_double_page_id;
end;
$$;

-- Applique un autre gabarit à une intérieure. Rien n'est conservé : les cadres sont recréés vides,
-- les photos restent dans la réserve, les textes sont effacés. Le front prévient avant.
-- La double page garde son id et son rang.
create function public.changer_gabarit(
  p_double_page_id uuid,
  p_gabarit_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_double_page public.double_page;
  v_famille text;
  v_definition jsonb;
begin
  -- Projet à soi, verrouillé, intérieure seulement : couverture et 4e se changent ailleurs.
  v_double_page := public.verrouiller_interieure(p_double_page_id);

  -- Le projet ne garde pas sa famille : elle vient du modèle dont il est issu.
  select modele_livre.famille into v_famille
  from public.projet
  join public.modele_livre on modele_livre.id = projet.modele_origine_id
  where projet.id = v_double_page.projet_id;

  if v_famille is null then
    raise exception 'invalide'
      using detail = 'Le modèle d''origine du livre a disparu : sa famille de gabarits est inconnue';
  end if;

  select definition into v_definition
  from public.gabarit
  where id = p_gabarit_id
    and actif
    and role = 'interieur'
    and famille = v_famille;

  if not found then
    raise exception 'invalide'
      using detail = format('Le gabarit doit être un intérieur actif de la famille %s', v_famille);
  end if;

  -- Reprendre le gabarit actuel ne vide pas la double page.
  if v_double_page.gabarit_origine_id = p_gabarit_id then
    return;
  end if;

  delete from public.emplacement
  where double_page_id = v_double_page.id;

  update public.double_page
  set gabarit_origine_id = p_gabarit_id
  where id = v_double_page.id;

  perform public.copier_geometrie(v_double_page.projet_id, v_double_page.id, v_definition);
end;
$$;

-- Supabase accorde par défaut l'exécution de toute nouvelle fonction à anon et authenticated.
revoke execute on function public.copier_geometrie(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.changer_gabarit(uuid, uuid) from public, anon;
grant execute on function public.changer_gabarit(uuid, uuid) to authenticated;
