-- Fichiers : deux buckets privés et leurs règles d'accès.
-- Justifications : docs/architecture.md (« Les fichiers »).
--
--   photos/{utilisateur_id}/{projet_id}/originaux/{cle}.jpg
--   photos/{utilisateur_id}/{projet_id}/vignettes/{cle}.webp (ou .jpg)
--   exports/{utilisateur_id}/{projet_id}/{cle}.pdf
--
-- Le premier dossier est le propriétaire : chaque règle vérifie qu'il vaut auth.uid().

-- Taille maximale et types acceptés fixés ici : Storage refuse le reste avant toute écriture.
-- Un original est réduit à ce qu'exigent 300 DPI sur le plus grand cadre (420 × 210 mm) : quelques Mo.
-- Les PDF sont bornés par la limite globale de Storage (50 Mo en local comme sur l'offre gratuite).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 20 * 1024 * 1024, array['image/jpeg', 'image/webp']),
  ('exports', 'exports', false, 50 * 1024 * 1024, array['application/pdf']);

create policy "Un créateur lit ses fichiers"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('photos', 'exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un créateur dépose ses fichiers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('photos', 'exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Un créateur supprime ses fichiers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('photos', 'exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Pas de règle de modification : chaque dépôt prend une clé neuve, un fichier ne se réécrit jamais.
