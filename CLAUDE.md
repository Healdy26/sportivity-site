# Sportivity Consultants Website — Project Brief

This file gives any Claude Code session the full context for this project. Read it before making changes.

## What this is

The marketing site for Sportivity Consultants, run by Andy Heald (leadership consultant, keynote speaker, UA92 lecturer, Greater Manchester). The site was migrated off Wix and is now self-built and self-hosted.

- Live site: https://www.sportivityconsultants.com
- Apex (https://sportivityconsultants.com) redirects to the www version
- Both are live with SSL

## Tech stack

- **Astro** (built from the official blog template) — static site generator
- **GitHub** for version control — user `Healdy26`
- **Cloudflare Pages** for hosting — auto-deploys on every push to `master`
- **GitHub Pages** serves a tiny redirect site for the apex domain
- **Wix** still holds the domain registration and DNS (Wix won't allow nameserver changes for Wix-bought domains)
- **Formspree** powers the contact form
- **HubSpot** (free) powers the newsletter — signup form + subscriber list
- **Motion** powers booking: https://app.usemotion.com/meet/andy-heald/consultancy?d=60

## Repos and local paths

- Main site repo: https://github.com/Healdy26/sportivity-site — branch `master`
- Redirect repo: https://github.com/Healdy26/sportivity-redirect — branch `master`
- Local main site: `/Users/user/Documents/sportivity-site`
- Local redirect: `/Users/user/Documents/sportivity-redirect`
- Dev server: `npm run dev` then open http://localhost:4321

## Deploy workflow

After editing files:

```
cd ~/Documents/sportivity-site
git add .
git commit -m "describe the change"
git push
```

Cloudflare auto-deploys to www.sportivityconsultants.com in about 90 seconds. There is no separate build step to run by hand.

## Brand

- Accent red: `#DC2626`. Dark red: `#991B1B`. Near-black: `#111`. White.
- Logo lives at `public/logo.png` (red mark on transparent background).
- The footer uses a white version of the logo via CSS `filter: brightness(0) invert(1)` so it shows against the dark background. Do not swap the file for a white one, the filter handles it.
- Tagline: "Creating Exceptional Leaders for Smarter Businesses and a Healthier, Happier World"
- Three pillars: Better Leaders / Smarter Businesses / Healthier, Happier World
- Six services: Leadership Development & Executive Coaching; Strategic Consultancy & Organisational Development; Quality Assurance & Governance; Workforce Development & Qualifications; Bid Strategy & Growth Support; Digital Skills, Innovation & Future Readiness

## Contact details (used in header, footer, contact page)

- Email: andy@sportivityconsultants.com
- Phone: 07920 008 421
- Location line: Greater Manchester · Operating nationally
- LinkedIn: https://www.linkedin.com/in/andy-heald-sportivity/
- Booking link: https://app.usemotion.com/meet/andy-heald/consultancy?d=60

## File structure (the parts that matter)

```
sportivity-site/
├── public/
│   └── logo.png              static files served at the root, e.g. /logo.png
├── src/
│   ├── consts.ts             SITE_TITLE and SITE_DESCRIPTION
│   ├── content.config.ts     blog loader — base path is ./src/blog
│   ├── styles/global.css     site-wide CSS, design tokens, mobile rules
│   ├── assets/               images referenced by blog posts (Astro optimises these)
│   ├── blog/                 one .md file per blog post
│   ├── components/           Header, Footer, BaseHead, FormattedDate, HeaderLink, Newsletter (subscribe band)
│   ├── layouts/BlogPost.astro
│   └── pages/
│       ├── index.astro       homepage
│       ├── about.astro
│       ├── services.astro
│       ├── contact.astro     Formspree form
│       ├── newsletter.astro  /newsletter — hosts the HubSpot signup form
│       └── blog/             index.astro and [...slug].astro
```

## How to add a blog post

Create a new `.md` file in `src/blog/`. Frontmatter format:

```
---
title: 'Your title'
description: "One line summary."
pubDate: 'Dec 17 2025'
heroImage: '../assets/your-hero-image.jpg'
---
```

Then write the body in markdown. Save the hero image into `src/assets/` with a matching filename. For images inside the body, also put them in `src/assets/` and reference them as `![alt text](../assets/your-image.jpg)`.

## Gotchas learned the hard way

- **Images split two ways.** Blog hero and in-body images go in `src/assets/` (Astro's image pipeline optimises them, referenced with `../assets/...`). Static files like the logo go in `public/` and are served from the root (`/logo.png`). Putting a logo in `src/` and linking `/src/...` works in dev but breaks once deployed.
- **content.config.ts loader path is `./src/blog`.** The template ships pointing at `./src/content/blog`, which is wrong for this setup.
- **Restart the dev server after changing `content.config.ts`** (Ctrl+C, then `npm run dev`). Style changes sometimes need it too if they look stale.
- **`global.css` already has a `box-sizing: border-box` reset and `overflow-x: hidden` on html/body.** These fix mobile button overflow and a stray horizontal scroll. Keep them.
- **Headings scale down on mobile** in the `@media (max-width: 720px)` block in global.css. If a heading looks huge on a phone, adjust there.

## DNS — do not touch

These records live in Wix DNS and keep the site and email working:

- `www` CNAME → `sportivity-site.pages.dev` (this is what makes the main site load)
- Apex A records → GitHub Pages IPs `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (the redirect)
- MX → `aspmx.l.google.com` (Google Workspace email)
- SPF and Google verification TXT records (email + verification)
- Nameservers are locked by Wix and cannot be changed

## Newsletter (HubSpot)

A monthly email newsletter aimed at SME owners and directors. Themes: productivity, mental focus, clarity, performing in meetings, better leadership, leadership models and frameworks, theoretical edges, practical AI tips, and sector news (sport/physical activity, education, leadership).

- **Signup form** lives in HubSpot (free account). Portal `148710435`, EU data centre (`eu1`).
- **`src/components/Newsletter.astro`** is a call-to-action band ("The Monthly Edge / Sharper leadership, once a month") with a **Subscribe** button. It appears on the homepage, the blog index, and the end of every blog post (via `BlogPost.astro`).
- **`src/pages/newsletter.astro`** is the dedicated `/newsletter` page that actually hosts the HubSpot embed (on a white card). The form values (portal/form/region) are constants at the top of that file.
- **Keep Formspree and HubSpot separate**: Formspree = contact form, HubSpot = newsletter only. Don't merge them.
- **GDPR**: the HubSpot form has consent options enabled (UK audience). Don't remove the consent checkbox.
- **Monthly draft**: a scheduled Claude task (`sportivity-monthly-newsletter`) runs on the 1st of each month at 09:00, drafts the newsletter in Andy's voice, saves it to `newsletter-drafts/`, and notifies him. It drafts only — Andy reviews and sends from HubSpot. This task lives in Claude's scheduled tasks, not in the repo.

## Roadmap / open items

- **CQI as a paid product (future, real revenue).** The CQI framework (Continuous Quality Improvement / Coaching Quality Indicator) is Andy's sellable asset: a quality-assurance system for coaches, PE teaching and providers, mapped to CIMSPA standards and Ofsted, created by Andy and built across 2,000+ coaches. Plan is a paid subscription to access the CQI model, training and resources. Source materials live in `~/Claude Cowork/Outputs/CQI-2026/`. The launch newsletter introduces it; eventually it needs its own offer (gated training + resources), likely a members area or paywall. Big build, not started.
- **Header dropdown for Blog / Newsletter.** Andy wants the nav item to become a dropdown ("Blogs and Newsletters") rather than a single Blog link. Deferred for now.
- The template's placeholder `welcome.md` post can be deleted once enough real posts are live
- After the Wix registrar lock lifts (around August 2026), the domain could move to Cloudflare for cleaner DNS
- A leftover pending Cloudflare zone for the apex can be removed (harmless, just untidy)

## Voice for any written or on-site content

Andy's voice is warm, plain Northern English, story-led, never corporate. British spelling throughout (-ise, colour, organise). No em dashes. No corporate filler. Take a clear stance. Match the language of the audience.
