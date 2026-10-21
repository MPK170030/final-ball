# TODO

## Blocking: Vercel build failing — webpack errors

**Status:** Deploy to `finalball.manavpkothari.dev` is broken. Phase 7 (deploy) is blocked.

**What was fixed already:**
- `Module not found: Can't resolve './fpl/helpers.js'` — stripped `.js` extensions from all
  internal imports in `packages/agent/src/` (commit `5fb98fa`, now on `main`)

**What's still broken:**
- Vercel still reports webpack errors after the `.js` fix. Exact error messages not captured —
  check the Vercel build log for the latest `main` deploy before debugging.

**Likely suspects (check in this order):**
1. Other packages with `.js` extensions — check `packages/db/src/` and `scripts/` for the same pattern
2. `"type": "module"` in package.json conflicting with how Next.js/webpack handles the transpiled packages
3. Alias resolution — Next.js may need `resolve.extensionAlias` in `next.config.ts` to map `.js` → `.ts`

**Next session action:**
1. Open the Vercel dashboard, copy the full build error
2. Paste it here and fix — do not guess, read the actual log first
