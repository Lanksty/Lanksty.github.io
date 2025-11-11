
# Pokémon Vanguard — Team Builder

A lightweight, client-side team builder and Pokédex-style app for the "Pokémon Vanguard" dataset. The project is a static site built with plain HTML/CSS/JavaScript and uses Vue 3 (via an importmap) for UI reactivity. It loads Pokémon, moves, abilities and other data from local JSON files in `resources/data`.

## Features

- Build and save a team (sidebar and full-team views)
- View and edit Pokémon details: abilities, nature, held item, and moves
- Team effectiveness and move coverage tables
- Search and filter Pokémon, moves, and abilities
- Static, data-driven: all content comes from JSON files under `resources/data`

## Tech stack

- HTML, SCSS/CSS, JavaScript
- Vue 3 (importmap: `https://unpkg.com/vue@3/dist/vue.esm-browser.js`)
- No build step required — this is a static site that runs in a browser

## Repository layout (important files)

- `index.html` — main entry
- `team_builder.js` — application logic and Vue app (module)
- `team_builder.css` / `team_builder.scss` — styling
- `_extensions.js`, `_models.js`, `components.js` — small helpers and components
- `resources/data/` — JSON datasets (abilities, moves, pokemon, items, types, etc.)
- `resources/images/` — sprites and type icons

Example data files you can edit or inspect:
- `resources/data/pokemon_with_encounters.json`
- `resources/data/moves.json`
- `resources/data/abilities.json`

## Run locally (Windows PowerShell)

This project is static — you can serve it with a simple HTTP server and open it in your browser.

Using Python (if installed):

```powershell
# from the project root
python -m http.server 8000
# then open http://localhost:8000/ in your browser
```

Using Node (npx http-server):

```powershell
# from the project root
npx http-server -p 8000
# then open http://localhost:8000/ in your browser
```

Using Visual Studio Code Live Server extension is also a convenient option.

## Editing data

All core data is stored as JSON under `resources/data/`. If you want to add or modify Pokémon, moves, items or abilities, edit those files and reload the page. The app reads those files on the client side (no backend required). Be careful with JSON syntax — a trailing comma or stray quote will break parsing in the browser.

Recommended safe workflow:

1. Make a copy/branch before large edits.
2. Edit JSON with an editor that validates JSON (VS Code/Prettier).
3. Reload the browser and check the console for errors.

## Contributing

If you'd like to contribute:

1. Fork the repository and create a branch for your change.
2. Make changes (data, bugfix, UI) and test locally.
3. Open a pull request with a description of your change.

Small, well-scoped PRs are easier to review (fix one dataset or bug per PR).

## Troubleshooting

- Blank page or missing functionality: open the browser devtools console (F12) and look for errors. Most problems are either a missing JSON file or a JSON parse error.
- Images not showing: the app falls back to `resources/images/missing.png` when a sprite is missing; ensure image filenames match what the JSON references.

## Next steps / ideas

- Add a simple autosave/export/import for teams (download JSON of team)
- Add unit tests or a small validation script for the JSON datasets
- Add a small build pipeline for SCSS compilation (if you want to precompile styles)

## License & credits

Credits
- UI powered by Vue 3 (importmap)
- Data and images are stored in `resources/` (local dataset) are sourced from Pokemon Vanguard (all credits to the creators and their respective licenses)
