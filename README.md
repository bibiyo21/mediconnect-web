# mediconnect-web

Next.js public, SEO-oriented MediConnect website. Holds no patient data.

```bash
pnpm install
pnpm dev                       # http://localhost:3000
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Phase 1 is a shell: layout, home page and draft legal pages. Doctor, clinic and specialty pages arrive with search (Phase 3). Security headers are set in `next.config.ts`. Specification: [mediconnect-docs](https://github.com/bibiyo21/mediconnect-docs).
