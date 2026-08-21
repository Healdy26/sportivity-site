# Posting to LinkedIn

Posts text straight to Andy's personal LinkedIn feed using LinkedIn's official API. No third-party service, no browser automation, nothing that breaches LinkedIn's terms.

## What this does and doesn't do

**Does:** text posts to Andy's personal profile.

**Doesn't:** the Sportivity Consultants company page. Page posting needs LinkedIn's Community Management API, which is partner-approval only and normally refused for one-person operations. Keep the page manual, or use a scheduler for it.

**Doesn't:** images, or scheduling. Both are possible later. Images need an extra upload step; scheduling would need something to run the command at a set time, which the Mac can do with a scheduled task.

## One-time setup (about 20 minutes, and it has to be you)

Steps 1 to 4 involve logging in and granting access, so they're yours to do. Claude can't and shouldn't do them.

**1. Create the app**

Go to https://www.linkedin.com/developers/apps and click Create app.

- App name: anything, e.g. "Sportivity Posting"
- LinkedIn Page: the Sportivity Consultants page. LinkedIn requires an app to be attached to a page, and it'll ask you to verify you control it. That verification is a link you open as the page admin.
- Tick the legal agreement and create it.

**2. Add the two products**

On the app's **Products** tab, request:

- **Sign In with LinkedIn using OpenID Connect** (so the script can find your member ID)
- **Share on LinkedIn** (the actual posting permission)

Both are self-serve and usually available within a minute or two. Refresh the page until they show as added.

**3. Add the redirect URL**

On the **Auth** tab, under "Authorized redirect URLs for your app", add exactly:

```
http://localhost:8765/callback
```

**4. Hand over the credentials**

Still on the Auth tab you'll see Client ID and Primary Client Secret. Run:

```bash
npm run linkedin:setup
```

It asks for each one, you paste them in. The secret is hidden as you type. It writes `.env.linkedin` for you, gitignored and readable only by you. Don't paste the secret into a chat, including to Claude.

**5. Authorise**

```bash
npm run linkedin:auth
```

It prints a URL. Open it, approve the request, done. The token is saved to `.linkedin-token.json` (also gitignored).

## Posting

Put the post in a plain text file, then:

```bash
npm run linkedin:post -- blog-drafts/linkedin/keegan.txt
```

That's a **dry run**. It prints the post exactly as it'll appear, with a character count, and stops. Nothing reaches LinkedIn.

When it looks right:

```bash
npm run linkedin:post -- blog-drafts/linkedin/keegan.txt --confirm
```

It prints the URL of the live post when it's done.

Options:

- `--confirm` actually publishes. Without it, nothing happens.
- `--connections-only` limits visibility to 1st-degree connections instead of public.

## The 60-day thing

Access tokens last 60 days. LinkedIn only gives the automatic refresh flow to approved Marketing Developer Platform partners, so a self-serve app can't renew silently. When it runs out, run `npm run linkedin:auth` again. The script warns you in the last week and tells you plainly when it's expired.

## Limits and gotchas

- 150 posts per member per day. Not a problem in practice.
- 3,000 character limit per post. The script checks before sending.
- Put your subscribe link in the **first comment**, not the post body. LinkedIn suppresses reach on posts containing outbound links. This script doesn't post comments, so that's a manual step, and it's worth doing.
- The script warns if it spots an em dash, since those aren't in Andy's voice.

## If something breaks

- **401** means the token expired. Run `npm run linkedin:auth`.
- **403 on the versioned API** is handled automatically, the script retries on the older UGC endpoint.
- **426 Upgrade Required** means the `LINKEDIN_VERSION` constant in `lib.mjs` is stale. Bump it to the current `YYYYMM`.
- **Posts come out with stray backslashes** would mean the escaping in `escapeCommentary` has drifted from what the API expects. Compare against the current Posts API docs.
