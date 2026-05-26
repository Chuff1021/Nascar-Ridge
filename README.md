# Shuyler Ridge Raceday

Shuyler Ridge Raceday is a phone-first NASCAR driver draw app for a weekly friends pool.

## What it does

- Log in as Cody, Emily, Cory, Sku, Tyler, Hillary, Colton, Shannon, Nate, or Lundy.
- Cody gets commissioner controls for selecting weekly participants and drawing teams.
- Randomly draw drivers for participating players using a separate shuffled player order and driver order.
- Includes the remaining 2026 NASCAR Cup race weeks from Nashville through Homestead-Miami.
- Track who paid the weekly $5.
- Mark the weekly winner and second-place money-back result.
- Keep season standings, result history, weekly lineups, and local trash talk chat.
- Poll a Vercel API route for NASCAR live timing data and show the current leaderboard when available.
- Show car number, driver name, and NASCAR feed starting position when timing data includes it.
- Load NASCAR scanner channel mappings through `/api/audio-mapping` and play available HLS driver radio feeds with `hls.js`.
- Install as a PWA on iPhone and Android from the browser.

Prototype league code: `raceday`

## Local development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Next production step

This version stores data in the browser so the app works immediately as a prototype. To make every friend see the same live teams, chat, payments, and results across phones, connect the state layer to a hosted backend such as Firebase or Supabase.
