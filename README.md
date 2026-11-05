# donotdie-gate

The Land/Sea gateway served at https://donotdie.live/ (only `/` and `/_gate/*`).
TanStack Start + Tailwind 4, exported from the Lovable project "Donotdie Gate" on 2026-11-05.

- `npm i && npm run build` builds for Node (`.output/server/index.mjs`). On Vercel the nitro preset switches to `vercel` automatically.
- All built assets and media live under `/_gate/` so Caddy can route `/` and `/_gate/*` here and leave every other path to the Land and Sea apps.
- Colour tokens: the page background token is `ink`, not `base`. A `base` colour makes Tailwind read `text-base` as a colour instead of a font size.
