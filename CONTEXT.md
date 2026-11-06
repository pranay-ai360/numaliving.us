# Numa Living Website

The public website for Numa Living, a luxury custom millwork manufacturer, published at `numaliving.us`.

## Language

**Reference Site**:
The snapshot of the website whose pages, content and structure the published site keeps. It comes from the `Ramya` branch of the Legacy Repository.
_Avoid_: template, source site, new site

**Legacy Site**:
The website published at `numaliving.us` until the Cutover, built from the `main` branch of the Legacy Repository.
_Avoid_: old site, current site, live site

**Legacy Repository**:
`pranay-ai360/numaliving.com.au`, the repository that holds the Legacy Site and published it until the Cutover.
_Avoid_: old repo, previous repo

**Cutover**:
The moment the Custom domain stops serving the Legacy Site and starts serving this repository's site.
_Avoid_: migration, launch, go-live

**Custom domain**:
`numaliving.us`, the address the site is served at. GitHub Pages serves the site and issues its HTTPS certificate, Cloudflare holds the DNS records, and Forward Email handles mail.
_Avoid_: live URL, production domain

**Quote Request**:
A visitor's inquiry about a prospective project, submitted through the "Request a Quote" form on the Contact page and delivered to Numa by email.
_Avoid_: contact form message, lead

**Drawings**:
The PDF drawings or bill of quantities a visitor attaches to a Quote Request.
_Avoid_: plans, uploads

**Contact email**:
The public address printed on the site and named in every "email us instead" message: `projects@numaliving.us`. Mail to it is received through Forward Email.
_Avoid_: inquiries address, info address

**Form alias**:
The random-string id FormSubmit issued once the Contact email was confirmed. Quote Requests post to it, and it is public by design.
_Avoid_: form key, form token, mailbox id

**Page registry**:
The list in `_data/pages.yml` with one entry per static page: its address, title and description. Each project keeps the same details in its own `_projects/` file. The page head and the sitemap read them, and the tests check what comes out.
_Avoid_: SEO file, meta file

**Client Login**:
The website's sign-in page. Nobody can sign in with a real account; it leads visitors to the Demo Portal.
_Avoid_: portal page, sign-in screen

**Demo Portal**:
A preview of the Client Portal on invented project data, reached from the Client Login. Nothing done in it is saved.
_Avoid_: portal, dashboard

**Client Portal**:
The planned members-only area where a client's project team follows drawings, approvals and production. It does not exist yet.
_Avoid_: dashboard, customer area, extranet
