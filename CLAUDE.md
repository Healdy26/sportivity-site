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
- **Calendly** powers booking: https://calendly.com/andy-sportivityconsultants/30min

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
- Booking link: https://calendly.com/andy-sportivityconsultants/30min

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

## Newsletter (Substack — "The Monthly Edge")

A monthly email newsletter aimed at SME owners and directors. Themes: productivity, mental focus, clarity, performing in meetings, better leadership, leadership models and frameworks, theoretical edges, practical AI tips, and sector news (sport/physical activity, education, leadership). Format is shifting to screenshot-led how-to guides (see `newsletter-drafts/how-to-newsletter-template.md`).

- **Platform: Substack** at `sportivityconsultants.substack.com` (publication "The Monthly Edge"). This is where Andy writes and sends. Free tier for now; paid comes later with the LMS.
- **Signup form** is the Substack embed (`sportivityconsultants.substack.com/embed`), hosted on `/newsletter` via an iframe. The embed URL is a constant at the top of `src/pages/newsletter.astro`.
- **`src/components/Newsletter.astro`** is a call-to-action band ("The Monthly Edge / Sharper leadership, once a month") with a **Subscribe** button linking to `/newsletter`. It appears on the homepage, the blog index, and the end of every blog post (via `BlogPost.astro`).
- **HubSpot is the CRM of record, not the signup form anymore.** Keep the contact list synced by exporting the Substack subscriber CSV monthly and importing to HubSpot. Formspree stays as the contact form. Don't merge the three.
- **GDPR / unsubscribe**: handled by Substack.
- **Monthly draft**: a scheduled Claude task (`sportivity-monthly-newsletter`) runs on the 1st of each month at 09:00, drafts the newsletter in Andy's voice, saves it to `newsletter-drafts/`, and notifies him. It drafts only — Andy reviews and sends from Substack. This task lives in Claude's scheduled tasks, not in the repo.

## Weekly blog ("published every Friday")

A weekly blog post, separate from the monthly newsletter. Published every Friday. Posts live in `src/blog/` (see "How to add a blog post" above).

- **Weekly draft**: a scheduled Claude task (`sportivity-weekly-blog`) runs every **Wednesday at 09:00**, so there's a day or two to review before Friday. It reads existing posts to avoid repeats, suggests 3 to 4 blog ideas for the week, writes ONE full draft from the strongest idea in Andy's voice, and notifies him. It drafts only — Andy reviews, edits, adds a hero image, then publishes.
- **Drafts land in `blog-drafts/`** (NOT `src/blog/`, so nothing auto-deploys before review). To publish: move the finished `.md` into `src/blog/`, save its hero image into `src/assets/` with the matching filename, then commit and push. This task lives in Claude's scheduled tasks, not in the repo.

## Roadmap / open items

- **CQI paid product (live).** The CQI framework (Continuous Quality Improvement / Coaching Quality Indicator) is Andy's sellable asset: a quality-assurance system for coaches, PE teaching and providers, mapped to CIMSPA standards and Ofsted, created by Andy across 2,000+ coaches. Sold via `src/pages/cqi.astro` (`/cqi`) — the "CQI Document Pack" at £250 one-off through a Stripe payment link. Delivery is **automated via Zapier**: Stripe payment → email with a private Drive/Dropbox download link (files stay OFF the public site — never put the paid PDFs in the repo or `public/`). Source materials: `~/Claude Cowork/Outputs/CQI-2026/`. CQI logo for Stripe: `brand-assets/cqi-logo.png`. Still to do: build the assessor training; the Zapier zap is set up in Andy's account, not the repo. Future: a members area / subscription for training + resources.
- **Leadership 360 appraisal app (in build, separate repo).** A custom 360-degree feedback web app, the first real product of the LMS. Lives in a SEPARATE project at `~/Documents/sportivity-360` (Next.js + Supabase + Stripe, to be hosted on a subdomain like `360.sportivityconsultants.com`), NOT in this repo. Pricing: £75 (1 person) / £199 (5) / £455 (10) / 10+ contact. Phase 1 done (DB schema + original 14-competency questionnaire seed + plan in that repo's `docs/`). The questionnaire is original Sportivity IP, modelled only on the structure of a sample (do NOT reuse the Promoting Excellence/ASDTi instrument). Sensitive data: aggregate-only reports, min 3 raters, UK/EU storage. Next: Andy creates Supabase/Stripe/Vercel accounts, then scaffold the app.
- **Learner Management System (LMS) — the big play.** Andy is building towards an LMS hosting training and resources, sold as a subscription. CQI is the first product/module, not the end goal. The funnel: The Monthly Edge newsletter (free, top of funnel) builds the audience → CQI (£250 one-off) → LMS subscription (training + resources). Modelled on Ruben Hassid's approach (free how-to newsletter feeding paid products). Not started; CQI assessor training is the bridge to it.
- **Newsletter platform: now on Substack.** Writing/sending moved from HubSpot to Substack (`sportivityconsultants.substack.com`). The `/newsletter` page embeds the Substack form and the Subscribe buttons point there — done. HubSpot stays as the CRM of record (monthly CSV export from Substack → import to HubSpot). Format is shifting to Ruben-style screenshot-led how-to guides, each ending with a share + a CTA to the relevant paid product (`newsletter-drafts/how-to-newsletter-template.md`).
- **Header dropdown for Blog / Newsletter.** Andy wants the nav item to become a dropdown ("Blogs and Newsletters") rather than a single Blog link. Deferred for now.
- The template's placeholder `welcome.md` post can be deleted once enough real posts are live
- After the Wix registrar lock lifts (around August 2026), the domain could move to Cloudflare for cleaner DNS
- A leftover pending Cloudflare zone for the apex can be removed (harmless, just untidy)

## Voice for any written or on-site content

Andy's voice is warm, plain Northern English, story-led, never corporate. British spelling throughout (-ise, colour, organise). No em dashes. No corporate filler. Take a clear stance. Match the language of the audience.

**Before writing anything in Andy's voice, read his voice files.** They are the source of truth and override the summary above:

- `~/Claude Cowork/About Me/ai-context.md` — voice and judgment profile
- `~/Claude Cowork/About Me/anti-ai-writing.md` — banned words, phrases and structures
- `~/Claude Cowork/About Me/voice-profile.md` — the deep archive of his stories and beliefs

Check any draft before it goes anywhere:

```
npm run voice:check -- path/to/draft.md
```

It reads the rules live out of `anti-ai-writing.md`, so editing that file changes the check everywhere. Works on blog drafts, newsletter drafts and LinkedIn posts alike.

## LinkedIn posting

Posts go to Andy's personal LinkedIn feed through LinkedIn's official API. Setup and full notes: `scripts/linkedin/README.md`.

**When Andy says "post this on LinkedIn", this is the whole procedure.** It works from any session, task or directory, because everything routes through one queue.

```
cd ~/Documents/sportivity-site
npm run linkedin                  # what's waiting, numbered
npm run linkedin -- 2             # preview item 2, posts nothing
npm run linkedin -- 2 --confirm   # post item 2, archives it automatically
```

If he's pointing at something that isn't in the queue yet (an idea in chat, a draft in a file, a line from a routine's output), add it first, then post it:

```
printf '%s' "<the post text>" | npm run linkedin -- --add some-slug
printf '%s' "<the post text>" | npm run linkedin -- --add some-slug --now   # time-sensitive: jumps the queue
npm run linkedin -- --radar       # every radar draft from the last 7 days, deduped
npm run linkedin -- --drop 3      # take item 3 back out without posting it
```

**Daily and immediate content goes straight away.** Anything tied to today's news gets `--now` when added (radar items get it automatically), which marks it `"priority": "immediate"` in `queued.json`. The auto poster picks immediate items first, ahead of anything else waiting; evergreen content queues behind them, oldest first. If Andy hands over something time-sensitive in a session, don't just queue it: queue it with `--now`, then offer to post it there and then.

Everything that generates LinkedIn content writes into this queue: the daily content radar, the weekly blog task and the monthly newsletter task all drop their post in `linkedin-queue/ready/`. So most of the time the answer to "post this on LinkedIn" is already sitting there waiting.

**"Post this on LinkedIn" is permission for that specific post, and nothing else.** Preview it, show him the text, then post. Never post something he hasn't pointed at.

Direct file posting still works if you need it:

```
npm run linkedin:post -- <file>            # dry run
npm run linkedin:post -- <file> --confirm  # publishes
```

Rules that matter:

- **The voice check runs automatically and blocks the post if it fails**, even with `--confirm`. That is deliberate. Don't reach for `--skip-voice-check` to get past it; fix the writing instead.
- **Always dry run first** and show Andy the output. Posting is public and irreversible.
- **Never post without Andy asking for that specific post to go out.** Drafting is not permission to publish.
- The subscribe link goes in the **first comment**, not the post body, because LinkedIn suppresses reach on posts with outbound links. The script can't post comments, so that stays manual.
- Company page posting is not possible here (needs LinkedIn partner approval). Personal profile only.
- The access token lasts 60 days. When it expires, `npm run linkedin:auth`.
