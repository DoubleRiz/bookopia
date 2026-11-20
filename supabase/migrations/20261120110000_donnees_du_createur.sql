-- Données du Créateur : suppression du compte et fichiers orphelins.
-- Spec : docs/superpowers/specs/2026-11-20-donnees-du-createur-design.md (BK-123, BK-126)
--
-- Un fichier de Storage ne se supprime pas en SQL : le trigger storage.protect_delete refuse, et
-- même levé il n'efface que la ligne, pas les octets. Seule l'API Storage les retire. Ces deux
-- fonctions préparent donc le travail du navigateur sans clé privilégiée :
--   - supprimer_mon_compte refuse tant qu'il reste un fichier au nom du Créateur ;
--   - lister_fichiers_orphelins dit quels fichiers le navigateur peut retirer.

-- Supprime le compte du Créateur connecté : sa ligne auth.users, et en cascade sa ligne utilisateur,
-- ses livres et leur contenu (creer_tables.sql).
-- Aucun argument : le compte visé est toujours celui du jeton, aucun paramètre ne peut en désigner un autre.
-- Refuse tant qu'il reste une ligne dans storage.objects à son nom : le navigateur vide d'abord ses
-- dossiers par l'API Storage, puis appelle cette fonction. Après la suppression, ses fichiers n'auraient
-- plus de propriétaire et plus aucun moyen d'être retirés par un jeton.
-- Coût assumé : un dépôt d'un autre onglet, pris entre la vérification et la suppression, laisserait
-- un fichier sans propriétaire (Storage écrit l'objet puis sa ligne, dans sa propre transaction).
-- La fenêtre est de l'ordre de la milliseconde et SQL ne peut pas la fermer sans verrou.
-- Seuls les deux buckets du projet comptent : le navigateur ne vide que ceux-là.
-- security definer : authenticated n'a pas le droit de supprimer dans auth.users.
create function public.supprimer_mon_compte()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utilisateur_id uuid := auth.uid();
begin
  if v_utilisateur_id is null then
    raise exception 'Aucun Créateur connecté' using errcode = '42501';
  end if;

  if exists (
    select 1 from storage.objects
    where bucket_id in ('photos', 'exports')
      and name like v_utilisateur_id::text || '/%'
  ) then
    raise exception 'fichiers' using detail = 'Il reste des fichiers à supprimer avant le compte';
  end if;

  delete from auth.users where id = v_utilisateur_id;
end;
$$;

-- Liste les fichiers du Créateur connecté que plus rien ne référence, et plus anciens que 24 heures.
--   - photos : la clé du fichier (son nom sans extension, pour l'original comme pour la vignette)
--     n'est la cle_stockage d'aucune photo de ses livres ;
--   - exports : elle n'est la cle_stockage d'aucun export de ses livres.
-- Les fichiers d'un livre supprimé en font partie : sa ligne photo a disparu avec lui.
-- 24 heures : un import dépose ses fichiers avant de créer les lignes ; ce délai laisse finir
-- un import lent sans jamais retirer un fichier en cours d'envoi.
-- Le navigateur supprime les fichiers listés par l'API Storage (la règle de suppression de
-- storage.objects accepte le premier dossier égal à auth.uid()).
-- Le premier dossier se filtre par « like » sur le nom : l'index de storage.objects sert,
-- une extraction du dossier par fonction obligerait à parcourir les fichiers de tous les Créateurs.
-- security definer : authenticated ne lit pas storage.objects en entier, et la comparaison
-- doit voir toutes ses photos. Le filtre sur auth.uid() remplace la RLS.
create function public.lister_fichiers_orphelins()
returns table (bucket_id text, chemin text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_utilisateur_id uuid := auth.uid();
begin
  if v_utilisateur_id is null then
    raise exception 'Aucun Créateur connecté' using errcode = '42501';
  end if;

  return query
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id in ('photos', 'exports')
    and o.name like v_utilisateur_id::text || '/%'
    and o.created_at < now() - interval '24 hours'
    and not exists (
      select 1
      from public.projet pr
      where pr.utilisateur_id = v_utilisateur_id
        and (
          (o.bucket_id = 'photos' and exists (
            select 1 from public.photo ph
            where ph.projet_id = pr.id
              and ph.cle_stockage::text = substring(storage.filename(o.name) from '^[0-9a-f-]{36}')))
          or
          (o.bucket_id = 'exports' and exists (
            select 1 from public.export ex
            where ex.projet_id = pr.id
              and ex.cle_stockage::text = substring(storage.filename(o.name) from '^[0-9a-f-]{36}')))
        )
    );
end;
$$;

revoke execute on function public.supprimer_mon_compte() from public, anon;
revoke execute on function public.lister_fichiers_orphelins() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
grant execute on function public.lister_fichiers_orphelins() to authenticated;
