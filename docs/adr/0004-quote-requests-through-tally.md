# Quote Requests go through an embedded Tally form

On 6 November 2026 FormSubmit stopped answering: HTTP 522 from every country tested, for over five hours, with no public word about it. The owner chose to move Quote Requests to Tally. Tally has no documented way to take a submission from a form of our own: its API can create and read forms, but it cannot submit one. So the Contact page embeds Tally's form in an iframe, which replaces the site's own form rather than only where it sends.

## Consequences

- **The form looks like Tally's.** This is the one place the site no longer matches the Reference Site, so `e2e/parity.spec.ts` compares the rest of the Contact page. On Tally's free plan the form carries Tally's branding, and custom CSS needs Pro. Upgrading changes nothing in this repo.
- **The form's questions live in Tally**, not here. Edit them in Tally's editor. `_config.yml` holds only the form's id, which is public by design.
- **Where requests go.** On the free plan Tally emails the account's own address, and setting another recipient or a reply-to address needs Pro. Drawings arrive as links, up to 10 MB each, rather than as attachments. Every request also stays in Tally's Submissions tab, so an email problem does not lose it.
- **The API key never goes in the site.** It opens the whole Tally account, and this repo and site are public. It was needed once, from one machine, to create the form. `tally-api-key.json` is git-ignored and excluded from builds, which `tests/config.test.ts` and `e2e/published-files.spec.ts` check. Nothing at runtime needs it, so it can be revoked.
- **A way out is always on the page.** A line under the form names the Contact email, and if Tally's script cannot load, an alert replaces the form. The FormSubmit outage is why.
- **Tally's script has no integrity check.** Tally changes `embed.js` in place, so one would break the form each time it does. It loads on the Contact page only.
- **The honeypot and the two-second check went with the old form.** If spam arrives, Tally offers a CAPTCHA block.
- **Tests cannot reach the real form.** `e2e/fixtures.ts` gives every test a stand-in for Tally, and any other off-machine request fails the test.
