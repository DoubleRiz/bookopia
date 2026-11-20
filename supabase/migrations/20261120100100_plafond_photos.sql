-- Plafond : un livre compte au plus 100 photos.
-- Spec : docs/superpowers/specs/2026-11-20-revue-rls-design.md
--
-- Pourquoi 100 : l'offre gratuite de Supabase donne 1 Go de fichiers pour tout le projet,
-- et un livre plein occupe déjà 350 à 550 Mo (originaux, vignettes, PDF).
-- L'import vérifie aussi le plafond avant de déposer les fichiers (PHOTOS_PAR_LIVRE_MAX
-- dans packages/shared) ; la base reste la garantie.

-- Refuse la photo qui dépasserait le plafond de son livre.
-- Le livre est verrouillé avant de compter : deux imports simultanés du même livre
-- passent l'un après l'autre, et ne peuvent pas dépasser 100 à eux deux.
-- Le verrou se pose par l'id seul : l'appartenance du livre reste vérifiée par la RLS,
-- qui passe après les triggers. Une insertion sans jeton (Studio, script de démonstration,
-- restauration) reste ainsi possible, et plafonnée.
-- security definer : authenticated n'a pas le droit de verrouiller une ligne de projet.
create function public.verifier_plafond_photos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.projet where id = new.projet_id for update;

  if (select count(*) from public.photo where projet_id = new.projet_id) >= 100 then
    raise exception 'plafond' using detail = 'Un livre compte au plus 100 photos';
  end if;

  return new;
end;
$$;

revoke execute on function public.verifier_plafond_photos() from public, anon, authenticated;

create trigger verifier_plafond_photos
  before insert on public.photo
  for each row execute function public.verifier_plafond_photos();
