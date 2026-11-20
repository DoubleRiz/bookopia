-- Plafond de photos : un livre compte au plus 100 photos.
-- Spec : docs/superpowers/specs/2026-11-20-revue-rls-design.md
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@exemple.fr', '{"nom_affichage": "Alice"}');

create temporary table livre (projet_id uuid);
grant all on livre to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}', true);

insert into livre (projet_id)
select public.creer_projet('Le livre d''Alice', '00000000-0000-4000-d000-000000000001',
  array_fill('00000000-0000-4000-b000-000000000003'::uuid, array[10]));

-- Ajoute des photos au livre, empreintes numérotées de p_debut à p_fin.
create function pg_temp.ajouter_photos(p_debut integer, p_fin integer) returns void
language sql as $$
  insert into public.photo (projet_id, cle_stockage, format_vignette, nom_fichier_origine,
                            empreinte_fichier, largeur_px, hauteur_px)
  select (select projet_id from livre), gen_random_uuid(), 'webp', n || '.jpg',
         lpad(to_hex(n), 64, '0'), 4000, 3000
  from generate_series(p_debut, p_fin) n;
$$;

select lives_ok(
  'select pg_temp.ajouter_photos(1, 100)',
  'Un livre accepte 100 photos d''un coup'
);

select is(
  (select count(*) from public.photo),
  100::bigint,
  'Le livre compte 100 photos'
);

select throws_ok(
  'select pg_temp.ajouter_photos(101, 101)',
  'P0001', 'plafond',
  'La 101e photo est refusée'
);

delete from public.photo where empreinte_fichier = lpad(to_hex(100), 64, '0');

select lives_ok(
  'select pg_temp.ajouter_photos(102, 102)',
  'Supprimer une photo libère une place'
);

delete from public.photo where empreinte_fichier = lpad(to_hex(102), 64, '0');

select throws_ok(
  'select pg_temp.ajouter_photos(103, 104)',
  'P0001', 'plafond',
  'Un insert de plusieurs lignes ne dépasse pas le plafond'
);

-- Sans jeton (Studio, script de démonstration, restauration) : le plafond s'applique,
-- l'appartenance n'est pas vérifiée par le trigger, c'est le rôle de la RLS.
reset role;
select set_config('request.jwt.claims', '', true);
-- L'insert de plusieurs lignes a été annulé en entier : le livre compte toujours 99 photos.

select lives_ok(
  'select pg_temp.ajouter_photos(105, 105)',
  'Une insertion sans jeton passe sous le plafond'
);

select throws_ok(
  'select pg_temp.ajouter_photos(106, 106)',
  'P0001', 'plafond',
  'Une insertion sans jeton reste plafonnée'
);

select * from finish();
rollback;
