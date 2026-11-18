# Stranger Stuff

Jeu d'arcade en PWA, écrit en HTML, CSS et JavaScript, sans bibliothèque ni étape de compilation.

## Mettre le jeu en ligne

Une PWA ne s'installe que depuis une adresse en HTTPS. Le plus simple :

1. Décompresse le fichier zip.
2. Va sur https://app.netlify.com/drop et dépose le dossier `stranger-stuff`.
3. Ouvre l'adresse obtenue sur ton téléphone.
4. Android : touche « Installer le jeu ». iPhone (Safari) : Partager, puis « Sur l'écran d'accueil ».

GitHub Pages, Cloudflare Pages ou Vercel fonctionnent aussi : ce sont de simples fichiers statiques.

## Tester sur ton ordinateur

```
cd stranger-stuff
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. Le service worker fonctionne sur `localhost` sans HTTPS.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure : canvas, barre d'informations, menus |
| `style.css` | Habillage de l'interface |
| `game.js` | Tout le jeu, commenté en français |
| `manifest.webmanifest` | Carte d'identité de l'app : nom, icônes, couleurs |
| `sw.js` | Service worker : fonctionnement hors ligne |
| `icons/` | Icônes de l'application |

## Premières modifications à essayer

- Difficulté : le tableau `LEVELS` en haut de `game.js`.
- Vitesse du héros : la constante `HERO_SPEED`.
- Couleurs de l'interface : le bloc `:root` en haut de `style.css`.

Après une modification du jeu en ligne, change `CACHE` dans `sw.js` (`v1` devient `v2`), sinon les téléphones garderont l'ancienne version.
