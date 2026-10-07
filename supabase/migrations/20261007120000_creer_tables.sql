-- Tables, énumérés et contraintes du modèle de données.
-- Justifications : docs/modele-donnees.md.

create type public.role_double_page as enum ('couverture', 'interieur', 'quatrieme');
create type public.nature_emplacement as enum ('photo', 'texte');
create type public.source_photo as enum ('upload', 'google_photos');
create type public.format_vignette as enum ('webp', 'jpeg');

-- ---------------------------------------------------------------------------
-- Catalogue : lu par tous, écrit seulement par seed.sql
-- ---------------------------------------------------------------------------

create table public.theme (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  police_titre text not null,
  police_texte text not null,
  palette jsonb not null,
  rayon_angles double precision not null,
  bordure_cadre jsonb,
  marge_interieure double precision not null,
  actif boolean not null default true
);

-- definition : tableau de cadres { indice, x, y, largeur, hauteur, nature }, en millimètres.
-- Un cadre incomplet fait échouer creer_double_page sur les contraintes d'emplacement.
create table public.gabarit (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  role public.role_double_page not null,
  famille text not null,
  definition jsonb not null check (jsonb_typeof(definition) = 'array'),
  actif boolean not null default true
);

create index gabarit_role_famille_idx on public.gabarit (role, famille);

create table public.modele_livre (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  theme_id uuid not null references public.theme (id) on delete restrict,
  gabarit_couverture_id uuid not null references public.gabarit (id) on delete restrict,
  gabarit_quatrieme_id uuid not null references public.gabarit (id) on delete restrict,
  famille text not null,
  nombre_doubles_pages_depart integer not null check (nombre_doubles_pages_depart >= 1),
  cle_apercu text not null,
  actif boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Données d'un Créateur
-- ---------------------------------------------------------------------------

-- Même identifiant que auth.users : auth.uid() désigne directement la ligne.
-- Supprimer le compte supprime en cascade la ligne, ses projets et leur contenu.
create table public.utilisateur (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_affichage text not null check (char_length(btrim(nom_affichage)) between 1 and 80),
  cree_le timestamptz not null default now()
);

create table public.projet (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.utilisateur (id) on delete cascade,
  titre text not null check (char_length(btrim(titre)) >= 1),
  -- Référencé, pas copié : corriger un thème profite à tous les livres. Un thème utilisé se désactive.
  theme_id uuid not null references public.theme (id) on delete restrict,
  brouillon boolean not null default true,
  -- Informatif : le modèle a été copié à la création, sa disparition ne touche pas le livre.
  modele_origine_id uuid references public.modele_livre (id) on delete set null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create index projet_utilisateur_id_modifie_le_idx on public.projet (utilisateur_id, modifie_le desc);

create table public.photo (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projet (id) on delete cascade,
  -- Tiré par le navigateur : les fichiers sont déposés avant la création de la ligne.
  cle_stockage uuid not null unique,
  format_vignette public.format_vignette not null,
  nom_fichier_origine text not null check (char_length(nom_fichier_origine) >= 1),
  -- SHA-256 du fichier d'origine, en hexadécimal.
  empreinte_fichier text not null check (empreinte_fichier ~ '^[0-9a-f]{64}$'),
  largeur_px integer not null check (largeur_px > 0),
  hauteur_px integer not null check (hauteur_px > 0),
  prise_le timestamptz,
  source_type public.source_photo not null default 'upload',
  cree_le timestamptz not null default now(),
  -- Bloque les doublons stricts dans un même livre.
  unique (projet_id, empreinte_fichier),
  -- Cible de la clé étrangère composée d'emplacement : la photo posée vient du même projet.
  unique (projet_id, id)
);

-- Au plus un par projet : le dernier PDF réussi. La ligne n'est écrite qu'une fois le PDF déposé.
create table public.export (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null unique references public.projet (id) on delete cascade,
  cle_stockage uuid not null,
  cree_le timestamptz not null default now()
);

create table public.double_page (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references public.projet (id) on delete cascade,
  role public.role_double_page not null,
  -- Rang des intérieures, de 1 à N sans trou. Pas d'unicité : une renumérotation passe
  -- brièvement par des rangs en double. Les fonctions d'ordre garantissent l'invariant.
  position integer check (position >= 1),
  gabarit_origine_id uuid references public.gabarit (id) on delete set null,
  cree_le timestamptz not null default now(),
  -- Seules les intérieures sont ordonnées ; couverture et 4e n'ont pas de rang.
  constraint double_page_position_selon_role check ((position is null) = (role <> 'interieur')),
  -- Cible de la clé étrangère composée d'emplacement : l'emplacement suit le projet de sa double page.
  unique (projet_id, id)
);

create index double_page_projet_id_position_idx on public.double_page (projet_id, position);

-- Une seule couverture et une seule 4e par projet. Les intérieures ne sont pas concernées.
create unique index double_page_projet_id_role_hors_interieur_key
  on public.double_page (projet_id, role)
  where role <> 'interieur';

create table public.emplacement (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null,
  double_page_id uuid not null,
  -- Géométrie et nature copiées du gabarit : modifier le gabarit ne déplace rien dans ce livre.
  indice integer not null check (indice >= 0),
  nature public.nature_emplacement not null,
  x double precision not null,
  y double precision not null,
  largeur double precision not null check (largeur > 0),
  hauteur double precision not null check (hauteur > 0),
  photo_id uuid,
  cadrage_x double precision,
  cadrage_y double precision,
  cadrage_zoom double precision,
  contenu_texte text,
  unique (double_page_id, indice),
  foreign key (projet_id, double_page_id)
    references public.double_page (projet_id, id) on delete cascade,
  -- La photo vient du même projet. Supprimer la photo vide l'emplacement sans toucher à projet_id.
  foreign key (projet_id, photo_id)
    references public.photo (projet_id, id) on delete set null (photo_id),
  -- Une table pour deux natures : les champs de l'autre nature restent vides.
  -- Pour une photo, les trois valeurs du cadrage vont ensemble, et une photo posée en exige un.
  -- Un emplacement vidé peut garder son ancien cadrage : écrasé à la pose suivante.
  constraint emplacement_coherence_nature check (
    case nature
      when 'texte' then
        photo_id is null
        and cadrage_x is null and cadrage_y is null and cadrage_zoom is null
      when 'photo' then
        contenu_texte is null
        and (cadrage_x is null) = (cadrage_y is null)
        and (cadrage_x is null) = (cadrage_zoom is null)
        and (photo_id is null or cadrage_x is not null)
    end
  ),
  -- Cadrage normalisé : centre visible entre 0 et 1, zoom d'au moins 1.
  constraint emplacement_bornes_cadrage check (
    cadrage_x between 0 and 1
    and cadrage_y between 0 and 1
    and cadrage_zoom >= 1
  )
);

create index emplacement_projet_id_idx on public.emplacement (projet_id);
create index emplacement_projet_id_photo_id_idx on public.emplacement (projet_id, photo_id);
