-- L'éditeur ajoute des doubles pages une à une : le gabarit doit être de la famille du livre,
-- comme pour composer_livre. creer_double_page vérifie déjà qu'il est actif et de rôle interieur.

-- Insère une intérieure au rang demandé ; les suivantes reculent d'un rang.
create or replace function public.inserer_double_page(
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
  v_famille text;
begin
  perform public.verrouiller_projet(p_projet_id);

  -- Le projet ne garde pas sa famille : elle vient du modèle dont il est issu.
  select modele_livre.famille into v_famille
  from public.projet
  join public.modele_livre on modele_livre.id = projet.modele_origine_id
  where projet.id = p_projet_id;

  if v_famille is null then
    raise exception 'invalide'
      using detail = 'Le modèle d''origine du livre a disparu : sa famille de gabarits est inconnue';
  end if;

  if not exists (
    select 1 from public.gabarit
    where id = p_gabarit_id and famille = v_famille
  ) then
    raise exception 'invalide'
      using detail = format('Le gabarit doit être de la famille %s', v_famille);
  end if;

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
