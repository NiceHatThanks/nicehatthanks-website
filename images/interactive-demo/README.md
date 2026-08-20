# Scoopy interactive demo assets

Place the homepage interactive-demo renders in this folder.

## Required files

- `demo-node.png` — assembled Node + Presence, LEDs visually off/dark
- `demo-button1.png` — button 1 only
- `demo-button2.png` — button 2 only
- `demo-led-left.png` — left light pipe only
- `demo-led-centre.png` — centre light pipe only
- `demo-led-right.png` — right light pipe only

## Export requirements

All PNGs should be:

- 1200 × 1200 px
- transparent background
- rendered from exactly the same camera
- same canvas position and scale
- not individually cropped

The transparent empty space is intentional: it keeps every component registered with the assembled render for button hit detection, LED animation and the presence demo.
