# SwipeClean Website

Landing page statique, prête pour GitHub Pages.

## Déployer sur GitHub Pages

Le site est servi depuis la branche **`gh-pages`**, à la racine (et *non* depuis
`main` + `/website`, contrairement à ce que ce README indiquait avant).

Ce dossier `website/` est la source de vérité : on l'édite ici, on commit sur
`main`, puis on recopie les fichiers à la racine de `gh-pages` :

```bash
git checkout gh-pages
git checkout main -- website
cp -f website/index.html website/privacy.html website/support.html website/app-ads.txt .
rm -rf website
git commit -am "deploy: <description>"
git push origin gh-pages
git checkout main
```

Site en ligne : https://xeloriom-sketch.github.io/SwipeClean/

## APK Android

L'APK est distribué via les **releases GitHub**, pas committé dans le repo.
Les deux boutons de téléchargement d'`index.html` pointent vers
`https://github.com/xeloriom-sketch/SwipeClean/releases/download/v<version>/SwipeClean-<version>.apk`.
À chaque nouvelle version : créer la release, y attacher l'APK, puis mettre à
jour les deux liens et le bloc `CL_DATA` du changelog dans `index.html`.

## Personnaliser

- **Liens App Store / Google Play** : cherche `href="#"` dans `index.html` et remplace par tes vrais liens
- **Couleurs** : modifie les variables CSS `--accent`, `--delete`, `--keep` dans `:root`
- **Texte** : tout le contenu est en HTML pur, modifiable directement
