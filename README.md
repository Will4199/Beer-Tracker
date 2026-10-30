# Units – alcohol tracker

A small, offline-first web app for a mobile phone. Log beer, red wine and Prosecco with one tap, record the units for each drink, and see daily, weekly and monthly charts of your consumption.

No build step, no dependencies, no account. Everything is stored on your phone.

## Features

- **Quick add** – one tap for a standard can (440ml), pint can (568ml), glass of red wine (175ml) or Prosecco flute (125ml). Undo from the toast if you mis-tap.
- **Other time** – log a drink for an earlier time or date, several at once, or a custom drink.
- **Units per drink** – each quick-add preset carries its own units value. Edit, add or remove presets in Settings, with a built-in calculator (units = ABV% × ml ÷ 1000).
- **Weekly target** – defaults to the UK guideline of 14 units, shown as a progress bar on the home screen and a dashed line on the weekly and monthly charts. Set to 0 to hide it.
- **Day cutoff** – drinks logged before 04:00 (configurable) count towards the previous evening.
- **Charts** – stacked bars by drink type for the last 28 days, 12 weeks or 12 months, with paging further back, tap-to-see breakdowns, summary stats and a table view.
- **History** – every drink grouped by day; tap to edit or delete.
- **Backup** – export JSON (full backup, re-importable) or CSV; import merges or replaces.
- **Installable** – a Progressive Web App with an offline service worker. Light and dark mode follow the phone, or set in Settings.

## Running it

The app is static HTML, CSS and JavaScript. Serve the folder over HTTPS (or `localhost`) so the service worker and "Add to Home Screen" work. GitHub Pages is the simplest option:

1. Push this repository to GitHub.
2. In the repository settings, enable Pages from the branch you want to use (root folder).
3. Open the Pages URL on your phone.

Then install it:

- **iPhone (Safari)** – tap Share, then "Add to Home Screen".
- **Android (Chrome)** – tap the menu, then "Install app" or "Add to Home screen".

For local testing, any static server will do, for example:

```sh
python3 -m http.server 8000
```

then open `http://localhost:8000/`.

## Default units

| Drink | Size | Assumed ABV | Units |
|---|---|---|---|
| Beer, standard can | 440ml | 4.5% | 2.0 |
| Beer, pint can | 568ml | 4.5% | 2.6 |
| Red wine, glass | 175ml | 13.5% | 2.4 |
| Prosecco, flute | 125ml | 11% | 1.4 |

Adjust these in Settings to match what you actually drink.

## Files

- `index.html` – app shell and bottom navigation
- `app.js` – all logic: storage, logging, charts, settings, import/export
- `styles.css` – mobile-first styles with light and dark tokens
- `sw.js` – service worker for offline use (bump `CACHE` when files change)
- `manifest.webmanifest`, `icons/` – PWA metadata and icons

## Privacy

Data never leaves the device. Clearing the browser's site data will delete it, so export a backup from Settings now and then.
