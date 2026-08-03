# Hex Lands

A turn-based hex tile laying game that runs entirely in the browser — no build
step, no dependencies. Players take turns drawing a tile from a shuffled deck
and dragging it onto the board to grow a shared landscape.

**Current version: v0.3.0**

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

## The ladder

Animals belong to an **early**, **mid** or **late** tier. To go out onto the
land an animal needs one of the tier **below** standing alongside it; to come
home it needs one of the tier **above**. Both ends cap:

| Tier  | Animals             | To go out          | To come home      |
| ----- | ------------------- | ------------------ | ----------------- |
| Early | worm, frog, fish    | land alone *(cap)* | a **mid** animal  |
| Mid   | spider, loon        | an **early** animal | a **late** animal |
| Late  | deer, bear          | a **mid** animal   | land alone *(cap)* |

So a game fills from the bottom up — at the start only early animals can go out
at all — and then unwinds from the bottom up too, the small animals retreating
as the big ones arrive. Points climb with every rung, so the late turns of a
game are worth several early ones.

A tier requirement is met by **any** animal of that tier belonging to **any**
player, so everyone's pieces prop each other up. Because both ends cap, the
game can never lock: with every token home, early animals can always go out; with
every token out, late animals can always come home.

## The animal cards

The marked hex is where the animal itself stands. **Layouts match in any
rotation or mirror image**, so you only need the shape, never a particular
compass direction.

| Animal | Tier  | Go out                                        | Come home                                     |
| ------ | ----- | --------------------------------------------- | --------------------------------------------- |
| Worm   | Early | On dirt, touching dirt (+2)                   | Dirt beside grass, a mid animal alongside (+4) |
| Frog   | Early | On water, touching water (+2)                 | A rock by the water, a mid animal alongside (+4) |
| Fish   | Early | Middle of three water in a row (+3)           | Water against the bank, a mid animal alongside (+5) |
| Spider | Mid   | Grass beside rock, an early animal alongside (+4) | Rock beside grass, a late animal alongside (+6) |
| Loon   | Mid   | Open water, an early animal alongside (+5)    | Grass by the water, a late animal alongside (+7) |
| Deer   | Late  | Grass by the water, a mid animal alongside (+6) | Three grass tiles in a row (+8)             |
| Bear   | Late  | Rock by the water, a mid animal alongside (+7) | Three rock tiles in a row (+9)               |

Sending an animal out and calling it home both score, so a card can be cycled
again and again — and cycling beats hoarding, since an animal left on the board
is a card you cannot score with.

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

## Versioning and stale caches

GitHub Pages serves everything with a ten minute browser cache, so a phone will
cheerfully show yesterday's build after a refresh. Two things prevent that:

- Every release gives the css and js **new URLs** (`game.js?v=0.2.1`), so a
  cached `index.html` can never pull stale code.
- The running game fetches `version.json` on load with caching disabled. If it
  names a newer version than the one baked into `game.js`, the page reloads
  itself once at a URL the cache has never seen. A session guard means a
  mismatch can never cause a reload loop.

So bump the version on every iteration, in one command:

```sh
node bump.js patch      # or minor, major, or an explicit 0.3.0
```

That rewrites `VERSION` in `game.js`, the `?v=` query strings in `index.html`,
`version.json`, and the version line in this file. Then add a `CHANGELOG.md`
entry and push. The version is shown on the title screen, in the HUD and on the
game over screen, so you can always tell at a glance which build you are on.

If you ever need to force a fresh copy by hand, just add any junk query to the
address — `…github.io/tiles/?x=1` — which the cache has never seen. A private
browsing tab works too. Clearing the browser cache works but is a blunt
instrument, and there is no hard refresh gesture on mobile.
