# Hex Lands

A turn-based hex tile laying game that runs entirely in the browser — no build
step, no dependencies. Players take turns drawing a tile from a shuffled deck
and dragging it onto the board to grow a shared landscape.

**Current version: v0.2.0**

## How to play

Choose how many players are at the table (1–6), then each turn has two steps.

### 1. Lay a tile (required)

The top tile is drawn automatically and appears above the deck. Press and drag
it onto the board.

- The **first** tile of the game can go anywhere.
- Every tile after that must touch a tile already on the board. Valid spots are
  outlined while you drag.
- Release somewhere invalid and the tile returns above the deck — you never
  lose your turn to a misdrop.

### 2. Move one animal (optional)

After the tile is down, the deck is replaced by your card rail. Every player has
their own set of seven cards, each with a token in their colour. Pick a card, or
tap one of your animals already on the board. You may do **one** of:

- **Send it out** — if the land somewhere matches the card's placement layout,
  those hexes light up. Drag the token from its card onto one, or tap. *Scores.*
- **Call it home** — if the land where it stands matches the card's return
  layout, the *Return to card* button lights up. *Scores.*
- **Walk it** — step it to any one connected tile. Scores nothing, but it is how
  an animal reaches the layout it needs.

Then press *End Turn*. The game ends when the deck runs out; highest score wins.

Pan the board by dragging the background. Zoom with the scroll wheel or a
two-finger pinch.

## The animal cards

Each card has a placement layout and a return layout. The marked hex is where
the animal itself stands. **Layouts match in any rotation or mirror image**, so
you only need the shape, never a particular compass direction.

| Animal | Send it out | Call it home |
| ------ | ----------- | ------------ |
| Worm   | On dirt, touching dirt (+2)              | On dirt, grass one side, water opposite (+3) |
| Frog   | On water, touching water (+2)            | On rock, water one side, dirt opposite (+3) |
| Fish   | Middle of three water in a row (+3)      | On water touching both dirt and rock (+3) |
| Spider | On grass strung between two rocks (+3)   | On rock beside a **frog** (+4) |
| Loon   | On water beside a **fish** (+4)          | On grass touching two water (+3) |
| Deer   | On grass, grass beside, water opposite (+3) | On grass beside a **bear** (+4) |
| Bear   | On rock touching both water and grass (+4) | Middle of three rock in a row (+3) |

Three cards ask for another animal rather than a tile type, and any player's
token counts — so the pieces on the board play off each other. Sending an animal
out and calling it home both score, so a card can be cycled again and again.

Animals may share the land freely but never a single hex, and only one animal
moves per turn.

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

| File         | Purpose                                                       |
| ------------ | ------------------------------------------------------------- |
| `index.html` | Page shell, title screen, HUD and game over screen             |
| `styles.css` | Screen, HUD and title screen styling                           |
| `animals.js` | Card definitions, pattern matching, animal silhouettes, tokens |
| `game.js`    | Hex math, tile art, deck, turn flow, input, renderer, card UI  |

## Versioning

`VERSION` at the top of `game.js` is the single source of truth; it is shown on
the title screen, in the HUD and on the game over screen. Bump it with every
iteration and add a line to `CHANGELOG.md`.
