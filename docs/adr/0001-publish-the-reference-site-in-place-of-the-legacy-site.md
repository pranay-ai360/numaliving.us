# Publish the Reference Site in place of the Legacy Site

On 6 November 2026 the owner chose to replace the Legacy Site at `numaliving.us` (branch `main` of `pranay-ai360/numaliving.com.au`) with the Reference Site (branch `Ramya` of that repository, at `19d806fc`), published from this repository. The Reference Site's pages, content and structure are kept as they are, even where the Legacy Site had more, because they are the version the owner wants online. Only email delivery of Quote Requests was carried over from the Legacy Site.

## Consequences

These look like oversights to a later reader, but they are deliberate.

- **No privacy or terms pages.** `/privacy/` and `/terms/` return 404, even though the Quote Request form collects personal data. The owner accepted this. The Legacy drafts remain readable in the archived repository (`src/content/legal.ts`).
- **The Demo Portal is indexed.** The Reference Site marked it `noindex`, and the owner chose to index it, invented data included. Each page's description says it is a demo.
- **Page titles are the Reference Site's.** The Legacy Site's keyword-researched titles were not kept. They and the research behind them remain in the archived repository (`docs/seo/`).
- **Five project slugs differ from their photo folders.** `amherst` keeps its photos in `public/projects/Amherst/`, and `poppy-16` in `public/projects/Poppy_16/`. The slugs keep the Legacy Site's URLs, which were already submitted to Google.
- **Firebase code stays, unused.** It belongs to the planned Client Portal. Quote Requests go by email for as long as Firebase is unconfigured.
