# Pitch deck source

Open `../../What Would Hedge This - Pitch Deck.html` in a browser to present it offline: seven animated slides with per-scene Three.js visuals and an interactive yen-hedge example (slide 5). Use the on-screen controls or Arrow Left / Right, Space, and Home / End. No server is needed.

From this directory, run `npm install`, then `npm run build:html` to rebuild the offline presenter from `visual-slides.html` (authored animated layout), `player.js`, and `player.css`. `slides.html` + `render.cjs` remain the static source for the PDF/PPTX formats. The resulting HTML includes Three.js and its MIT license.

For all three formats, run `npx playwright install chromium` and `npm run build`. Set `CHROME_BIN` instead if using an installed Chromium-compatible browser. `render.cjs` defines the editable PowerPoint and regenerates the static HTML used both for the PDF and by the presenter. Georgia, Arial, and Menlo are used for the original layout. Optionally set `DECK_CONTACT_SHEET` to a path outside the submission to produce a review image.
