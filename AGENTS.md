# Commands

- Dev server: `npm run dev`
- Production build / start: `npm run build` then `npm run start -- --port <port>`
- Typecheck: `npx --no-install tsc --noEmit --incremental false`
- Regression tests (synthetic, no live DB): `node --import tsx --test scripts/test-client-list.ts scripts/test-calendar-data.ts`
- Inspiration tests (needs a server on port 3000 for the /login check): `npx --no-install tsx scripts/test-inspirations.ts`
- `npm run lint` is not usable: ESLint/config are not installed; do not trigger interactive setup.
