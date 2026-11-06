# Numa Living website

The public website at https://numaliving.us. It is a static site built by Jekyll and published by GitHub Pages. `CONTEXT.md` explains the words used here, and `docs/adr/` explains the decisions.

## Changing the site

| To change | Edit |
|---|---|
| Words on a page | `_data/home.yml`, `about.yml`, `capabilities.yml`, `process.yml`, or the page's own `index.html` |
| A page's search title and description | `_data/pages.yml` |
| A project | its file in `_projects/`. The file name is its address, and every project needs at least one photo |
| The menu or the Contact email | `_data/site.yml` |
| The Demo Portal's sample data | `_data/portal.yml` |
| The form's questions and choices | In Tally's editor, not in this repo. `_config.yml` holds only the form's id |

Photos go in `assets/projects/<folder>/`. A project's address and its photo folder can differ: `amherst` keeps its photos in `Amherst`. Keep file names from starting with `_`, `.`, `#` or `~`, because Jekyll skips those.

After adding or changing a photo, run `npm run images:build` and commit what it writes. It makes small AVIF and WebP copies next to each photo the pages name, and records them in `_data/photos.json`. GitHub's build cannot do this, and `npm run images:check` fails if they are out of date.

The map on the About page is a fixed drawing in `_includes/world-map.html`. To add a place, copy one of its `<g>` blocks. A place's position is `x = (lon + 180) * 1000 / 360` and `y = (84 - lat) * 1000 / 360`.

A new file or folder at the top of the repo is **published** unless it is listed under `exclude` in `_config.yml`. That includes Markdown. `e2e/published-files.spec.ts` fails if one is missed.

## Developing

You need Node 24 and Docker.

```bash
npm ci
npm run css          # after changing classes in a template: compiles assets/css/site.css, which is committed
npm run images:build # after changing a photo: makes its small copies, which are committed
npm run build:site   # builds _site/ with the image GitHub Pages uses
npm run serve:pages  # serves _site/ on http://127.0.0.1:4173, the way GitHub Pages does
```

### Before every push

```bash
npm run check
```

This runs what CI runs (lint, types, unit tests with coverage, the committed CSS, a Jekyll build, every Playwright spec), so GitHub Actions does not clog up with a run for each change. A pull request is checked once by `.github/workflows/verify.yml`, which never deploys.

Every test gets a stand-in for Tally, and any other off-machine request fails the test, so nothing is emailed.

## What is real and what is a demo

- **The Quote Request form is real.** Tally hosts it in an iframe on the Contact page, because it cannot take a submission from a form of our own. Requests are emailed to the Tally account's address, with Drawings as links, and stay in Tally's Submissions tab. Tally's API key is not used by the site and must never be committed: `tally-api-key.json` is git-ignored and excluded from builds. See `docs/adr/0004-quote-requests-through-tally.md`.
- **Client Login and the Demo Portal are demos.** Nobody can sign in, the portal's data is invented, and nothing done in it is saved.

## Hosting

GitHub Pages builds and publishes `main` by itself (Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/`). **A push to `main` goes live**, so changes go through a pull request. The site must build for the domain root: `baseurl` stays `""` in `_config.yml`.

The domain, its DNS records and the HTTPS certificate are described in `docs/adr/0003-custom-domain-numaliving-us.md`. In short:

- All DNS records stay "DNS only", and there is never a wildcard.
- A site published from a branch keeps its domain in the `CNAME` file at the repo root, so leave that file alone.
- **A stalled certificate:** clear the domain and set it again, back to back.
  ```bash
  R=pranay-ai360/numaliving.us
  echo '{"cname":null}' | gh api -X PUT repos/$R/pages --input - && gh api -X PUT repos/$R/pages -f cname=numaliving.us
  ```
- When doing domain work, never use `gh api -X DELETE .../pages`: it deletes the whole Pages site.

To undo a bad change, revert its commit on `main`. GitHub republishes within a minute or two, and Pages can serve old HTML for about 10 minutes (`cache-control: max-age=600`).

## Third-party code in the site

`assets/js/vendor/alpine-3.17.5.min.js` is Alpine.js 3.17.5 (MIT), the `dist/cdn.min.js` file from the npm package, used on `/portal/` pages only. To update it, replace the file and change the name under `defaults` in `_config.yml`. The fonts in `assets/fonts/` are Michroma and Montserrat (SIL Open Font License).
