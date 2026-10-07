-- Remplissage des emplacements par la réserve, en attendant l'éditeur (L6) et le moteur de gabarits (L5).
-- Spécification : docs/superpowers/specs/2026-10-07-premier-pdf-design.md (« Remplissage »).

-- Pose les photos de la réserve qui ne sont posées nulle part dans les emplacements photo vides,
-- dans l'ordre du livre, et renvoie le nombre de photos posées.
-- Un emplacement déjà rempli n'est pas touché : le Créateur ne perd jamais un choix déjà fait.
-- Security definer comme les autres fonctions appelables : verrouiller_projet vérifie d'abord le propriétaire.
create function public.remplir_emplacements(p_projet_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_posees integer;
begin
  -- Lève « introuvable » si le livre n'est pas au Créateur. Le verrou fait passer deux clics
  -- simultanés l'un après l'autre : sans lui, la même photo pourrait être posée deux fois.
  perform public.verrouiller_projet(p_projet_id);

  with cibles as (
    -- L'énuméré role_double_page est déclaré dans l'ordre du livre : couverture, intérieures, 4e.
    -- position est vide pour la couverture et la 4e, ce qui ne gêne pas le tri : une seule de chaque.
    select emplacement.id,
           row_number() over (
             order by double_page.role, double_page.position, emplacement.indice
           ) as rang
    from public.emplacement
    join public.double_page on double_page.id = emplacement.double_page_id
    where emplacement.projet_id = p_projet_id
      and emplacement.nature = 'photo'
      and emplacement.photo_id is null
  ),
  libres as (
    -- Ordre d'import ; id départage deux photos arrivées dans la même transaction.
    select photo.id,
           row_number() over (order by photo.cree_le, photo.id) as rang
    from public.photo
    where photo.projet_id = p_projet_id
      and not exists (
        select 1 from public.emplacement where emplacement.photo_id = photo.id
      )
  )
  -- Associées rang par rang : la jointure s'arrête d'elle-même quand l'une des deux listes est épuisée.
  -- Cadrage neutre : photo centrée, sans zoom.
  update public.emplacement
  set photo_id = libres.id,
      cadrage_x = 0.5,
      cadrage_y = 0.5,
      cadrage_zoom = 1
  from cibles
  join libres on libres.rang = cibles.rang
  where emplacement.id = cibles.id;

  get diagnostics v_posees = row_count;
  return v_posees;
end;
$$;

revoke execute on function public.remplir_emplacements(uuid) from public, anon;
grant execute on function public.remplir_emplacements(uuid) to authenticated;
