# Hex Lands

A turn-based hex tile laying game that runs entirely in the browser — no build
step, no dependencies. Players take turns drawing a tile from a shuffled deck
and dragging it onto the board to grow a shared landscape.

**Current version: v0.6.0**

## How to play

Choose how many players are at the table (1–6). A turn is **one tile, which you
must lay, and one animal move, which you may take — in either order**. Your deck
and your seven cards are both on screen the whole time, so you can read any card
whenever you like, including on someone else's turn.

### Lay a tile (required)

The top tile is drawn automatically and sits beside the deck. Press and drag it
onto the board.

- The **first** tile of the game can go anywhere.
- Every tile after that must touch a tile already on the board. Valid spots are
  outlined while you drag.
- Release somewhere invalid and the tile returns to your hand — you never lose
  your turn to a misdrop.

### Move one animal (optional)

Pick a card from the rail, or tap one of your animals already on the board. You
may do **one** of:

- **Send it out** — if the land somewhere matches the card's go out layout,
  those hexes light up. Drag the token from its card onto one, or tap. *Scores.*
- **Call it home** — if the land where it stands matches the card's come home
  layout, the *Return to card* button lights up. *Scores.*
- **Walk it** — step it to any one connected tile. Scores nothing, but it is how
  an animal reaches the layout it needs.

### Ending the turn

The turn ends by itself once both steps are spent. If you would rather keep your
animal move, lay your tile and press *End Turn*. You cannot end a turn without
laying a tile, so *End Turn* stays locked until the tile is down — but you are
free to move your animal first and lay the tile afterwards, which is often how
you set up a layout before someone else takes the hex you want.

The game ends when the deck runs out; highest score wins.

Pan the board by dragging the background. Zoom with the scroll wheel or a
two-finger pinch.

## The ladder

Animals belong to an **early**, **mid** or **late** tier, and points climb with
the tier. Cards that call for another animal name a **specific** one, chosen so
the pairing reads true — a loon needs a fish to dive for, a bear a fish to
catch, and a loon leaves the nest when a bear reaches the shore.

Two rules hold the escalation together:

- **Going out** may only ask for an animal of a **lower** tier.
- **Coming home** may only ask for an animal of a **higher** tier.

Anything else is land alone. Early animals therefore always go out on land
alone, which is what lets a game start, and **every tier has at least one animal
that comes home on land alone** — worm, spider, deer and bear — so no tier can
be stranded waiting for a predator nobody has on the board.

An animal requirement is met by that animal belonging to **any** player, so the
table props each other up rather than each player building alone.

## The animal cards

The marked hex is where the animal itself stands. **Layouts match in any
rotation or mirror image**, so you only need the shape, never a particular
compass direction.

| Animal | Tier  | Go out                                        | Come home                                      |
| ------ | ----- | --------------------------------------------- | ---------------------------------------------- |
| Worm   | Early | On dirt, touching dirt (+2)                   | Dirt at the meadow edge, dirt opposite (+4)    |
| Frog   | Early | Water with dirt alongside (+2)                | Grass by the water, beside a **spider** (+5)   |
| Fish   | Early | Two connected water tiles (+2)                | Open water, fleeing a diving **loon** (+5)     |
| Spider | Mid   | Grass beside rock, where a **worm** works the soil (+4) | Folds into the stones at the meadow edge (+5) |
| Loon   | Mid   | Open water with a **fish** to dive for (+5)   | Leaves the nest when a **bear** reaches the shore (+7) |
| Deer   | Late  | Grass by water, quiet enough for a **loon** (+6) | Three grass tiles in a row (+8)             |
| Bear   | Late  | Rock by water, with a **fish** running it (+7) | Three rock tiles in a row (+9)                |

Why those pairings: spiders web where the soil is alive with small things,
loons and bears both hunt fish, frogs eat spiders, a diving loon sends a fish
for deep water, a bear on the shore drives a loon off its nest, and deer come
down to drink where the water is quiet enough for a loon to ride it.

Sending an animal out and calling it home both score, so a card can be cycled
again and again — and cycling beats hoarding, since an animal left on the board
is a card you cannot score with.

Animals may share the land freely but never a single hex, and only one animal
moves per turn.

## Changing the cards

Cards live at the top of `animals.js`. A pattern is a list of cells
`[dq, dr, requirement]` where `[0, 0]` is the hex the animal stands on, and a
requirement is one of:

```js
t('water')        // that tile type
near('fish')      // that animal, belonging to any player
nearTier('mid')   // any animal of that tier, belonging to any player
```

`validateCards()` runs on every load and reports to the console rather than
throwing, so a bad card can never spoil a game in progress. It checks that:

- going out only asks for a lower tier, coming home only a higher one;
- every tier has at least one animal that comes home on land alone;
- the hex an animal stands on is land, and named animals and tiles exist;
- coming home always scores more than going out;
- **every card can be reached** — it grows the set of animals that can ever
  get onto the board and confirms each card can both go out and come home from
  it, so a knot where two animals each wait on the other is caught immediately.

## Tile types

| Type  | Look                                        |
| ----- | ------------------------------------------- |
| Water | Blue with rippling wave lines               |
| Rock  | Grey with angular facets and cracks         |
| Grass | Green with scattered tufts                  |
| Dirt  | Brown with soil patches, furrows and pebbles |

### Mixed tiles

Some tiles carry **two** terrains — a rocky shore, reeds at the water's edge,
an outcrop in the meadow. The rule is one sentence:

> **Any terrain on a tile counts.** A water and rock tile is a water tile *and*
> a rock tile.

So a mixed tile can play either part of a layout, and the same tile can be the
water in one animal's layout and the dirt in another's. They are the flexible
ground everyone wants, and worth thinking about before you hand one to the
board.

Because a tile's terrains are unordered, **where the second terrain sits on the
hex is purely cosmetic** — the seam wanders differently on every tile and never
changes what the tile does. Mixed tiles carry a dot per terrain along their top
edge, so the rule stays readable when the board is zoomed out or a terrain is
only a sliver.

The deck holds 60 tiles: 12 each of the four plain terrains, plus 2 of each of
the six pairs. That leaves the supply even — 18 tiles carry each terrain.

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
