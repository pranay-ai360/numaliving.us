# Build the site with Jekyll, and let GitHub Pages publish it from main

On 6 November 2026 the owner chose Jekyll, GitHub Pages' default generator, in place of the Next.js static export the Reference Site was written in. GitHub builds the site on every push to `main` with its own `github-pages` gem (Jekyll 3.10), through "Deploy from a branch". The owner chose this over a workflow running the same Jekyll, because it needs no deploy pipeline, and the design, content and navigation stay those of the Reference Site.

## Consequences

These look like oversights to a later reader, but they are deliberate.

- **A bad push to `main` goes live.** Nothing stands between a push and publishing. The gate is `npm run check` before a push, and the `verify` workflow on pull requests. Branch protection requiring `verify` would close the gap.
- **The Form alias is committed**, in `_config.yml`, because a branch build has no repository variables. It is public by design and in every page's source anyway. `tests/config.test.ts` fails if it is empty, a test id or a mailbox.
- **The compiled stylesheet is committed**, because GitHub's Jekyll build cannot run Node. `npm run css:check` fails if `assets/css/site.css` is out of date.
- **The `exclude` list in `_config.yml` must stay complete.** GitHub's build publishes everything else at the repo root and turns Markdown with no front matter into pages, which would put this file on the public site. `e2e/published-files.spec.ts` checks the output.
- **Local builds need Docker.** They use the image GitHub uses, so they match what gets published, and no Ruby is installed on the machine.
- **There is no build step for JavaScript.** Browser code is plain ES modules in `assets/js/`, so what is in the repo is what runs, and the site has no production dependencies. Zod and React went with Next.js. `assets/js/quotes/schema.js` validates by hand and passes the same tests.
- **The Demo Portal uses Alpine.js**, copied into `assets/js/vendor/`, on `/portal/` pages only. Its screens render in the browser, so crawlers that do not run JavaScript see only each page's title and description.
- **Links load a whole page.** Demo Portal state moves to `sessionStorage` to survive that, cleared on a refresh or on arriving from outside the portal, so it behaves as it did. On the Reference Site, clicking a link from partway down a page glided to just below the top, a side effect of Next.js with `scroll-behavior: smooth`. Here the new page opens at the very top.
- **Firebase is left out**, reversing ADR 0001's first position. There is nowhere for it in a Jekyll site. It remains readable on the `Ramya` branch of the archived Legacy Repository.
- **The Client Portal will be a separate app.** Jekyll cannot host a signed-in area. Nothing here needs to change when it is built, apart from where Client Login points.
- **GitHub's Jekyll is old and moves slowly** (the last `github-pages` release is from 2024). The site uses plain Liquid and no plugins, so little depends on the version.
