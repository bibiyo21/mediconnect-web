<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system

UI work follows `docs/design-system.md` in the mediconnect-docs repository (tokens, components, accessibility). Use semantic tokens, reuse shared primitives, and add a Playwright smoke spec (with the axe scan) for every new screen or page.

Use the CSS variables from `@mediconnect/design-system` (`var(--color-*)`, `var(--space-*)`, `var(--radius-*)`). Never hard-code hex, px spacing or fonts. Change token values only in `mediconnect-shared/packages/design-system/src/tokens.ts`, then run `pnpm build` there.
