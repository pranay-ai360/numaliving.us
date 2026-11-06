# Serve the site at numaliving.us, with GitHub-issued HTTPS and Cloudflare DNS

The site is published at `https://numaliving.us/`. GitHub Pages serves the site and issues its certificate (Let's Encrypt, free, renewed automatically); the domain's DNS is on Cloudflare with every record set to "DNS only"; mail is handled by Forward Email. The bare domain is the main address, and `www.numaliving.us` and the GitHub Pages project address redirect to it. This was first set up on the Legacy Repository on 16 October 2026 and moved here at the Cutover.

## Considered options

- **Proxy the site through Cloudflare (orange cloud) with SSL mode Full (strict).** Would add a CDN, a firewall and an HSTS switch. Rejected for now: GitHub's own DNS check reads a proxied domain as "proxied" and can fail to issue or renew its certificate, and a small static site gains little from it. If it is ever turned on, use Full (strict), never Flexible (it loops with Enforce HTTPS).
- **`www.numaliving.us` as the main address.** GitHub redirects either name to the other when both records exist. The bare domain won, because it is what people type and what the Contact email uses.
- **DNS at the registrar (GoDaddy).** Works, but Cloudflare gives free DNS, scoped API tokens and easy automation.

## Consequences

- **DNS records for the site** (all "DNS only"): four `A` records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and four `AAAA` records (`2606:50c0:8000::153` to `2606:50c0:8003::153`) on the bare domain, and a `CNAME` for `www` pointing to `pranay-ai360.github.io`. Never add a wildcard (`*`) record: GitHub warns it allows takeovers. The Forward Email records (MX, SPF, DKIM, DMARC and three `CNAME`s) share the zone and are managed separately.
- **The custom domain is set on the repository** (Settings > Pages, or `gh api -X PUT repos/pranay-ai360/numaliving.us/pages -f cname=numaliving.us`). A site published from a branch stores it in a `CNAME` file at the root of that branch, so that file must stay there. It must not exist on a branch before the domain is free, or the build fails while another repository holds the domain.
- **The site builds for the domain root.** `baseurl` is `""` in `_config.yml`, which GitHub respects. Left unset, GitHub would fill it in during the build.
- **HTTPS.** Enforce HTTPS is switched on with `gh api -X PUT repos/pranay-ai360/numaliving.us/pages -F https_enforced=true` once `https_certificate.state` is `approved`. GitHub sends no `Strict-Transport-Security` header on a custom domain, so the 301 from `http` to `https` is the protection.
- **A stalled certificate.** GitHub's DNS check can keep a "no records" answer for up to 30 minutes (Cloudflare's SOA minimum is 1800 seconds). If it stalls, clear the domain and set it again, back to back, which starts the certificate within seconds. When doing domain work, never use `gh api -X DELETE .../pages`: it deletes the whole Pages site.
- **Mail.** DMARC is `p=reject` and SPF allows only Forward Email, so mail sent from an `@numaliving.us` address must go through Forward Email's SMTP. Sending as that address from another service is rejected by recipients.
- **Hardening.** The domain is verified with GitHub (profile Settings > Pages > Add a domain, then the `_github-pages-challenge-pranay-ai360` TXT record), so no other GitHub Pages site can claim it, above all while it is cleared from a repository.
- **The form's mailbox is public.** The Contact email is also the FormSubmit mailbox, and it is printed on every page, so the Form alias hides nothing: anyone can post to FormSubmit with the address itself. The upgrade paths are an unpublished mailbox just for FormSubmit, or a relay such as a Cloudflare Worker with Turnstile.
