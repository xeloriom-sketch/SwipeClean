#!/usr/bin/env bash
# scripts/publish-ota.sh — publie un bundle OTA pour plusieurs runtimes.
#
# `runtimeVersion.policy` vaut "appVersion": le runtime cible d'un `eas update` est
# lu dans `app.json`, et `eas update` n'offre aucun drapeau pour le forcer. Publier
# pour un binaire plus ancien demande donc de changer `version` le temps de la
# commande — a la main, c'est l'oubli de restauration qui guette, et une version
# faussee partie dans un commit.
#
#   ./scripts/publish-ota.sh "message" 1.0.14 1.0.17 1.0.19
#
# La version d'origine est restauree quoi qu'il arrive (trap EXIT), et le script
# refuse de tourner si `app.json` est deja modifie: il ne doit jamais y avoir de
# doute sur ce qu'il remet en place.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 2 ]; then
  echo "usage: $0 \"message\" <runtime> [runtime...]" >&2
  exit 64
fi

MESSAGE="$1"
shift
RUNTIMES=("$@")
CHANNEL="${OTA_CHANNEL:-production}"

if ! git diff --quiet -- app.json; then
  echo "app.json a des modifications non commitees — commit ou stash d'abord." >&2
  exit 1
fi

ORIGINAL_VERSION="$(node -p 'require("./app.json").expo.version')"
echo "version d'origine: $ORIGINAL_VERSION — canal: $CHANNEL"

# `git checkout` plutot qu'une reecriture: on recupere le fichier au byte pres, sans
# dependre du formatage que produirait `JSON.stringify` (le script a verifie plus haut
# qu'il n'y avait rien a perdre).
restore() {
  git checkout -- app.json
  echo "app.json restaure en $ORIGINAL_VERSION"
}
trap restore EXIT

for rt in "${RUNTIMES[@]}"; do
  echo
  echo "=== runtime $rt ==="
  node -e '
    const fs = require("fs");
    const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
    app.expo.version = process.argv[1];
    fs.writeFileSync("app.json", JSON.stringify(app, null, 2) + "\n");
  ' "$rt"
  npx eas-cli update \
    --channel "$CHANNEL" \
    --message "$MESSAGE (runtime $rt)" \
    --non-interactive
done
