-- Couverture éditée dans l'éditeur (L6, 6d) : le titre du livre reste visible sous le thème Silence.
-- Le thème masque des styles, pas des rôles : le cadre titre de la couverture prend donc le style
-- titre_page, le seul que Silence laisse visible, et s'écrit avec la typographie d'un titre.

-- Les gabarits de couverture : le cadre titre (indice 1) devient titre_page.
update public.gabarit
set definition = (
  select jsonb_agg(
    case when cadre ->> 'style' = 'titre' then jsonb_set(cadre, '{style}', '"titre_page"') else cadre end
    order by (cadre ->> 'indice')::integer
  )
  from jsonb_array_elements(definition) as cadre
)
where role = 'couverture';

-- Les couvertures des livres existants, qui ont copié l'ancien style.
update public.emplacement
set style_texte = 'titre_page'
from public.double_page
where emplacement.double_page_id = double_page.id
  and double_page.role = 'couverture'
  and emplacement.style_texte = 'titre';
