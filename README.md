# Animate!

A stop-motion app for a kindergarten animation workshop. It runs in iPhone
Safari as a web app: no app store, no build step, no dependencies to install.

**Live:** https://dondany.github.io/animate-stuff/ (GitHub Pages, deploys on every push to `main`)

Open it in Safari on the iPhone, then **Share → Add to Home Screen**.
Home-screen apps keep their saved animations; Safari may clear storage for
plain websites that aren't visited for 7 days.

## Run it locally

```sh
python3 serve.py
```

Open the printed `https://192.168.x.x:8443` address in Safari on the iPhone
(same Wi-Fi). Safari warns about the certificate the first time: tap
**Show Details → visit this website**.

## What it does

- **Capture**: live camera with "ghost" (onion skin) of the previous photo,
  undo, shutter sound, keeps the screen awake.
- **Play**: speed slider, back & forth (boomerang) mode, copy/delete frames.
- **Drawing sheets**: printable A4 landscape PDFs with 4, 8 or 12 numbered
  boxes and faint outlines to trace (bouncing ball, sunrise, growing flower,
  sad → happy face, jumping kid, or blank). Outlines are generated from a
  progress value, so every frame count gets smooth in-betweens.
- **Scan drawings**: photograph a filled-in sheet (or pick many photos at once)
  and the app finds the corner squares, straightens the page, evens out
  shadows, detects the layout, cuts out the frames and the child's handwritten name.
- **Save GIF**: exports a 480×360 looping GIF and opens the iPhone share sheet
  (Save Image → Photos, Messages, AirDrop…).

Everything is stored on the phone (IndexedDB) and works offline.

## Layout

```
index.html, css/app.css
js/app.js          hash router (#/, #/capture/:id, #/play/:id)
js/db.js           IndexedDB storage for projects and frames
js/camera.js       camera start/stop and 4:3 frame grabbing
js/gif.js          GIF export (vendor/gifenc)
js/sheet.js        printable sheet layouts (mm) and trace outlines
js/pdf.js          tiny PDF writer (one JPEG per A4 page)
js/scanner.js      sheet detection, perspective correction, paper whitening
js/screens/*.js    home, capture, play screens
sw.js              offline cache (network first)
serve.py           local HTTPS server with a self-signed certificate
```

## Roadmap

1. ~~Stop-motion capture, playback, GIF export~~
2. ~~Printable 4-frame drawing templates + sheet scanner~~
3. Share links + gallery page for parents (needs storage, e.g. Cloudflare R2;
   GitHub Pages only serves the app, and kids' animations must not go in this public repo)
