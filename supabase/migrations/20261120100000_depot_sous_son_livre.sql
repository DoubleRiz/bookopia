-- Dépôt de fichiers : le deuxième dossier doit être un livre du Créateur.
-- Spec : docs/superpowers/specs/2026-11-20-revue-rls-design.md
--
--   photos/{utilisateur_id}/{projet_id}/…
--   exports/{utilisateur_id}/{projet_id}/…
--
-- Avant, seule la première partie était vérifiée : un Créateur pouvait déposer
-- sous n'importe quel projet_id, celui d'un autre ou un identifiant inventé.

drop policy "Un créateur dépose ses fichiers" on storage.objects;

-- Le deuxième dossier est converti en uuid seulement s'il en a la forme.
-- Un « and » ne suffirait pas : PostgreSQL ne garantit pas l'ordre d'évaluation
-- des conditions, et le cast d'un texte quelconque lèverait 22P02 au lieu de refuser.
-- L'expression régulière ignore la casse, comme PostgreSQL pour un uuid.
--
-- La lecture et la suppression ne vérifient que le premier dossier : les fichiers
-- d'un livre supprimé doivent rester lisibles et supprimables par leur Créateur,
-- pour la purge (BK-126) et la suppression du compte (BK-123).
create policy "Un créateur dépose ses fichiers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('photos', 'exports')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and case
      when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
        then public.est_mon_projet(((storage.foldername(name))[2])::uuid)
      else false
    end
  );
