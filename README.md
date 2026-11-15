# Deep Belt

Space mining in the Harrow system.

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
| `M` | Open the warp menu; `1`-`9` pick a destination, `Enter` confirms |
| `F` | Dock when in range |
| `E` | Open a wreck within 2 km |
| `H` | Help |
| `Esc` | Close the top menu, or open the game menu |

### Docked at Harrow Station

| Input | Action |
| --- | --- |
| `A` `D`, left/right arrows, or click the floor | Walk the corridor |
| `E` | Use the nearest terminal |
| `1`-`4` | Switch terminal tabs |
| Arrow keys and `Enter` | Select in terminal menus |
| `Esc` | Close the terminal |
| `U` | Undock |

## Project layout

| Path | Contents |
| --- | --- |
| `index.tsx` | Entry point; mounts `App` into `#root` |
| `App.tsx` | The game |
| `constants.ts` | Game data and tuning constants |
| `SpriteRenderer.ts` | Sprite drawing |
| `utils/` | Background music, helpers and the tuning-value hook |
| `playground_config.json` | Tunable values such as thrust, max speed, mining yield and cargo capacity |
| `assets/` | Images and audio |
| `design/` | Game design document and asset manifest |

## Running it

The game is written in TypeScript and React. This repo holds the source only: there is no `package.json`, bundler config or HTML page yet, so it does not run from a fresh clone as it stands. To run it you need a bundler that handles TSX (the `tsconfig.json` is set up for esbuild-style isolated modules) and a page with a `<div id="root">`.

## Third-party software

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

No license has been chosen yet.
