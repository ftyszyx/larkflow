# admin

Vue3 + Ant Design Vue.

## Dev

```bash
npm i
npm run dev
```

## API base URL

- Default uses `import.meta.env.VITE_BASE_URL || '/api'`.
- Dev server proxies `/api` -> `http://127.0.0.1:8000` (edit in `vite.config.ts`).

## Required request headers

Configure in UI: **Settings** page.

- `X-User-Email`
- `X-Workspace-Id`
- Optional: `X-Api-Key`
- Optional: `X-User-Name`
