# Appbit V2.12 — Hostinger Repair Verification

## Reproduced cause

The V2.11 API bridge was a `.js` file inside a package explicitly marked `type: commonjs`, but that file used ESM `export` syntax. Running Node's parser against the old route reproduces the same class of module-format failure: `Unexpected token 'export'`. Because V2.11 failed during build, Hostinger kept serving the prior successful V2.10 deployment, which is why Runtime Logs continued to show the old `.next/server/VERSION` ENOENT stack trace.

## V2.12 repair

- Native API bridge is now explicit ESM: `pages/api/[...path].mjs`.
- `.mjs` is explicitly enabled in `next.config.js` page extensions.
- The bridge has no CommonJS `require()` statement and passes `node --check` as an ES module.
- Production still forces Webpack with `next build --webpack`.
- npm `postbuild` writes compatibility copies of `VERSION` and `BUILD-INFO.json` into `.next/server` after a successful Next build.
- Release identity remains bundled in `src/version.js` and the SSR shell, so normal runtime code does not depend on those compatibility files.

## Completed checks

- `npm run check`: PASS.
- Node regression suite: **84/84 passed**.
- `tests/parser-browser.py`: PASS.
- `tests/v2_1_parser_browser.py`: PASS.
- `tests/v2_4_parser_browser.py`: PASS.
- `tests/v2_6_parser_browser.py`: PASS.
- Postbuild finalizer executed against a synthetic `.next/server` directory and produced both compatibility metadata files with version **2.12**.
- Final ZIP CRC integrity: verified during packaging.

## Environment limitation

This sandbox cannot resolve `registry.npmjs.org`, so it cannot install a fresh Next.js dependency tree and run the real `next build --webpack`. Hostinger remains the production compiler. V2.12 therefore adds direct module-format parsing tests for the exact V2.11 failure plus the postbuild compatibility guard for the exact V2.10 runtime failure.
