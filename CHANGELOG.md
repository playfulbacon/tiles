# Changelog

## v0.7.1 — the pending tile's controls sit on two levels

- Back and Confirm now sit **above** the pending tile, the turn buttons
  **below** it. Committing and turning are different kinds of decision, and
  reaching for one should never catch the other.
- If a tile lands hard against the top or bottom of the view, the board shifts
  by the smallest amount that gives both rows their space, so the tile is always
  between its controls rather than the buttons piling onto it.

## v0.7.0 — sides, and turning a tile

- On a mixed tile the two terrains now divide along the **six sides of the
  hex**. The boundary runs from the centre out to a corner, so every side
  belongs wholly to one terrain or the other and the second terrain owns two or
  three of them.
- Tiles have a facing, and are drawn at a random one.
- A dropped tile now **waits for confirmation** instead of committing. Buttons
  appear beside it: turn one side each way, Back to return it to your hand still
  turned as you left it, or Confirm to lay it. You can also pick the waiting
  tile back up and drag it elsewhere. Until confirmed it is not part of the land
  and counts for nobody's layout.
- While dragging, a second finger turns the tile; on a computer the right mouse
  button does. Right click had to be wired to mousedown, because a browser only
  raises pointerdown for the first button pressed, so a right click during a
  left button drag never arrives as one.
- Turning a tile never changes what it counts as — any terrain on it still
  counts — so orientation is about how the landscape reads, not about the rules.
- Tile art is now composited from one sprite per terrain rather than one per
  combination, which is what makes free rotation cheap.

## v0.6.0 — tiles with two terrains

- Some tiles now carry two terrains: rocky shore, reeds, muddy bank, outcrop,
  scree and worn ground. **Any terrain on a tile counts**, so a water and rock
  tile is a water tile and a rock tile, and one tile can be the water in one
  animal's layout and the dirt in another's.
- Because a tile's terrains are unordered, where the second terrain sits on the
  hex is cosmetic. The seam wanders differently on every tile and never changes
  what the tile does.
- Mixed tiles carry a dot per terrain along the top edge, on a dark plate so
  they read over any ground, and the title screen shows examples with the rule.
- Deck is still 60 tiles: 12 of each plain terrain plus 2 of each of the six
  pairs, which keeps the supply even at 18 tiles carrying each terrain.
- Balance: mixed tiles substantially loosen the mid and late game. In two
  player simulations the mid tier went from roughly one animal placed per game
  to ten, the first late animal now arrives around turn 24 rather than 47, and
  final scores roughly doubled.

## v0.5.0 — named animals instead of tiers

- Frogs now go out onto water with dirt alongside; fish onto two connected
  water tiles.
- Cards that call for another animal now name a **specific** one rather than
  any animal of a tier, chosen to read true: spiders web where a worm has
  worked the soil, loons dive for fish, bears fish the shallows, deer drink
  where the water is quiet enough for a loon, frogs eat spiders, a diving loon
  sends a fish for deep water, and a bear on the shore drives a loon off its
  nest.
- Every tier now has at least one animal that comes home on **land alone** —
  worm, spider, deer and bear — so no tier can be stranded waiting on a
  predator nobody has out.
- `validateCards()` runs on load and enforces the shape of the game: lower tier
  to go out, higher to come home, a land-alone return per tier, land under
  every anchor, home worth more than out, and full reachability so two animals
  can never end up each waiting on the other.
- Card diagrams draw the named animal, tinted by the tier it belongs to.

## v0.4.0 — either order, and the cards always in view

- A turn is still one required tile and one optional animal move, but they can
  now be taken in **either order**. Moving an animal first no longer forfeits
  the tile, so you can set a layout up before the hex you want is taken.
- The turn ends by itself once both steps are spent. End Turn stays locked
  until the tile is down.
- The deck, the tile drawn for this turn and the card rail now share one hand
  along the bottom, so **your cards can be read at any moment** rather than
  only during the animal step.
- The hand row shows the deck, this turn's tile (a green tick once it is laid),
  what the turn is waiting on, and the Return and End Turn buttons.
- Cards stay readable once the animal move is spent; only the actions are
  withheld.
- Dropped the turn-step readout from the HUD now that the hand carries it.

## v0.3.0 — the ladder

- Animals are grouped into early (worm, frog, fish), mid (spider, loon) and
  late (deer, bear) tiers.
- An animal needs one of the tier below alongside it to go out, and one of the
  tier above to come home. Both ends cap: early animals go out on land alone,
  late animals come home on land alone — so a game opens with only early
  animals available and can never lock in either direction.
- Tier requirements are met by any animal of that tier belonging to any player,
  so everyone's pieces prop each other up.
- Points now climb with the rung, 2 up to 9, so late turns are worth several
  early ones.
- Card requirements that name a tier are drawn as a paw in that tier's colour;
  cards carry a tier bar that lengthens with the rung, and the title screen
  groups the animals by tier.

## v0.2.1 — never serve a stale build

- Css and js are requested with a `?v=` version query, so a cached page cannot
  pull stale code.
- The game fetches `version.json` on load with caching disabled and reloads
  itself once, at a URL the cache has never seen, when a newer build exists.
  Guarded against reload loops.
- `node bump.js patch|minor|major|<version>` bumps the version everywhere it is
  written down at once.

## v0.2.0 — animals

- Seven animal cards per player — worm, frog, fish, spider, loon, deer, bear —
  each with a token in that player's colour and its own hand drawn silhouette.
- Every card carries two layouts: one to send the animal out onto the land, one
  to call it home. Both score; walking does not.
- Layouts are matched in all six rotations and their mirrors, so only the shape
  of the land matters.
- Three cards require another animal's token rather than a tile type (spider
  beside a frog, loon beside a fish, deer beside a bear), and any player's token
  satisfies them.
- Turns are now two steps: lay a tile, then optionally move one animal.
- Card rail replaces the deck during the animal step, with a detail panel that
  draws both layouts, live indicators for which action is available, a Return to
  card button and End Turn.
- Placement and movement targets are highlighted on the board; animals can be
  dragged or tapped into place.
- Running score in the HUD, floating score popups, and a final scoreboard.

## v0.1.0 — first playable

- Title screen with a 1–6 player picker and a tile type legend.
- Shuffled 60 tile deck: 15 each of water, rock, grass and dirt, three
  hand painted visual variants per type.
- Deck sits bottom centre; the top tile is drawn automatically for the
  player whose turn it is and rests just above the deck.
- Drag and drop placement. The first tile may go anywhere; later tiles must
  be adjacent to a tile already on the board. Valid spots are outlined while
  dragging and a ghost shows exactly where the tile will land.
- Releasing on an invalid spot animates the tile back above the deck.
- Turn order rotates automatically, HUD shows whose turn it is and how many
  tiles are left.
- Pan by dragging the board, zoom with the wheel or a two finger pinch.
- Game over screen once the deck empties, with per type placement counts.
