# CrackGames Studio 🎮🛠️

Logiciel de bureau (Windows) **réservé aux développeurs** pour créer les niveaux de
*La grande course* : on place les plateformes en 3D (déplacer / tourner / étirer sur
les axes X, Y, Z), puis on **publie directement dans la base** du site, avec activation
en live. Réutilise exactement le moteur du jeu, donc l'aperçu = le rendu réel.

> Ce dossier vit dans le dépôt `CrackGamesLive` (il a besoin de `../src` pour rester
> synchro avec le moteur du jeu). Toi et ton collègue l'obtenez via `git pull`.

## 1. Préparer la clé côté site (une fois)

Dans le fichier **`.env`** du site (à la racine de `CrackGamesLive`), ajoute une ligne
avec une clé secrète que vous choisissez tous les deux (longue, aléatoire) :

```
STUDIO_API_KEY=colle-ici-une-longue-cle-secrete-partagee
```

Redémarre le site (`npm run dev`) pour qu'il prenne la clé en compte. Cette clé permet au
studio d'écrire dans la base sans passer par le login web. **Ne la mets pas sur GitHub**
(`.env` est déjà ignoré par git).

## 2. Lancer le studio (mode développement)

Dans un terminal, depuis le dossier `studio/` :

```bash
npm install      # installe electron + three (une seule fois)
npm start        # ouvre l'application
```

Au premier lancement, clique sur ⚙ et renseigne :
- **URL du site** : `http://localhost:3000` (ton site en local) — ou l'URL en ligne plus tard.
- **Clé studio** : exactement la même que `STUDIO_API_KEY` dans le `.env`.

« Tester la connexion » doit afficher *Connexion réussie ✓*. Les niveaux apparaissent à gauche.

## 3. Créer un vrai .exe installable

```bash
npm run dist:win
```

L'installateur est généré dans `studio/dist/` (ex : `CrackGames Studio Setup 0.1.0.exe`).
Double-clic pour l'installer comme un logiciel classique. (Le build se fait sur une machine
Windows.)

## Utilisation

- **Gauche** : liste des niveaux (créer, charger, activer en live, supprimer).
- **Barre du haut de la scène** : ajouter Plateforme / Départ / Arrivée / Mur, choisir
  l'outil *Déplacer / Tourner / Étirer*, aimant (grille), dupliquer, supprimer, tout voir.
- **Clic** sur une plateforme pour la sélectionner, puis tirer le gizmo (X rouge, Y vert,
  Z bleu). Panneau de droite pour les valeurs exactes (position, taille, rotation, couleur).
- **Raccourcis** : `W`/`E`/`R` (outils), `F` (centrer), `D` (dupliquer), `Suppr`, `Ctrl+S` (enregistrer).
- **▶ Tester** : lance les billes sur ton circuit (aperçu réel).
- **Enregistrer** / **Activer en live** : écrit dans la base du site. Un niveau « Activé »
  est celui joué dans les overlays.

Chaque niveau doit avoir **une plateforme Départ** (les billes y apparaissent) et **une
plateforme Arrivée**.

## À venir

Structuré pour accueillir ensuite : décors, skins de billes, thèmes, etc.
