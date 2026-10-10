# Commands

- Dev server: `npm run dev`
- Production build / start: `npm run build` then `npm run start -- --port <port>`. Stop the dev server first: dev and build share `.next`, and concurrent writes can cause missing-chunk/prerender errors.
- Typecheck (including CSS side-effect imports): `npx --no-install tsc --noEmit --incremental false --noUncheckedSideEffectImports`
- Regression tests (synthetic, no live DB): `node --import tsx --test scripts/test-client-list.ts scripts/test-calendar-data.ts scripts/test-font-loading.ts scripts/test-devtools-probe.ts scripts/test-workspace-navigation.ts scripts/test-workspace-data.ts scripts/test-posting-silence.ts`
- Inspiration tests (needs a server on port 3000 for the /login check): `npx --no-install tsx scripts/test-inspirations.ts`
- `npm run lint` is not usable: ESLint/config are not installed; do not trigger interactive setup.
