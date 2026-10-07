-- Catalogue de départ : thèmes, gabarits, modèles de livre.
-- Rejoué par « supabase db reset ». Identifiants fixes : les tests et le front peuvent s'y référer.
--
-- Gabarits intérieurs 01 à 11 et thèmes : docs/design-system.md, sections 14 et 15.
-- Couvertures et 4e : une de chaque par famille, jamais touchées par la composition.
-- Millimètres, origine en haut à gauche de la double page (420 × 210), fonds perdus exclus.

-- ---------------------------------------------------------------------------
-- Thèmes
-- ---------------------------------------------------------------------------

insert into public.theme (id, nom, palette, rayon_angles, bordure_cadre, marge_interieure, typographie)
values
  ('00000000-0000-4000-a000-000000000001', 'Classique',
   '{"fond": "#FAF7F2", "texte": "#3E3856"}', 0, null, 0, '{
     "titre": {"police": "EB Garamond", "graisse": 500, "italique": false, "taille_pt": 18},
     "legende": {"police": "EB Garamond", "graisse": 400, "italique": true, "taille_pt": 10},
     "alignement": "centre", "ancrage": "haut", "styles_masques": []
   }'),
  ('00000000-0000-4000-a000-000000000002', 'Moderne',
   '{"fond": "#F4EFFC", "texte": "#1E1B2E"}', 0, null, 0, '{
     "titre": {"police": "Nunito", "graisse": 800, "italique": false, "taille_pt": 18},
     "legende": {"police": "Nunito", "graisse": 400, "italique": false, "taille_pt": 9},
     "alignement": "gauche", "ancrage": "haut", "styles_masques": []
   }'),
  ('00000000-0000-4000-a000-000000000003', 'Carnet',
   '{"fond": "#FFF5E6", "texte": "#2F4A80"}', 0, '{"filet_pt": 0.5}', 0, '{
     "titre": {"police": "Nunito", "graisse": 700, "italique": false, "taille_pt": 15},
     "legende": {"police": "Caveat", "graisse": 600, "italique": false, "taille_pt": 15},
     "alignement": "exterieur", "ancrage": "bas", "styles_masques": []
   }'),
  -- Silence : seul le titre de la page de titre reste visible. Sa légende n'est jamais dessinée,
  -- elle existe pour que toutes les typographies aient la même forme.
  ('00000000-0000-4000-a000-000000000004', 'Silence',
   '{"fond": "#FFFFFF", "texte": "#1E1B2E"}', 0, null, 0, '{
     "titre": {"police": "Nunito", "graisse": 600, "italique": false, "taille_pt": 14},
     "legende": {"police": "Nunito", "graisse": 400, "italique": false, "taille_pt": 9},
     "alignement": "centre", "ancrage": "haut", "styles_masques": ["titre", "legende"]
   }');

-- ---------------------------------------------------------------------------
-- Gabarits intérieurs
-- ---------------------------------------------------------------------------

insert into public.gabarit (id, nom, role, famille, definition)
values
  -- Généreux : une ou deux photos, à fond perdu sur les bords extérieurs
  ('00000000-0000-4000-b000-000000000001', 'Pleine double page', 'interieur', 'genereux', '[
    {"indice": 0, "nature": "photo", "x": 0, "y": 0, "largeur": 420, "hauteur": 210}
  ]'),
  ('00000000-0000-4000-b000-000000000002', 'Pleine page et blanc', 'interieur', 'genereux', '[
    {"indice": 0, "nature": "photo", "x": 0, "y": 0, "largeur": 200, "hauteur": 210}
  ]'),
  ('00000000-0000-4000-b000-000000000003', 'Deux pleines pages', 'interieur', 'genereux', '[
    {"indice": 0, "nature": "photo", "x": 0, "y": 0, "largeur": 200, "hauteur": 210},
    {"indice": 1, "nature": "photo", "x": 220, "y": 0, "largeur": 200, "hauteur": 210}
  ]'),
  -- Rythmé : deux à six photos dans la zone utile
  ('00000000-0000-4000-b000-000000000004', 'Duo horizontal', 'interieur', 'rythme', '[
    {"indice": 0, "nature": "photo", "x": 12, "y": 34.5, "largeur": 188, "hauteur": 141},
    {"indice": 1, "nature": "photo", "x": 220, "y": 34.5, "largeur": 188, "hauteur": 141}
  ]'),
  ('00000000-0000-4000-b000-000000000005', 'Trio', 'interieur', 'rythme', '[
    {"indice": 0, "nature": "photo", "x": 12, "y": 12, "largeur": 188, "hauteur": 186},
    {"indice": 1, "nature": "photo", "x": 220, "y": 12, "largeur": 188, "hauteur": 88},
    {"indice": 2, "nature": "photo", "x": 220, "y": 110, "largeur": 188, "hauteur": 88}
  ]'),
  ('00000000-0000-4000-b000-000000000006', 'Quatuor', 'interieur', 'rythme', '[
    {"indice": 0, "nature": "photo", "x": 84, "y": 13, "largeur": 116, "hauteur": 87},
    {"indice": 1, "nature": "photo", "x": 220, "y": 13, "largeur": 116, "hauteur": 87},
    {"indice": 2, "nature": "photo", "x": 84, "y": 110, "largeur": 116, "hauteur": 87},
    {"indice": 3, "nature": "photo", "x": 220, "y": 110, "largeur": 116, "hauteur": 87}
  ]'),
  ('00000000-0000-4000-b000-000000000007', 'Mosaïque six', 'interieur', 'rythme', '[
    {"indice": 0, "nature": "photo", "x": 113, "y": 12, "largeur": 87, "hauteur": 58},
    {"indice": 1, "nature": "photo", "x": 220, "y": 12, "largeur": 87, "hauteur": 58},
    {"indice": 2, "nature": "photo", "x": 113, "y": 76, "largeur": 87, "hauteur": 58},
    {"indice": 3, "nature": "photo", "x": 220, "y": 76, "largeur": 87, "hauteur": 58},
    {"indice": 4, "nature": "photo", "x": 113, "y": 140, "largeur": 87, "hauteur": 58},
    {"indice": 5, "nature": "photo", "x": 220, "y": 140, "largeur": 87, "hauteur": 58}
  ]'),
  -- Raconté : photos et emplacements texte
  ('00000000-0000-4000-b000-000000000008', 'Panoramique et légende', 'interieur', 'raconte', '[
    {"indice": 0, "nature": "photo", "x": 0, "y": 0, "largeur": 420, "hauteur": 140},
    {"indice": 1, "nature": "texte", "style": "titre", "x": 15, "y": 155, "largeur": 180, "hauteur": 40},
    {"indice": 2, "nature": "texte", "style": "legende", "x": 225, "y": 155, "largeur": 180, "hauteur": 40}
  ]'),
  ('00000000-0000-4000-b000-000000000009', 'Photo et bloc texte', 'interieur', 'raconte', '[
    {"indice": 0, "nature": "photo", "x": 12, "y": 12, "largeur": 188, "hauteur": 186},
    {"indice": 1, "nature": "texte", "style": "titre", "x": 240, "y": 66, "largeur": 150, "hauteur": 22},
    {"indice": 2, "nature": "texte", "style": "legende", "x": 240, "y": 96, "largeur": 150, "hauteur": 48}
  ]'),
  ('00000000-0000-4000-b000-000000000010', 'Page de titre', 'interieur', 'raconte', '[
    {"indice": 0, "nature": "photo", "x": 270, "y": 48, "largeur": 90, "hauteur": 90},
    {"indice": 1, "nature": "texte", "style": "titre_page", "x": 240, "y": 150, "largeur": 150, "hauteur": 24}
  ]'),
  ('00000000-0000-4000-b000-000000000011', 'Trio et légendes', 'interieur', 'raconte', '[
    {"indice": 0, "nature": "photo", "x": 14, "y": 30, "largeur": 186, "hauteur": 124},
    {"indice": 1, "nature": "photo", "x": 220, "y": 30, "largeur": 89, "hauteur": 124},
    {"indice": 2, "nature": "photo", "x": 319, "y": 30, "largeur": 89, "hauteur": 124},
    {"indice": 3, "nature": "texte", "style": "legende", "x": 15, "y": 162, "largeur": 180, "hauteur": 14},
    {"indice": 4, "nature": "texte", "style": "legende", "x": 225, "y": 162, "largeur": 79, "hauteur": 14},
    {"indice": 5, "nature": "texte", "style": "legende", "x": 319, "y": 162, "largeur": 81, "hauteur": 14}
  ]');

-- ---------------------------------------------------------------------------
-- Couvertures et 4e : photo de la page droite et titre ; page gauche pour le résumé
-- ---------------------------------------------------------------------------

insert into public.gabarit (id, nom, role, famille, definition)
select id::uuid, nom, role::public.role_double_page, famille, definition::jsonb
from (values
  ('00000000-0000-4000-c000-000000000001', 'Couverture', 'couverture', 'genereux'),
  ('00000000-0000-4000-c000-000000000002', 'Couverture', 'couverture', 'rythme'),
  ('00000000-0000-4000-c000-000000000003', 'Couverture', 'couverture', 'raconte')
) as couverture (id, nom, role, famille)
cross join (values ('[
  {"indice": 0, "nature": "photo", "x": 210, "y": 0, "largeur": 210, "hauteur": 150},
  {"indice": 1, "nature": "texte", "style": "titre", "x": 225, "y": 160, "largeur": 180, "hauteur": 24},
  {"indice": 2, "nature": "texte", "style": "legende", "x": 225, "y": 186, "largeur": 180, "hauteur": 12}
]')) as geometrie (definition);

insert into public.gabarit (id, nom, role, famille, definition)
select id::uuid, nom, role::public.role_double_page, famille, definition::jsonb
from (values
  ('00000000-0000-4000-c000-000000000011', 'Quatrième', 'quatrieme', 'genereux'),
  ('00000000-0000-4000-c000-000000000012', 'Quatrième', 'quatrieme', 'rythme'),
  ('00000000-0000-4000-c000-000000000013', 'Quatrième', 'quatrieme', 'raconte')
) as quatrieme (id, nom, role, famille)
cross join (values ('[
  {"indice": 0, "nature": "photo", "x": 60, "y": 30, "largeur": 90, "hauteur": 90},
  {"indice": 1, "nature": "texte", "style": "legende", "x": 15, "y": 135, "largeur": 180, "hauteur": 50}
]')) as geometrie (definition);

-- ---------------------------------------------------------------------------
-- Modèles de livre : dix intérieures, soit 20 pages
-- ---------------------------------------------------------------------------

insert into public.modele_livre (
  id, nom, theme_id, gabarit_couverture_id, gabarit_quatrieme_id,
  famille, nombre_doubles_pages_depart, cle_apercu
)
values
  ('00000000-0000-4000-d000-000000000001', 'Généreux',
   '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-c000-000000000011',
   'genereux', 10, 'modeles/genereux.jpg'),
  ('00000000-0000-4000-d000-000000000002', 'Rythmé',
   '00000000-0000-4000-a000-000000000002',
   '00000000-0000-4000-c000-000000000002', '00000000-0000-4000-c000-000000000012',
   'rythme', 10, 'modeles/rythme.jpg'),
  ('00000000-0000-4000-d000-000000000003', 'Raconté',
   '00000000-0000-4000-a000-000000000003',
   '00000000-0000-4000-c000-000000000003', '00000000-0000-4000-c000-000000000013',
   'raconte', 10, 'modeles/raconte.jpg');
