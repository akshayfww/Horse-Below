# The Horse Below

A tiny top-down pixel-art game about a horse on an absurd, fully underwater alien planet. It is really a **spatial-audio sound-design sandbox**: ten landmarks, each with its own sound that you can replace with your own recordings, live, from inside the game.

Static site: plain HTML + Canvas 2D + Web Audio + IndexedDB. No dependencies, no backend.

## Run locally
```bash
npm start            # uses npx serve, then open http://localhost:8080
```
ES modules need http(s); opening `index.html` via `file://` will not work.

## Build
```bash
npm run build        # copies the site into dist/
```

## Publish on GitHub Pages
1. Push this folder to a GitHub repo (branch `main`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The included workflow `.github/workflows/pages.yml` builds and deploys on every push. All paths are relative, so project sub-paths (`/user/repo/`) work.

## Controls
`WASD` / arrow keys move · `Ctrl+D` (or the **Audio editor** button) opens the editor · `Esc` closes overlays. Headphones recommended.

## Adding your own sounds (Ctrl+D)
Open the editor, expand a location, then **Upload / replace…** (WAV, MP3, OGG, M4A and anything your browser can decode), **▶ Preview**, tweak the settings, and press **Save**. Close the panel and walk to the location.

Per location: playback mode (**Spatialized mono (HRTF)** or **Stereo recording**, which keeps your stereo/binaural image), behavior (**looping ambience** or **one-shot on entry**), volume, audible radius, source offset (spatial) or balance (stereo), fade time, proximity loudness, and "keep looping after leaving". Remove clears the sound; "Use demo tone" restores the built-in synthesized placeholder.

Notes on the audio:
- Spatialized mode runs the sound through a Web Audio `PannerNode` with HRTF, with the listener on the horse. That is a headphone approximation of direction and distance, **not** a true binaural recording or accurate 3D localization. A stereo file in spatial mode is mixed to mono; use Stereo mode to keep a pre-made binaural recording intact.
- Sounds fade in/out with gain automation; a compressor on the master bus and a voice cap prevent clipping and runaway overlap.

## Where things are saved
Sounds and settings go to **IndexedDB in your browser**. They persist across refreshes in the same browser/profile, but are **browser-specific and are not part of the GitHub repo** (and are not committed or uploaded anywhere). Clearing site data deletes them.

Use **Export** in the editor to download `horse-below-sounds.json` (settings **and** the audio, base64-embedded) and **Import** to load it into another browser or after clearing data. Large audio makes large JSON files.

## Project layout
- `index.html`, `src/styles.css`: page, title screen, HUD, editor panel
- `src/locations.js`: **single source of truth** for locations (and the game title)
- `src/game.js`: world, collision, camera, horse, landmark drawing
- `src/audio.js`: Web Audio engine, spatialization, demo sounds
- `src/storage.js`: IndexedDB
- `src/panel.js`: Ctrl+D editor, upload/preview/save, export/import
- `src/main.js`: wiring, input, start screen
