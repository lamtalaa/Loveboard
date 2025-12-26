# Where We Are Now — Yassine & Nihal

A mobile-first, romantic status app for Yassine (NYC) and Nihal (Morocco), showing local time, weather, city photos, and cozy predictions.

## Add your Unsplash API key (for city photos)
1. Create an API key at https://unsplash.com/developers.
2. Open `app.js` and replace:
   ```js
   const UNSPLASH_ACCESS_KEY = "YOUR_UNSPLASH_ACCESS_KEY";
   ```
   with your real key.

## Run locally
Because the app fetches data from APIs, run a local server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## Change locations
- Tap **Settings** at the bottom of the app.
- Update the cities and save.
- Preferences persist via `localStorage`.

## Notes
- Default time zones are `America/New_York` and `Africa/Casablanca`.
- Weather uses Open-Meteo (no key required) and metric units (°C).
- Quotes come from the ZenQuotes API via AllOrigins to avoid CORS issues.
- Background and card styling adapt to current weather conditions.
- City photos fall back to local placeholders if Unsplash is unavailable or rate-limited.
