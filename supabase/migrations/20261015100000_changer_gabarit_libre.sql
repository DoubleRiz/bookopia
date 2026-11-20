-- Le Créateur peut choisir n'importe quel gabarit intérieur actif, pas seulement ceux de la famille
-- du modèle. La famille ne guide plus que le moteur de gabarits (création, composition, ajout).

-- Applique un autre gabarit à une intérieure. Rien n'est conservé : les cadres sont recréés vides,
-- les photos restent dans la réserve, les textes sont effacés. Le front prévient avant.
-- La double page garde son id et son rang.
create or replace function public.changer_gabarit(
  p_double_page_id uuid,
  p_gabarit_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_double_page public.double_page;
  v_definition jsonb;
begin
  -- Projet à soi, verrouillé, intérieure seulement : couverture et 4e se changent ailleurs.
  v_double_page := public.verrouiller_interieure(p_double_page_id);

  select definition into v_definition
  from public.gabarit
  where id = p_gabarit_id
    and actif
    and role = 'interieur';

  if not found then
    raise exception 'invalide'
      using detail = 'Le gabarit doit être un intérieur actif';
  end if;

  -- Reprendre le gabarit actuel ne vide pas la double page.
  if v_double_page.gabarit_origine_id = p_gabarit_id then
    return;
  end if;

  delete from public.emplacement
  where double_page_id = v_double_page.id;

  update public.double_page
  set gabarit_origine_id = p_gabarit_id
  where id = v_double_page.id;

  perform public.copier_geometrie(v_double_page.projet_id, v_double_page.id, v_definition);
end;
$$;
