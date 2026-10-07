-- Triggers : automatismes mécaniques seulement. Une règle métier passe par une fonction appelée explicitement.

-- ---------------------------------------------------------------------------
-- Ligne utilisateur créée à l'inscription
-- ---------------------------------------------------------------------------

-- Le nom d'affichage arrive dans les métadonnées de signUp. À défaut (compte créé depuis Studio),
-- la partie locale de l'email évite de faire échouer l'inscription.
-- security definer : le rôle d'Auth qui insère dans auth.users n'a aucun droit sur public.
create function public.creer_utilisateur_a_l_inscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.utilisateur (id, nom_affichage)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'nom_affichage'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger creer_utilisateur
  after insert on auth.users
  for each row execute function public.creer_utilisateur_a_l_inscription();

-- ---------------------------------------------------------------------------
-- projet.modifie_le, tenu à chaque écriture dans le projet ou son contenu
-- ---------------------------------------------------------------------------

create function public.dater_modification_projet()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

create trigger dater_modification
  before update on public.projet
  for each row execute function public.dater_modification_projet();

-- security definer : le navigateur n'a pas le droit d'écrire modifie_le, mais ses écritures
-- dans le contenu doivent le faire avancer.
-- L'export n'est pas suivi : « exporté et à jour » compare export.cree_le à projet.modifie_le.
create function public.signaler_modification_contenu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.projet
  set modifie_le = now()
  where id = coalesce(new.projet_id, old.projet_id);
  return null;
end;
$$;

create trigger signaler_modification
  after insert or update or delete on public.double_page
  for each row execute function public.signaler_modification_contenu();

create trigger signaler_modification
  after insert or update or delete on public.emplacement
  for each row execute function public.signaler_modification_contenu();

create trigger signaler_modification
  after insert or update or delete on public.photo
  for each row execute function public.signaler_modification_contenu();

-- ---------------------------------------------------------------------------
-- export.cree_le, remis à l'heure quand la ligne est remplacée
-- ---------------------------------------------------------------------------

-- La date vient de la base, pas de l'horloge du navigateur.
create function public.dater_export()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cree_le := now();
  return new;
end;
$$;

create trigger dater_export
  before insert or update on public.export
  for each row execute function public.dater_export();
