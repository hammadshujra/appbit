# Appbit V2.13 — Hostinger Module-Context Verification

## Reproduced cause

The failing V2.11 API route was `pages/api/[[...path]].js`. It used Next.js ESM exports while `package.json` explicitly forced all `.js` files into `"type": "commonjs"`. Hostinger reported that exact route as a Webpack module-parse failure. Node 24 is within Appbit's supported engine range and is not the cause of that syntax classification error.

The later `.next/server/VERSION` stack trace is from the previous successful V2.10 runtime remaining active when the newer build fails.

## V2.13 repair

- Exactly one API catch-all exists: `pages/api/[[...path]].js`.
- The route uses standard Next.js `import`, `export const config`, and `export default` syntax only.
- `package.json` no longer declares a package-wide `type`, avoiding the explicit CommonJS classification that triggered the Hostinger parse path.
- The V2.12 `.mjs` catch-all is removed; there is no duplicate API catch-all.
- `pageExtensions` is returned to the project JavaScript/JSX set.
- `prebuild` validates the route layout and aborts with an Appbit-specific error if a legacy or duplicate catch-all reappears.
- Production continues using Webpack: `next build --webpack`.
- Postbuild still copies release metadata into `.next/server` as a compatibility safeguard.

## Verification performed

- Standard JavaScript/CommonJS syntax checks for server/backend files.
- V2.13 API route parsed with Node's module parser (`--input-type=module --check`).
- V2.13 prebuild guard executed successfully.
- Full Node regression suite: **85/85 passed** after the V2.13 changes.
- `tests/parser-browser.py`: PASS.
- `tests/v2_1_parser_browser.py`: PASS.
- `tests/v2_4_parser_browser.py`: PASS.
- `tests/v2_6_parser_browser.py`: PASS.
- `npm run check`: PASS.
- Synthetic `.next/server` postbuild finalization: PASS with V2.13 metadata.
- Final ZIP CRC integrity verified during packaging.

## Environment limitation

This sandbox cannot reach `registry.npmjs.org`, so a clean dependency installation and full local `next build --webpack` cannot be performed here. Hostinger remains the final production compiler. The V2.13 prebuild signature makes it possible to verify unambiguously that Hostinger is compiling the new package rather than an older failed deployment source.
