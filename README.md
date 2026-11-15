# Deep Belt

[![CI](https://github.com/cptjamestiberiouskirk-pixel/deep-belt/actions/workflows/ci.yml/badge.svg)](https://github.com/cptjamestiberiouskirk-pixel/deep-belt/actions/workflows/ci.yml)

Space mining in the Harrow system.

**[Play it in your browser](https://cptjamestiberiouskirk-pixel.github.io/deep-belt/)**

Pilot the Ferrier mining frigate: warp to asteroid belts, lock targets, cycle your mining lasers, then dock at Harrow Station to sell ore and fit upgraded ship modules. Deep Belt is a single-player sandbox with no win or lose condition. Progress comes from mining, trading and fitting.

## Controls

The game plays with keyboard and mouse, or touch, in landscape orientation.

### In space

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` or arrow keys | Thrust, turn and brake |
| Left-click empty space | Fly to that point |
| Left-click an object, or `Tab` | Select a target; `Tab` cycles the nearest ones |
| `L` | Lock the selected target |
| `1` / `2` | Mine / fire cannon |
| `Q` / `O` | Approach / orbit |
| `[` / `]` | Tune the mining laser to the rock's frequency (a mismatch overheats it) |
| `M` | Open the warp menu; `1`-`9`, `0`, `-` warp to a destination |
| `F` | Dock when in range |
| `J` | Use a jump gate, or open the Rift at the anomaly with `Z` |
| `E` | Salvage the nearest wreck |
| `C` / `D` / `X` / `V` | Compress exotic ore / drones / jettison cargo / deploy an outpost |
| `H` | Help |
| `Esc` | Close the top menu, or open the game menu |

### Docked at Harrow Station

| Input | Action |
| --- | --- |
| `A` `D`, left/right arrows, or click the floor | Walk the corridor |
| `E` | Use the nearest terminal |
| `1`-`6`, `R`, `F`, `K` | Market, Fitting, Skills, Agent, Repair, Hangar, Refinery, Fabricator, Schematics |
| Arrow keys and `Enter` | Select in terminal menus |
| `Esc` | Close the terminal |
| `U` | Undock |

These are the core controls. Press `H` in the game for the full list, which includes more module and menu keys.

## Project layout

| Path | Contents |
| --- | --- |
| `index.html` | Page that hosts the game |
| `index.tsx` | Entry point; mounts `App` into `#root` |
| `App.tsx` | The game |
| `constants.ts` | Game data and tuning constants |
| `SpriteRenderer.ts` | Sprite drawing |
| `utils/helper.tsx` | Input, audio, asset loading and overlay helpers |
| `assets/` | Images and audio |
| `design/` | Game design document and asset manifest |
| `tests/` | Playwright tests that play the built game in a browser |

## Running it

The game is written in TypeScript and React and built with [Vite](https://vite.dev). You need [Node.js](https://nodejs.org) 22.12 or newer (20.19 or later on the 20 line also works).

```bash
npm install
```

```bash
npm run dev
```

Then open the address Vite prints, normally <http://localhost:5173>.

To make a production build in `dist/`, and to serve that build locally:

```bash
npm run build
```

```bash
npm run preview
```

The build uses relative paths, so the contents of `dist/` can be hosted from any folder on a static web server. It does not work when `dist/index.html` is opened directly from disk, because browsers block module scripts on `file://` pages.

To type-check the code:

```bash
npm run typecheck
```

To play-test the game automatically:

```bash
npx playwright install chromium
```

```bash
npm test
```

The tests build the game, serve the build, and play it in a headless browser: the full training loop, every station terminal, saving and loading, combat, being destroyed, the jump gate to Vael, an outpost, the Rift, and several window sizes. They set up each situation by writing a save into `localStorage` and check results in the page and in the save.

Every push and pull request runs the type-check, the build and the play-test on GitHub Actions (`.github/workflows/ci.yml`). A push to `main` that passes all three also publishes `dist/` to GitHub Pages.

### Notes

- The game is self-contained. It makes no network requests beyond its own files, and the fonts (Fredoka, Inter, JetBrains Mono) are bundled.
- `index.html` carries a Content-Security-Policy that only allows the game's own files and blocks inline scripts. If you add something that loads from another site, the policy has to be widened to match.
- Progress saves to the browser's `localStorage`, so a save belongs to one browser on one address. Clearing site data erases it.
- Developer shortcuts (free marks, cargo grants, a teleport, forced laser heat and scan failures) are switched off in the released build. They work under `npm run dev`, or when the page is opened with `?dev` added to the address.
- New Game and Restart run erase the save and reload the page, after a confirmation.
- Tuning values such as thrust, max speed, mining yield and cargo capacity live in the `CONFIG` object in `constants.ts`.
- Images and audio in `assets/` are loaded by URL at runtime and are not bundled. `vite.config.ts` copies the folder into `dist/` on build.

## Third-party software

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE).
