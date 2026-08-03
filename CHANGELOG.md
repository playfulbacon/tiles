# Changelog

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
