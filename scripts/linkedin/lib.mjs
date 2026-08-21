import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ENV_FILE = join(ROOT, '.env.linkedin');
export const TOKEN_FILE = join(ROOT, '.linkedin-token.json');

export const REDIRECT_URI = 'http://localhost:8765/callback';
export const SCOPES = 'openid profile w_member_social';

// LinkedIn versions the REST API monthly, in YYYYMM. Bump this if a call starts
// returning 426 Upgrade Required.
export const LINKEDIN_VERSION = '202605';

/** Minimal KEY=VALUE reader so we don't pull in a dotenv dependency. */
export function loadEnv() {
  const env = { ...process.env };
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (value) env[key] = value;
    }
  }
  return env;
}

export function requireCredentials() {
  const env = loadEnv();
  const clientId = env.LINKEDIN_CLIENT_ID;
  const clientSecret = env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      `Missing credentials.\n\n` +
        `Create ${ENV_FILE} containing:\n\n` +
        `  LINKEDIN_CLIENT_ID=your-client-id\n` +
        `  LINKEDIN_CLIENT_SECRET=your-client-secret\n\n` +
        `Both come from your app at https://www.linkedin.com/developers/apps (Auth tab).\n` +
        `That file is gitignored, so the secret stays on your machine.`
    );
    process.exit(1);
  }
  return { clientId, clientSecret };
}

export function readToken() {
  if (!existsSync(TOKEN_FILE)) {
    console.error(
      `No saved token. Run this first:\n\n  npm run linkedin:auth\n`
    );
    process.exit(1);
  }
  const token = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
  const daysLeft = Math.floor((token.expires_at - Date.now()) / 86400000);
  if (daysLeft <= 0) {
    console.error(
      `Token expired ${Math.abs(daysLeft)} day(s) ago. LinkedIn does not give\n` +
        `self-serve apps a refresh flow, so re-authorise:\n\n  npm run linkedin:auth\n`
    );
    process.exit(1);
  }
  if (daysLeft <= 7) {
    console.warn(`Heads up: this token expires in ${daysLeft} day(s). Re-run npm run linkedin:auth soon.\n`);
  }
  return token;
}

/**
 * The Posts API treats commentary as "LittleText", where these characters carry
 * markup meaning and have to be escaped or the post comes out mangled.
 */
export function escapeCommentary(text) {
  return text.replace(/[|{}@[\]()<>#\\*_~]/g, (char) => `\\${char}`);
}

export const POST_CHARACTER_LIMIT = 3000;
