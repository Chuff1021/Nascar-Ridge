# Shuyler Ridge Raceday

Shuyler Ridge Raceday is a phone-first NASCAR driver draw app for a weekly friends pool.

## What it does

- Pick a friend profile and see your weekly garage.
- Randomly draw drivers for every player using a separate shuffled player order and driver order.
- Track who paid the weekly $5.
- Mark the weekly winner and second-place money-back result.
- Keep season standings, result history, and local trash talk chat.
- Install as a PWA on iPhone and Android from the browser.

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
