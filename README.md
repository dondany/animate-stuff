# Animate!

A stop-motion app for a kindergarten animation workshop. It runs in iPhone
Safari as a web app: no app store, no build step, no dependencies to install.

## Run it on your iPhone

```sh
python3 serve.py
```

Open the printed `https://192.168.x.x:8443` address in Safari on the iPhone
(same Wi-Fi). Safari warns about the certificate the first time: tap
**Show Details → visit this website**. Then **Share → Add to Home Screen**.
Home-screen apps keep their saved animations; Safari may clear storage for
plain websites that aren't visited for 7 days.

## What it does

- **Capture**: live camera with "ghost" (onion skin) of the previous photo,
  undo, shutter sound, keeps the screen awake.
- **Play**: speed slider, back & forth (boomerang) mode, copy/delete frames.
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
js/screens/*.js    home, capture, play screens
sw.js              offline cache (network first)
serve.py           local HTTPS server with a self-signed certificate
```

## Roadmap

1. ~~Stop-motion capture, playback, GIF export~~
2. Printable 4-frame drawing templates + sheet scanner
3. Upload to Cloudflare (Pages + R2), share links, a gallery page for parents
