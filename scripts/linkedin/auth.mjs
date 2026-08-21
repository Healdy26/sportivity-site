/**
 * One-time LinkedIn authorisation.
 *
 * Starts a local server, prints a URL for you to open, and swaps the code it
 * gets back for an access token. The token lands in .linkedin-token.json
 * (gitignored) and lasts 60 days.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  REDIRECT_URI,
  SCOPES,
  TOKEN_FILE,
  requireCredentials,
} from './lib.mjs';

const { clientId, clientSecret } = requireCredentials();
const state = randomBytes(16).toString('hex');

const authUrl =
  'https://www.linkedin.com/oauth/v2/authorization?' +
  new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state,
    scope: SCOPES,
  });

async function exchangeCodeForToken(code) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function fetchPersonUrn(accessToken) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Could not read your profile (${res.status}): ${JSON.stringify(body)}\n` +
        `Check the "Sign In with LinkedIn using OpenID Connect" product is added to your app.`
    );
  }
  return { urn: `urn:li:person:${body.sub}`, name: body.name };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8765');
  if (url.pathname !== '/callback') {
    res.writeHead(404).end('Not found');
    return;
  }

  const reply = (message) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:3rem;max-width:34rem">
      <h1 style="font-size:1.25rem">${message}</h1><p>You can close this tab.</p></body>`);
  };

  const error = url.searchParams.get('error');
  if (error) {
    reply('Authorisation was declined.');
    console.error(`\nLinkedIn returned: ${error} ${url.searchParams.get('error_description') ?? ''}`);
    server.close();
    process.exitCode = 1;
    return;
  }

  if (url.searchParams.get('state') !== state) {
    reply('State mismatch, stopping.');
    console.error('\nState did not match. Nothing saved. Run the command again.');
    server.close();
    process.exitCode = 1;
    return;
  }

  try {
    const token = await exchangeCodeForToken(url.searchParams.get('code'));
    const { urn, name } = await fetchPersonUrn(token.access_token);

    writeFileSync(
      TOKEN_FILE,
      JSON.stringify(
        {
          access_token: token.access_token,
          person_urn: urn,
          name,
          expires_at: Date.now() + token.expires_in * 1000,
        },
        null,
        2
      ) + '\n'
    );

    reply('Connected. LinkedIn posting is set up.');
    const days = Math.floor(token.expires_in / 86400);
    console.log(`\nConnected as ${name}`);
    console.log(`Token saved to ${TOKEN_FILE}`);
    console.log(`Valid for ${days} days. Re-run this command when it runs out.\n`);
  } catch (err) {
    reply('Something went wrong. Check the terminal.');
    console.error(`\n${err.message}\n`);
    process.exitCode = 1;
  }
  server.close();
});

server.listen(8765, () => {
  // Open it for them on macOS. If that fails they can still paste the URL.
  let opened = false;
  if (process.platform === 'darwin') {
    try {
      spawn('open', [authUrl], { stdio: 'ignore', detached: true }).unref();
      opened = true;
    } catch {
      opened = false;
    }
  }

  if (opened) {
    console.log('\nYour browser should have opened LinkedIn.');
    console.log('Click "Allow" on the page that appears.\n');
    console.log('If nothing opened, paste this in your browser instead:\n');
  } else {
    console.log('\nCopy this URL, paste it in your browser, and click "Allow":\n');
  }
  console.log(authUrl + '\n');
  console.log('Waiting for LinkedIn to send you back...\n');
});
