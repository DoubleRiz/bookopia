-- Autorisation : RLS sur chaque table, et droits accordés colonne par colonne.
-- Justifications : docs/architecture.md (« L'autorisation : les RLS ») et docs/modele-donnees.md (« Droits par colonne »).
--
-- Deux couches :
--   1. les droits (grant) disent quelles opérations et quelles colonnes un rôle peut toucher ;
--   2. la RLS dit sur quelles lignes.
-- anon = visiteur, authenticated = Créateur connecté.

-- ---------------------------------------------------------------------------
-- Droits : on part de rien, puis on accorde
-- ---------------------------------------------------------------------------

-- Supabase accorde par défaut tous les droits sur public à anon et authenticated.
revoke all on all tables in schema public from anon, authenticated;

-- Catalogue
grant select on public.modele_livre to anon, authenticated;
grant select on public.theme, public.gabarit to authenticated;

-- Données d'un Créateur
grant select on
  public.utilisateur, public.projet, public.double_page,
  public.emplacement, public.photo, public.export
  to authenticated;

grant update (nom_affichage) on public.utilisateur to authenticated;

-- Création par creer_projet seulement : un projet sans couverture ni 4e ne doit pas exister.
grant update (titre, brouillon), delete on public.projet to authenticated;

-- double_page : aucune écriture directe, tout passe par les fonctions d'ordre.

-- La géométrie et la nature restent celles copiées du gabarit.
grant update (photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte)
  on public.emplacement to authenticated;

grant insert (
  projet_id, cle_stockage, format_vignette, nom_fichier_origine,
  empreinte_fichier, largeur_px, hauteur_px, prise_le, source_type
), delete on public.photo to authenticated;

-- Remplacement par upsert sur projet_id ; cree_le est posé par trigger.
-- L'upsert de supabase-js réécrit toutes les colonnes envoyées, projet_id compris : d'où update (projet_id).
grant insert (projet_id, cle_stockage), update (projet_id, cle_stockage), delete
  on public.export to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.theme enable row level security;
alter table public.gabarit enable row level security;
alter table public.modele_livre enable row level security;
alter table public.utilisateur enable row level security;
alter table public.projet enable row level security;
alter table public.photo enable row level security;
alter table public.export enable row level security;
alter table public.double_page enable row level security;
alter table public.emplacement enable row level security;

-- La même vérification pour toutes les tables d'un projet : elles portent toutes projet_id.
-- security definer : lire projet sans repasser par sa propre RLS.
-- (select auth.uid()) est évalué une fois par requête, pas une fois par ligne.
create function public.est_mon_projet(p_projet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projet
    where id = p_projet_id
      and utilisateur_id = (select auth.uid())
  );
$$;

revoke execute on function public.est_mon_projet(uuid) from public, anon;
grant execute on function public.est_mon_projet(uuid) to authenticated;

-- Catalogue

create policy "Tout le monde voit les modèles de livre"
  on public.modele_livre for select
  to anon, authenticated
  using (true);

create policy "Un créateur voit les thèmes"
  on public.theme for select
  to authenticated
  using (true);

create policy "Un créateur voit les gabarits"
  on public.gabarit for select
  to authenticated
  using (true);

-- utilisateur

create policy "Un créateur voit sa ligne"
  on public.utilisateur for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Un créateur modifie sa ligne"
  on public.utilisateur for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projet

create policy "Un créateur voit ses livres"
  on public.projet for select
  to authenticated
  using (utilisateur_id = (select auth.uid()));

create policy "Un créateur modifie ses livres"
  on public.projet for update
  to authenticated
  using (utilisateur_id = (select auth.uid()))
  with check (utilisateur_id = (select auth.uid()));

create policy "Un créateur supprime ses livres"
  on public.projet for delete
  to authenticated
  using (utilisateur_id = (select auth.uid()));

-- double_page

create policy "Un créateur voit les doubles pages de ses livres"
  on public.double_page for select
  to authenticated
  using (public.est_mon_projet(projet_id));

-- emplacement

create policy "Un créateur voit les emplacements de ses livres"
  on public.emplacement for select
  to authenticated
  using (public.est_mon_projet(projet_id));

create policy "Un créateur modifie les emplacements de ses livres"
  on public.emplacement for update
  to authenticated
  using (public.est_mon_projet(projet_id))
  with check (public.est_mon_projet(projet_id));

-- photo

create policy "Un créateur voit les photos de ses livres"
  on public.photo for select
  to authenticated
  using (public.est_mon_projet(projet_id));

create policy "Un créateur ajoute des photos à ses livres"
  on public.photo for insert
  to authenticated
  with check (public.est_mon_projet(projet_id));

create policy "Un créateur supprime les photos de ses livres"
  on public.photo for delete
  to authenticated
  using (public.est_mon_projet(projet_id));

-- export

create policy "Un créateur voit l'export de ses livres"
  on public.export for select
  to authenticated
  using (public.est_mon_projet(projet_id));

create policy "Un créateur crée l'export de ses livres"
  on public.export for insert
  to authenticated
  with check (public.est_mon_projet(projet_id));

create policy "Un créateur remplace l'export de ses livres"
  on public.export for update
  to authenticated
  using (public.est_mon_projet(projet_id))
  with check (public.est_mon_projet(projet_id));

create policy "Un créateur supprime l'export de ses livres"
  on public.export for delete
  to authenticated
  using (public.est_mon_projet(projet_id));
