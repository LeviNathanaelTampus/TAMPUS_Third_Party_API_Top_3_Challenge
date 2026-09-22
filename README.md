# Pocket Dex - Retro Card Search

A single-page site that searches [PokéAPI](https://pokeapi.co/) for Pokémon and shows each one as a retro trading card: type, base stats, and a weakness/resistance meter.

PokéAPI is free and public - no API key, no build step, no server-side secret. That means this project is just static files.

## How search works

- **By name** - type a full or partial name (e.g. `char` finds Charizard, Charmander, Charmeleon).
- **By element** - pick a type from the dropdown to browse Pokémon of that type.
- **Both** - combine a name and an element to filter within that type.
- **Fan favorites** - quick-search buttons for a few well-known Pokémon.

Each card's weakness/resistance meter is computed from PokéAPI's `/type/{name}` damage relations, combined across a Pokémon's own type(s), the same way in-game type effectiveness works.

## Files

- `index.html` - page layout
- `styles.css` - retro trading-card styling
- `app.js` - search logic, PokéAPI calls, card + meter rendering
- `pokemon-types.js` - type color reference data
- `render.yaml` - Render static site config
