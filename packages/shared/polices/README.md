# Polices des livres

Les polices des thèmes (design system, § 15). Les mêmes fichiers servent à l'écran, à la mesure des textes et au PDF : c'est ce qui garantit que les lignes se coupent au même endroit des deux côtés.

| Fichier | Police |
|---|---|
| `eb-garamond-500.ttf` | EB Garamond 500 |
| `eb-garamond-400-italique.ttf` | EB Garamond 400 italique |
| `nunito-400.ttf` à `nunito-800.ttf` | Nunito 400, 600, 700, 800 |
| `caveat-600.ttf` | Caveat 600 |
| `montserrat-*`, `lora-*`, `playfair-display-*` | 400 et 700, droit et italique |
| `dancing-script-400.ttf`, `dancing-script-700.ttf` | Dancing Script 400, 700 |
| `courier-prime-*` | Courier Prime 400 et 700, droit et italique |
| `great-vibes-400`, `allura-400`, `parisienne-400`, `sacramento-400`, `alex-brush-400` | Scripts attachés, une seule graisse |

Licence SIL Open Font License 1.1 : `OFL-*.txt`.

## Origine

Instances statiques des polices variables de [google/fonts](https://github.com/google/fonts) (`ofl/ebgaramond`, `ofl/nunito`, `ofl/caveat`, `ofl/montserrat`, `ofl/lora`, `ofl/playfairdisplay`, `ofl/dancingscript`, `ofl/courierprime`, `ofl/greatvibes`, `ofl/allura`, `ofl/parisienne`, `ofl/sacramento`, `ofl/alexbrush`), réduites au sous-ensemble latin de Google Fonts. Produites une fois avec [fonttools](https://github.com/fonttools/fonttools), qui n'est pas une dépendance du projet :

```bash
fonttools varLib.instancer "Nunito[wght].ttf" wght=600 -o instance.ttf
pyftsubset instance.ttf --output-file=nunito-600.ttf --layout-features='*' --no-hinting --desubroutinize \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
```

Pas de TTF de remplacement : les polices sont intégrées telles quelles au PDF, en sous-ensemble.
