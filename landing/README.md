# OpenTradex Landing Page

Static landing page for the project. Zero build step — just `index.html` + `styles.css`.

## Preview locally

```bash
# pick any static server
npx serve landing
# or
python -m http.server 8000 --directory landing
```

Then open `http://localhost:3000` (or `:8000`).

## Deploy

### GitHub Pages

1. Push to `main`.
2. Settings → Pages → Source: `main`, folder: `/landing`.
3. Site goes live at `https://<user>.github.io/opentradex/`.

### Custom domain

Drop a `CNAME` file into `landing/` with your domain (e.g. `opentradex.com`), then point the domain's DNS at GitHub Pages.

### Netlify / Vercel / Cloudflare Pages

Point the project at the repo root and set the publish directory to `landing`. No build command needed.

## Links to update before going live

All external URLs live in `index.html`. Search and replace:

| Placeholder | Update to |
|---|---|
| `https://discord.gg/tNfdVQU5` | Discord invite (update if rotated) |
| `https://github.com/deonmenezes/opentradex/releases` | releases URL once the first `.exe` is published |

## Design tokens

Matches the app's dashboard palette (see `--bg`, `--surface`, `--accent` in `styles.css`) so the landing and product feel like the same thing.
