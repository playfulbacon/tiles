# Hex Lands

A turn-based hex tile laying game that runs entirely in the browser — no build
step, no dependencies. Players take turns drawing a tile from a shuffled deck
and dragging it onto the board to grow a shared landscape.

**Current version: v0.1.0**

## How to play

1. On the title screen, choose how many players are at the table (1–6).
2. On each turn the top tile is drawn automatically and appears above the deck
   at the bottom of the screen.
3. Press and drag that tile onto the board, then release to place it.
   - The **first** tile of the game can go anywhere.
   - Every tile after that must touch a tile already on the board. Valid spots
     are outlined while you drag.
   - Release somewhere invalid and the tile returns above the deck so you can
     try again — you never lose your turn.
4. Play passes to the next player. The game ends when the deck runs out.

Pan the board by dragging the background. Zoom with the scroll wheel or a
two-finger pinch.

## Tile types

| Type  | Look                                        |
| ----- | ------------------------------------------- |
| Water | Blue with rippling wave lines               |
| Rock  | Grey with angular facets and cracks         |
| Grass | Green with scattered tufts                  |
| Dirt  | Brown with soil patches, furrows and pebbles |

The deck holds 15 of each type, 60 tiles in total, shuffled every game. Each
type has three visual variants so a large map does not look repetitive.

## Running it

It is a static site. Open `index.html` directly, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Publishing on GitHub Pages

The site lives at the repository root, so no build is needed:

1. Go to **Settings → Pages**.
2. Under **Source**, pick **Deploy from a branch**.
3. Choose the branch you want to publish (e.g. `main`) and the `/ (root)` folder.
4. Save. The game appears at `https://<user>.github.io/<repo>/` after a minute.

## Project layout

| File         | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `index.html` | Page shell, title screen, HUD and game over screen        |
| `styles.css` | Screen, HUD and title screen styling                      |
| `game.js`    | Hex math, tile art, deck, turn flow, drag input, renderer |

## Versioning

`VERSION` at the top of `game.js` is the single source of truth; it is shown on
the title screen, in the HUD and on the game over screen. Bump it with every
iteration and add a line to `CHANGELOG.md`.
