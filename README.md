# Stranger Stuff

**[English](#english) · [Français](#français)**

▶ **Play: https://mathieu777.github.io/stranger-stuff/**

---

## English

A retro 80s arcade game, built as a Progressive Web App (PWA). Millbrook, November 1986: the dead have taken over the town. Cross five neighbourhoods to reach the radio station and call for help, using only a flashlight.

Written in plain HTML, CSS and JavaScript, with no library and no build step.

### How to play

- **Move:** drag your finger anywhere on the screen (keyboard: arrow keys).
- **Flashlight:** hold the Light button to freeze zombies (keyboard: space). The battery drains fast.
- **Collect:** tapes for points, batteries to recharge the flashlight.
- **In every neighbourhood:** find the police officer for 500 bonus points, and the Nova orb, which blows up everything around you.
- **Zombies:** walkers, runners (pink eyes) and brutes (they resist light longer).

### Install it on your phone

- **Android (Chrome):** tap “Installer le jeu”, or open the ⋮ menu, then “Add to home screen”.
- **iPhone (Safari):** tap Share, then “Add to Home Screen”.

Once installed, the game works offline.

### Run it locally

```
git clone https://github.com/mathieu777/stranger-stuff.git
cd stranger-stuff
python3 -m http.server 8000
```

Then open http://localhost:8000. The service worker runs on `localhost` without HTTPS.

### Files

| File | Role |
| --- | --- |
| `index.html` | Structure: canvas, status bar, menus |
| `style.css` | Interface styling |
| `game.js` | The whole game (comments in French) |
| `manifest.webmanifest` | App identity: name, icons, colours |
| `sw.js` | Service worker: offline support |
| `icons/` | App icons |

### First changes to try

- Difficulty: the `LEVELS` table at the top of `game.js`.
- Hero speed: the `HERO_SPEED` constant.
- Bonuses: `COP_POINTS`, `NOVA_RADIUS` and `NOVA_POINTS`.
- Interface colours: the `:root` block at the top of `style.css`.

### Publish a change

The site is served by GitHub Pages from the `main` branch.

1. Edit the files.
2. In `sw.js`, bump the `CACHE` version (for example `v2` → `v3`), otherwise installed phones keep the old version.
3. Commit and push:

```
git add .
git commit -m "Describe your change"
git push
```

The site updates about a minute after the push.

---

## Français

Un jeu d'arcade rétro années 80, en Progressive Web App (PWA). Millbrook, novembre 1986 : les morts ont envahi la ville. Traverse cinq quartiers jusqu'à la station de radio pour appeler les secours, armé d'une simple lampe torche.

Écrit en HTML, CSS et JavaScript, sans bibliothèque ni étape de compilation.

### Comment jouer

- **Marcher :** glisse ton doigt n'importe où sur l'écran (clavier : flèches).
- **Lampe :** maintiens le bouton Lampe pour figer les zombies (clavier : espace). La batterie se vide vite.
- **À ramasser :** les cassettes pour les points, les piles pour recharger la lampe.
- **Dans chaque quartier :** trouve le policier pour 500 points bonus, et l'orbe Nova, qui fait tout exploser autour de toi.
- **Zombies :** marcheurs, coureurs (yeux roses) et brutes (ils résistent plus longtemps à la lumière).

### L'installer sur ton téléphone

- **Android (Chrome) :** touche « Installer le jeu », ou ouvre le menu ⋮ puis « Ajouter à l'écran d'accueil ».
- **iPhone (Safari) :** touche Partager, puis « Sur l'écran d'accueil ».

Une fois installé, le jeu fonctionne hors ligne.

### Le lancer sur ton ordinateur

```
git clone https://github.com/mathieu777/stranger-stuff.git
cd stranger-stuff
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000. Le service worker fonctionne sur `localhost` sans HTTPS.

### Les fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure : canvas, barre d'informations, menus |
| `style.css` | Habillage de l'interface |
| `game.js` | Tout le jeu, commenté en français |
| `manifest.webmanifest` | Carte d'identité de l'app : nom, icônes, couleurs |
| `sw.js` | Service worker : fonctionnement hors ligne |
| `icons/` | Icônes de l'application |

### Premières modifications à essayer

- Difficulté : le tableau `LEVELS` en haut de `game.js`.
- Vitesse du héros : la constante `HERO_SPEED`.
- Bonus : `COP_POINTS`, `NOVA_RADIUS` et `NOVA_POINTS`.
- Couleurs de l'interface : le bloc `:root` en haut de `style.css`.

### Publier une modification

Le site est servi par GitHub Pages depuis la branche `main`.

1. Modifie les fichiers.
2. Dans `sw.js`, augmente la version de `CACHE` (par exemple `v2` devient `v3`), sinon les téléphones garderont l'ancienne version.
3. Enregistre et envoie :

```
git add .
git commit -m "Décris ta modification"
git push
```

Le site se met à jour environ une minute après le push.
