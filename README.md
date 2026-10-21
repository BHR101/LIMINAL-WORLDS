# LIMINAL WORLDS

*Somewhere between geometry and memory.*

Liminal Worlds is an open-source, first-person exploration of **impossible
architecture** that runs in the browser: spaces that cannot exist, rendered so
you can stand inside them.

- Fly into a fractal that has no bottom. It rescales itself without a seam, so
  the vanishing point stays exactly as far away no matter how long you fly.
- Walk a gallery of real objects that are only possible from one viewpoint: a
  Penrose triangle, stairs that only go up, an Ames room, and a painting that
  contains itself.
- Drift through a computer whose walls are a slice through four dimensions,
  and watch it rewire itself around you.

Five further worlds of monumental, dreamlike architecture surround them. There's
no combat, no inventory and no quest chain. The geometry is the whole point.

![Flying into the Infinite Regress: one full ×3 zoom, which repeats forever](docs/screenshots/liminal.gif)

> Every image in this README was captured from the running project with
> `scripts/capture.mjs`, which uses headless Chromium with SwiftShader (software
> WebGL). On a real GPU the same scenes render with more detail. None of the
> images are mock-ups.

| | |
|---|---|
| ![The Infinite Regress](docs/screenshots/regress-1.jpg) | ![The Recursive Machine: a slice through a 4D lattice](docs/screenshots/machine-tunnel.jpg) |
| ![The Penrose triangle seen from its viewpoint](docs/screenshots/gallery-triangle.jpg) | ![The same triangle from anywhere else](docs/screenshots/gallery-triangle-broken.jpg) |
| ![The painting that contains itself](docs/screenshots/gallery-droste.jpg) | ![The Ames room: identical figures, impossible sizes](docs/screenshots/gallery-ames.jpg) |
| ![The stairs that only go up](docs/screenshots/gallery-stairs.jpg) | ![A tesseract over a hyperbolic floor](docs/screenshots/gallery-hypercube.jpg) |
| ![Title screen](docs/screenshots/title.jpg) | ![World selection with in-engine previews](docs/screenshots/world-selection.jpg) |
| ![The Sunken Cathedral](docs/screenshots/cathedral-nave.jpg) | ![The Last Horizon](docs/screenshots/horizon-arches.jpg) |

More captures are in [`docs/screenshots`](docs/screenshots).

---

## Features

All of the following are implemented and run in the current build:

- **Three impossible worlds:**
  1. **The Infinite Regress** (flight). A ray-marched Menger lattice carved at every power of three. Your size is tied to your distance from the vanishing point, and the world renormalises (position ×3, size ×3) at the boundary, so you can fly inward or outward forever with no seam. Unit tests confirm the field is identical across the rescale. A **Shepard tone**, the auditory version of the same illusion, falls endlessly as you fly in and rises as you fly out. This world is also the live title-screen backdrop.
  2. **The Gallery of Contradictions** (walking). Every exhibit is real geometry:
     - a **Penrose triangle** built from three perpendicular bars that close only from one marked stone (step away and watch it break)
     - **Penrose stairs** that close into a loop from the balcony, and that you can actually climb forever thanks to a translation portal
     - an **Ames room** built with a projective transform, where identical figures become a giant and a child, and a third grows and shrinks as it walks across
     - a **painting that contains itself**, rendered as a true infinite regress with depth-first recursive portals; step in and you're back in front of it
     - a rotating **4D tesseract** projected into 3D
     - a **hyperbolic {7,3} floor** whose tiles flow toward an edge they never reach
     - a **Klein bottle** and a **Möbius strip**
  3. **The Recursive Machine** (flight). "Impossible computer architecture": a 3D slice through a four-dimensional lattice, shaded as circuitry with data pulses. As the slice drifts along the fourth axis, walls dissolve into slits and slits into halls, so the machine rewires itself around you. A tesseract turns at its core, and you can push the slice faster.
- **Five worlds of monumental architecture**, each with its own palette, lighting, fog, soundscape and cinematic paths:
  1. **The Sunken Cathedral.** A 240 m brutalist nave in shallow reflective water, with a broken vault, shafts of sunlight, floating sculptures and columns that keep marching past the end of the roof into the fog.
  2. **The Infinite Ascent.** Pale stairs, bridges and floating terraces around a 560 m tower, with rotating rings, upside-down aqueducts, a stair that loops back to its own base, and an arch that leads to an inverted district.
  3. **The Obsidian City.** Black-glass plazas that mirror the sky, monoliths threaded with lines of light, a suspended ring, a luminous pool, an anamorphic sculpture that only resolves from one spot, and a giant rotating frame on the horizon.
  4. **The Impossible House.** A small house on a floating lawn at dusk. Inside: a 30 m hallway, a door that opens into a cathedral-sized hall, a room that is turned 90°, a window that opens onto a different sunset, and an attic stair that leads to the cellar.
  5. **The Last Horizon.** A sunset above an ocean of clouds, colossal arches over a long bridge, inverted cities hanging in the sky, and an observation platform where the camera pulls back to reveal a megastructure rising out of the clouds.
- **Seeded random worlds.** Six palettes, four layout patterns (processional, radial, terraced, archipelago) and three kinds of ground, composed into a foreground, middle ground and background. The same seed always builds the same world.
- **A procedural architecture engine** (`src/architecture`). Parametric generators for pillars, colonnades, arches and arcades, straight and spiral staircases, bridges, towers and facades, hanging towers, rooms with real door and window openings, corridors, platforms, rings, doorframes and sculptures. Everything is batched into instanced meshes, and colliders are generated automatically.
- **Rendered portals.** Each portal draws a live view of its destination, rendered from a virtual camera with an oblique near-plane clip. Walking through one keeps your relative position and direction. Portals can also roll the destination to change the direction of gravity, which then rights itself smoothly. Portals between worlds use a veil and a camera-space transition.
- **First-person movement** with pointer lock, configurable sensitivity, gravity, jumping, sprinting, stepping up and down stairs, AABB collision, and recovery after a fall. Pausing, resuming, losing window focus and resizing are all handled.
- **A cinematic camera.** Centripetal Catmull-Rom splines with eased speed and soft dips between shots. It drives the title sequence, an optional tour of each world (G), and scripted moments such as the horizon reveal.
- **Lighting and materials.** ACES filmic tone mapping, sRGB output, a sun that casts shadows and follows the player, hemisphere light, image-based lighting baked from each sky, exponential fog, and world-space triplanar procedural concrete with formwork joints, tie holes, pores and weathering streaks. Also planar-reflection water and black glass, additive light shafts, cloud seas, selective bloom, vignette and grain.
- **Signature set pieces.** The narrow corridor that opens into the nave (impossible reveal), the stair that returns and the inverted arch (architectural contradiction), and the observation platform where a megastructure rises from the clouds (horizon reveal).
- **24 discoveries** across the eight worlds, saved in `localStorage` and listed in an optional journal. Each one changes the world, plays a sound or reveals something.
- **Procedural audio** with the Web Audio API. Each world has its own mix of wind and water noise, detuned drones, inharmonic bells, low pulses and a generated reverb. Hum sources fade with distance, soundscapes crossfade between worlds, and there's a master volume and mute. No audio files are used.
- **Photography mode** (P). The interface hides and you can fly the camera freely or orbit a point. You can change the field of view and exposure, add depth of field, and pick one of four lighting presets. It also has a freeze-time toggle and a gallery of this session's captures. Captures are exported as PNG from the final post-processed frame.
- **Interface.** An animated 3D title screen, world selection with previews captured in-engine, settings, controls, a discovery journal and a pause menu. The HUD stays minimal (prompts, world name, temporary hints), menus are keyboard-accessible, and there's a reduced-motion option.
- **Three graphics presets** (Performance, Balanced and Cinematic), a capped pixel ratio, and a performance overlay toggled with the backquote key (`` ` ``).

## How the impossible parts work

| Effect | Technique | Where |
|---|---|---|
| Endless fractal zoom | An infinite-band Menger signed distance field whose band weights depend on the viewer's scale σ = \|p\|/R₀. At \|p\| = R₀/3 everything is multiplied by 3, which leaves the field unchanged (`tests/core.test.ts` checks this). Rendered by a full-screen ray marcher that writes depth, so normal meshes composite with it. | `rendering/Fractals.ts`, `rendering/Raymarch.ts`, `worlds/InfiniteRegress.ts` |
| Fractal collision | The same field is implemented in TypeScript. The flying body is a sphere pushed out along the numerical gradient. | `player/PlayerController.ts` |
| Endless title flight | No straight line into the vanishing point stays clear, because the lattice's self-similar centres are corners of solid stone. At build time a seeded search finds a path of short, clear hops from A to exactly A/3. The camera rides a spline along it and jumps from A/3 back to A, which by self-similarity looks identical. | `worlds/InfiniteRegress.ts` |
| Penrose triangle | Bars along +x, −y and +z whose start and end lie on one line through the viewpoint. Each cross-section is scaled by its distance, so all bars look equally thick. | `architecture/Impossible.ts` |
| Penrose stairs | Two long and two short flights. The end landing is offset from the start along a vector that points at the balcony, and a translation portal on the end landing makes the climb endless. | `architecture/Impossible.ts` |
| Ames room | The room is built as it should look, then every vertex is passed through `q → q / (1 + c·qₓ)` about the viewpoint. That transform keeps planes flat and rays through the eye fixed, but makes the room a real trapezoid. The figures are placed undistorted on the warped floor. | `architecture/Impossible.ts` |
| Painting of itself | A portal whose exit is in front of itself. The levels are rendered deepest first, each showing the one below it in its frame. Depth is 2, 3 or 5 levels by graphics preset. | `systems/PortalSystem.ts` |
| Rewiring machine | Holes are carved wherever two of four coordinates (x, y, z, w) sit in the middle third of a cell. Rendering a slice at a drifting w opens and closes only the w-dependent holes. | `rendering/Fractals.ts` |
| Hyperbolic floor | Each pixel is folded into the fundamental triangle of the {7,3} tiling, with a drifting Möbius translation on top. | `architecture/Impossible.ts` |
| Shepard tone | Eight octave-spaced sines under a fixed bell-shaped loudness envelope. Their phase follows log₃ of your zoom depth. | `systems/AudioSystem.ts` |

## Running it

You need Node.js 20 or newer (CI uses Node 22) and npm.

```bash
git clone https://github.com/bhr101/liminal-worlds.git
cd liminal-worlds
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run smoke [url]` | Playwright end-to-end smoke test against a running server |
| `npm run capture [url]` | Recapture previews, README screenshots and GIF frames (then `python3 scripts/make_gif.py`) |

The smoke and capture scripts use Playwright's Chromium. If it isn't installed,
run `npx playwright install chromium` first.

## Controls

| Input | Action |
|---|---|
| W A S D / arrow keys | Move (in fractal worlds you fly where you look) |
| Mouse | Look (click the view to capture the pointer) |
| Shift | Sprint |
| Space | Jump (fractal worlds: rise) |
| C | Descend (fractal worlds) |
| E | Interact, or step through a portal |
| Esc | Pause and release the pointer |
| F | Fullscreen |
| M | Mute or unmute |
| G | Cinematic camera (move or press G to return) |
| P | Photography mode |
| `` ` `` | Performance overlay |
| Photo mode | Drag to look · WASD fly · Space/C up and down · Enter captures · H hides the panel · P or Esc returns |

## Architecture overview

```
src/
  main.ts                  bootstrap and WebGL availability check
  core/
    Engine.ts              renderer, frame loop, modes (menu/playing/paused/photo/transition),
                           transitions, portal traversal, photo camera, settings application
    InputManager.ts        keyboard polling, actions, pointer lock
    Settings.ts            validated settings persisted in localStorage
    rng.ts                 mulberry32 seeded RNG
  rendering/
    Lighting.ts            sky, fog, sun with player-following shadows, hemisphere light, PMREM environment
    Materials.ts           procedural noise texture, triplanar architectural material, glow material
    PostProcessing.ts      bloom, depth of field, output (tone mapping), grade (vignette, grain, fades, letterbox)
    Sky.ts / Water.ts / Effects.ts   sky dome, planar-reflection water, light shafts, dust, cloud seas
    Quality.ts             graphics presets
  architecture/            procedural generators (Builder, Pillars, Arches, Staircases, Bridges,
                           Towers, Structures, Portals)
  player/                  CollisionSystem (AABB grid), PlayerController
  systems/                 PortalSystem, CinematicCamera, AudioSystem, DiscoverySystem,
                           ScreenshotSystem, PerformanceMonitor
  worlds/                  the five worlds, WorldGenerator (random worlds), WorldKit, registry, discoveries
  ui/                      HUD, Menu (title, pause, world selection, journal, controls), settings, photo panel
```

Each world is a `WorldDefinition` whose `build()` returns a `WorldInstance`: a
scene graph, a collision world, an atmosphere, spawn and arrival points, portals,
discoveries, interactables, triggers, sound emitters and cinematic shots. The
engine treats every world the same way, and only one world is loaded at a time.
Switching worlds disposes the previous one's GPU resources.

## Procedural generation approach

- **Generators, not props.** Generators write primitives into an `ArchBuilder`, which groups them by geometry and material into `InstancedMesh`es and turns solid pieces into axis-aligned collision boxes. A colonnade of 34 columns becomes one instanced draw. Arch geometry is an extruded single-polygon outline, cached per parameter set.
- **World-space materials.** The architectural material samples one tileable 256² noise texture triplanarly in world space. Because of that, a unit cube scaled to 300 m still reads as poured concrete, and generators never need UVs. Formwork joints and tie holes come from world position and fade out with distance using `fwidth` to avoid aliasing.
- **Seeded and deterministic.** Each world takes a seed (the hand-built worlds use fixed seeds), and `RNG.fork()` gives independent streams to subsystems such as skylines and anamorphic fragments.
- **Composition before scatter.** Random worlds pick a layout that controls the foreground (a spawn platform and a route), the middle ground (colonnades, arcades, terraces, islands, spokes) and a monument at the end of the axis. Skylines and floating forms are added as background, so nothing is scattered at random across an empty plane.
- **Anamorphosis.** The Obsidian City's shifting monolith places 30 fragments along rays from a single viewpoint. Each is scaled by its distance so the pieces line up into a perfect ring only from that marked stone.

## Rendering and performance trade-offs

| Technique | Why |
|---|---|
| Planar reflections (one extra render), not SSR or cube maps | Gives correct mirror reflections for the cathedral water and obsidian plazas. The render target is ¼, ½ or ¾ of screen size depending on the preset. |
| Rendered portals capped at 2 per frame, within 90 m and inside the view frustum | Each portal is a full scene render. Portals beyond that cap, or out of view, cost nothing. |
| Oblique near-plane clipping | Lets portal views be rendered without stencil buffers or recursion. |
| Additive cylinder light shafts and a layered fBm cloud sea | Volumetric-looking light and clouds without ray marching. |
| One shadow-casting sun that follows the player, snapped to shadow texels | Stable shadows over very large worlds. Shadow-map size depends on the preset (1024, 2048 or 4096). |
| Environment map baked once per world from the sky shader | Believable reflections on glass and metal with no per-frame cost. |
| Pixel ratio capped (1, 1.5 or 2) and MSAA off, ×2 or ×4 by preset; bloom off in Performance | The biggest levers for integrated GPUs. |
| AABB collision on a uniform grid | Thousands of boxes are queried in microseconds. Stairs are rows of boxes, and you step up anything under 0.55 m. |
| Ray-marched fractals at 70% resolution (85% on Cinematic), 72–150 march steps, shadow rays off on Performance | The fractal worlds are fragment-bound. Fewer pixels and steps are the main levers. Bands of detail smaller than a pixel are skipped, which also prevents shimmering. |
| Recursive portal depth of 2, 3 or 5 levels | Each level is one more scene render, so only the self-containing painting uses recursion. |

**Frame rate has not been measured on real GPUs.** The development environment
only had software rendering (SwiftShader), where the heaviest worlds run at a few
frames per second at 640×360, so no frame-rate claims are made here. The
performance overlay (`` ` ``) shows your live frame rate, frame time, draw calls
and renderer, so you can judge on your own hardware. If your machine struggles,
use the **Performance** preset. The ray-marched worlds (the Infinite Regress,
which is also the title screen, and the Recursive Machine) are the most
demanding on the GPU.

## Browser compatibility

- This is designed for current desktop Chrome, Edge, Firefox and Safari with WebGL 2. Development and automated testing used Chromium only, so the other browsers are untested.
- Mouse look needs the Pointer Lock API. Without it, keyboard movement still works.
- Audio starts after your first click, because browsers block autoplay.
- **Touch navigation isn't implemented.** On phones and tablets, the title sequence and menus work, but exploring needs a keyboard and mouse.
- If WebGL is unavailable or fails to start, an explanatory message is shown instead of a blank page.

## Testing

| What | How | Status |
|---|---|---|
| Type safety | `npm run typecheck` (strict TypeScript) | Passes |
| Unit tests | `npm test`: 30 Vitest tests covering the RNG, settings, collision, player movement and fall recovery, portal transforms (including roll), instanced batching, random-world determinism, cinematic easing, discoveries for every world, **exact self-similarity of the fractal across the rescale**, and the 4D lattice's permanent tunnels and slice-dependent walls | Pass |
| End-to-end | `npm run smoke`: 52 checks in headless Chromium. They cover menus, world selection, entering the title world (flight), staying clear of the fractal, **flying across the rescale without reaching the centre**, corridor collision, pause and resume, mute, rendered portals (chapel, looping stair, inverted arch with roll, turned room), **the endless Penrose stair**, **walking into the self-containing painting**, **pushing the machine's 4D slice**, the window and cross-world portals, fall recovery, cinematic and photo modes (a real PNG download), seed reproducibility, all eight worlds loading, persistence after reload, and no page errors, failed requests or HTTP errors | 52/52 passed |
| Production build | `npm run build` | Passes |
| Sub-path hosting | The built `dist/` was served under `/liminal-worlds/` and loaded without errors | Passed locally |

**Not verified:** performance on real GPUs (especially for the ray-marched
worlds), browsers other than Chromium, and how the audio, including the Shepard
tone, actually sounds (headless test runs have no speakers; the audio graph was
only checked for errors).

## Deploying to GitHub Pages

`vite.config.ts` uses `base: './'`, so the build works from any sub-path,
including `https://<user>.github.io/liminal-worlds/`. The workflow in
`.github/workflows/pages.yml` builds and deploys whenever you push to `main`.

To turn it on:

1. Push the repository to GitHub, with `main` as the default branch.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand. The URL appears in the workflow summary.

`.github/workflows/ci.yml` runs the type-check, unit tests and production build
on every push and pull request.

## Known limitations

- Collision uses axis-aligned boxes. Rotated decorative elements (the parapets of diagonal stairs, the sculptures) don't collide, and the tower's round core collides as an inscribed square.
- Gravity changes are presented through portal roll: the camera arrives tilted and rights itself. There's no continuous walking on walls or ceilings.
- Only the self-containing painting renders recursively. While any other portal view is rendered, other portal surfaces are hidden, so a portal seen through another portal shows the space behind it.
- The fractal worlds are explored by flying; there's no walking on fractal surfaces. Discoveries there are triggered by distance travelled through the zoom or by reaching the core.
- The impossible figures only work from their marked viewpoints, by design. From elsewhere you see the real (possible) object.
- Portals between worlds use a fade-through transition, not a live view of the other world. Only one world is in memory at a time.
- Random worlds have no portals or discoveries of their own.
- Changing the graphics preset updates pixel ratio, MSAA, bloom and shadows straight away. Reflection resolution, particle count and cloud detail update when the next world loads.
- The photo gallery only lasts for the current session. Captures are saved through your browser's normal download flow.

## Roadmap (not implemented)

- Touch and gamepad navigation
- Live portal views between worlds
- Walkable fractal surfaces with surface-aligned gravity
- More impossible figures (impossible trident, Escher's Belvedere, Reutersvärd cubes)
- Continuous surface-aligned gravity in the Impossible House
- More layout grammars and portal pairs in the random-world generator
- Measured performance budgets on a range of integrated and discrete GPUs
- Localisation of the interface text

## License

[MIT](LICENSE). All geometry, textures and audio are generated at runtime, so
there are no third-party art or sound assets. Runtime dependency: [three.js](https://threejs.org) (MIT).
