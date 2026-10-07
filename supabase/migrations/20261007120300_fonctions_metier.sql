-- Règles métier : fonctions SQL appelées par rpc.
-- Justifications : docs/architecture.md (« Les règles métier ») et docs/modele-donnees.md (« Règles garanties par les fonctions SQL »).
--
-- Chaque fonction s'exécute dans une transaction : à la moindre erreur, rien n'est écrit.
-- Les fonctions appelables sont security definer (elles écrivent là où le navigateur ne peut pas) :
-- chacune commence donc par vérifier que le projet appartient à auth.uid().
--
-- Erreurs : le message est un code stable, traduit par le front ; le détail est pour le développeur.
--   invalide     entrée refusée
--   introuvable  absent, ou appartenant à un autre Créateur (répondre « interdit » révélerait qu'il existe)

-- ---------------------------------------------------------------------------
-- Outils internes : jamais appelables depuis le navigateur
-- ---------------------------------------------------------------------------

-- Verrouille la ligne projet jusqu'à la fin de la transaction et vérifie qu'elle appartient au Créateur.
-- Deux opérations d'ordre sur un même livre passent ainsi l'une après l'autre : sans verrou,
-- deux insertions simultanées liraient le même nombre de doubles pages et produiraient un rang en double.
create function public.verrouiller_projet(p_projet_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1
  from public.projet
  where id = p_projet_id
    and utilisateur_id = auth.uid()
  for update;

  if not found then
    raise exception 'introuvable' using detail = 'Projet introuvable';
  end if;
end;
$$;

-- Verrouille le projet d'une double page intérieure et la renvoie.
-- Le projet est vérifié avant le rôle : la double page d'un autre reste « introuvable ».
create function public.verrouiller_interieure(p_double_page_id uuid)
returns public.double_page
language plpgsql
set search_path = ''
as $$
declare
  v_double_page public.double_page;
begin
  select * into v_double_page
  from public.double_page
  where id = p_double_page_id;

  if not found then
    raise exception 'introuvable' using detail = 'Double page introuvable';
  end if;

  perform public.verrouiller_projet(v_double_page.projet_id);

  if v_double_page.role <> 'interieur' then
    raise exception 'invalide'
      using detail = 'La couverture et la 4e ne se déplacent, ne se suppriment ni ne se dupliquent';
  end if;

  return v_double_page;
end;
$$;

-- Crée une double page et copie la géométrie du gabarit dans ses emplacements.
-- Copiée, pas référencée : modifier un gabarit ne doit pas déplacer les photos d'un livre composé.
-- Interne : l'appelant a déjà vérifié le projet et choisi le rang.
create function public.creer_double_page(
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

  -- Un cadre incomplet laisse une colonne vide : les not null d'emplacement le refusent.
  insert into public.emplacement (projet_id, double_page_id, indice, nature, x, y, largeur, hauteur)
  select p_projet_id, v_double_page_id, cadre.indice, cadre.nature,
         cadre.x, cadre.y, cadre.largeur, cadre.hauteur
  from jsonb_to_recordset(v_gabarit.definition) as cadre (
    indice integer,
    nature public.nature_emplacement,
    x double precision,
    y double precision,
    largeur double precision,
    hauteur double precision
  );

  return v_double_page_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Création d'un projet
-- ---------------------------------------------------------------------------

-- Le modèle est copié dans le projet : le modifier ensuite n'affecte aucun livre existant.
-- Les gabarits des intérieures sont choisis par le moteur de gabarits du front ;
-- la fonction vérifie leur nombre, leur rôle et leur famille, puis crée tout d'un coup.
-- Un projet sans couverture ni 4e n'existe jamais.
create function public.creer_projet(
  p_titre text,
  p_modele_livre_id uuid,
  p_gabarits_interieurs_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utilisateur_id uuid := auth.uid();
  v_titre text := btrim(p_titre);
  v_modele public.modele_livre;
  v_nombre_recus integer := coalesce(cardinality(p_gabarits_interieurs_ids), 0);
  v_nombre_conformes integer;
  v_projet_id uuid;
begin
  if v_utilisateur_id is null then
    raise exception 'introuvable' using detail = 'Aucun Créateur connecté';
  end if;

  if v_titre is null or v_titre = '' then
    raise exception 'invalide' using detail = 'Le titre est obligatoire';
  end if;

  select * into v_modele
  from public.modele_livre
  where id = p_modele_livre_id
    and actif;

  if not found then
    raise exception 'introuvable' using detail = 'Modèle de livre introuvable';
  end if;

  if v_nombre_recus <> v_modele.nombre_doubles_pages_depart then
    raise exception 'invalide'
      using detail = format('Le modèle demande %s doubles pages intérieures, %s reçues',
                            v_modele.nombre_doubles_pages_depart, v_nombre_recus);
  end if;

  -- unnest garde les répétitions : un même gabarit peut servir plusieurs fois.
  select count(*) into v_nombre_conformes
  from unnest(p_gabarits_interieurs_ids) as choisi (id)
  join public.gabarit on gabarit.id = choisi.id
  where gabarit.actif
    and gabarit.role = 'interieur'
    and gabarit.famille = v_modele.famille;

  if v_nombre_conformes <> v_nombre_recus then
    raise exception 'invalide'
      using detail = format('Les gabarits intérieurs doivent être actifs et de la famille %s',
                            v_modele.famille);
  end if;

  insert into public.projet (utilisateur_id, titre, theme_id, modele_origine_id)
  values (v_utilisateur_id, v_titre, v_modele.theme_id, v_modele.id)
  returning id into v_projet_id;

  perform public.creer_double_page(v_projet_id, 'couverture', v_modele.gabarit_couverture_id, null);

  for v_rang in 1 .. v_nombre_recus loop
    perform public.creer_double_page(v_projet_id, 'interieur', p_gabarits_interieurs_ids[v_rang], v_rang);
  end loop;

  perform public.creer_double_page(v_projet_id, 'quatrieme', v_modele.gabarit_quatrieme_id, null);

  return v_projet_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordre des intérieures
-- ---------------------------------------------------------------------------
-- Les rangs vont de 1 à N sans trou. Seules ces fonctions écrivent position, toujours sous le verrou
-- du projet : chacune décale les voisines puis pose la double page concernée.

-- Insère une intérieure au rang demandé ; les suivantes reculent d'un rang.
create function public.inserer_double_page(
  p_projet_id uuid,
  p_gabarit_id uuid,
  p_position integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  perform public.verrouiller_projet(p_projet_id);

  select count(*) into v_nombre
  from public.double_page
  where projet_id = p_projet_id
    and role = 'interieur';

  if p_position is null or p_position < 1 or p_position > v_nombre + 1 then
    raise exception 'invalide'
      using detail = format('Position %s hors de 1..%s', p_position, v_nombre + 1);
  end if;

  update public.double_page
  set position = position + 1
  where projet_id = p_projet_id
    and role = 'interieur'
    and position >= p_position;

  return public.creer_double_page(p_projet_id, 'interieur', p_gabarit_id, p_position);
end;
$$;

-- Déplace une intérieure ; celles qu'elle survole glissent d'un rang vers la place libérée.
create function public.deplacer_double_page(
  p_double_page_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_double_page public.double_page := public.verrouiller_interieure(p_double_page_id);
  v_ancienne integer := v_double_page.position;
  v_nombre integer;
begin
  select count(*) into v_nombre
  from public.double_page
  where projet_id = v_double_page.projet_id
    and role = 'interieur';

  if p_position is null or p_position < 1 or p_position > v_nombre then
    raise exception 'invalide'
      using detail = format('Position %s hors de 1..%s', p_position, v_nombre);
  end if;

  if p_position < v_ancienne then
    -- Vers l'avant : les doubles pages entre la cible et l'ancienne place reculent.
    update public.double_page
    set position = position + 1
    where projet_id = v_double_page.projet_id
      and role = 'interieur'
      and position >= p_position
      and position < v_ancienne;
  elsif p_position > v_ancienne then
    -- Vers l'arrière : celles entre l'ancienne place et la cible avancent.
    update public.double_page
    set position = position - 1
    where projet_id = v_double_page.projet_id
      and role = 'interieur'
      and position > v_ancienne
      and position <= p_position;
  else
    return;
  end if;

  update public.double_page
  set position = p_position
  where id = v_double_page.id;
end;
$$;

-- Supprime une intérieure et referme le trou. Les emplacements suivent par cascade ;
-- les photos restent dans la réserve.
create function public.supprimer_double_page(p_double_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_double_page public.double_page := public.verrouiller_interieure(p_double_page_id);
begin
  delete from public.double_page
  where id = v_double_page.id;

  update public.double_page
  set position = position - 1
  where projet_id = v_double_page.projet_id
    and role = 'interieur'
    and position > v_double_page.position;
end;
$$;

-- Copie une intérieure juste après la source. La copie porte les mêmes photos et le même texte :
-- dupliquer ne copie aucun fichier.
create function public.dupliquer_double_page(p_double_page_id uuid)
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
    projet_id, double_page_id, indice, nature, x, y, largeur, hauteur,
    photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte
  )
  select projet_id, v_copie_id, indice, nature, x, y, largeur, hauteur,
         photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte
  from public.emplacement
  where double_page_id = v_source.id;

  return v_copie_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

-- Supabase accorde par défaut l'exécution de toute fonction à anon et authenticated.
-- Les outils internes et les fonctions de trigger ne doivent pas être appelables par rpc.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.est_mon_projet(uuid),
  public.creer_projet(text, uuid, uuid[]),
  public.inserer_double_page(uuid, uuid, integer),
  public.deplacer_double_page(uuid, integer),
  public.supprimer_double_page(uuid),
  public.dupliquer_double_page(uuid)
  to authenticated;
