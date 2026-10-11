# Cifras y Letras · La prueba de los números

A browser implementation of the "numbers round" from the Spanish TV show
**Cifras y Letras** (Spain's adaptation of the French *Des chiffres et des
lettres*, the same format as the UK's *Countdown*).

Note: the round uses **6** numbers, not 7 — that's the official rule, verified
against the show's format.

## How the round works

1. Pick 6 numbers: draw from the "large" pile (25, 50, 75, 100 — one of each,
   up to 4) and/or the "small" pile (1–10, two of each, up to 20), same as
   contestants asking for "una grande y cinco pequeñas", etc.
2. A 3-digit target (101–999) is generated. Default "Práctica" mode
   guarantees it's exactly reachable from your 6 numbers (the solver checks
   before offering a target). An "Auténtico" mode, chosen at setup, instead
   generates a truly random target as the real broadcast does — it often
   won't be exactly reachable, so you may have to settle for the closest
   you can get, same as real contestants. (There's no public archive of
   actual historical broadcast draws to replay — the real show itself
   generates each round live and at random from the same number pools,
   which is what both modes here reproduce.)
3. In 45 seconds, combine numbers two at a time (+, −, ×, ÷) to get as close
   to the target as possible. Each number can be used at most once; you don't
   have to use them all. Subtraction must stay positive and division must be
   exact, same as the official rules.
4. Scoring: 8 points for the exact number, then 6/5/4/3/2/1 for being 1–6
   away, 0 points beyond that.
5. With 2 players, both play the *same* 6 numbers and target, then scores are
   compared and added to a running total across rounds.

A "Ver solución" button is available both during your turn and on the
round-result screen, and shows a solver-computed exact solution. A "Pista"
button plays one step of that solution onto the board for you at a time —
if the numbers it needs were already used up in your own moves, it undoes
your moves first so it can apply the step. A "Pausar" checkbox next to the
timer freezes the countdown without ending your turn. In "Práctica" mode a
stopwatch ("Tiempo real") counts up from zero the whole turn regardless of
whether the countdown is paused, so you can stop the pressure while still
seeing how long you actually took.

On the results screen, "A jugar otra vez" replays the exact same 6 numbers
and target for another attempt (adding to the running total like any other
round), while "Siguiente ronda" draws a fresh set.

## Running it

No build step — it's static HTML/CSS/JS.

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

or just open `index.html` directly in a browser.

## Installing it as an Android app (PWA)

The game is a installable Progressive Web App: `manifest.webmanifest` +
`sw.js` (a cache-first service worker covering the whole app shell, so it
also works offline once installed) + the icons in `icons/`.

To actually get the native "Install app" prompt on an Android phone, the
site needs to be served over HTTPS at a real, top-level URL (a PWA install
prompt won't fire from a `file://` page or from most sandboxed
preview/iframe contexts). The easiest option for this repo: enable **GitHub
Pages** (repo Settings → Pages → deploy from the `main` branch, root
folder) — that gives you
**https://gutisg.github.io/Cifras_y_letras/**. Any other static host
(Netlify, Vercel, your own server) works the same way. Once it's live:

1. Open the URL in Chrome on Android.
2. Tap the menu (⋮) → **"Instalar aplicación"** / **"Añadir a pantalla de
   inicio"** (or wait for Chrome's own install banner).
3. It launches full-screen from the home screen icon like a native app,
   and keeps working without a connection after the first load.

## Files

- `index.html` / `style.css` — UI
- `app.js` — game state machine (picking numbers, turns, timer, scoring)
- `solver.js` — brute-force subset solver that finds the closest/exact
  reachable value for a given set of numbers and target; reusable from
  Node (`require('./solver.js')`) or the browser (`window.NumbersSolver`)
- `manifest.webmanifest` / `sw.js` / `icons/` — PWA install + offline support
