/**
 * Post a text file to Andy's LinkedIn feed.
 *
 *   npm run linkedin:post -- path/to/post.txt              (dry run, shows exactly what would go)
 *   npm run linkedin:post -- path/to/post.txt --confirm    (actually posts)
 *
 * Dry run is the default on purpose. Nothing reaches LinkedIn without --confirm.
 */
import { readFileSync, existsSync } from 'node:fs';
import {
  LINKEDIN_VERSION,
  POST_CHARACTER_LIMIT,
  escapeCommentary,
  readToken,
} from './lib.mjs';
import { voiceCheck, reportVoiceCheck } from './voice-check.mjs';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const connectionsOnly = args.includes('--connections-only');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error(
    `Usage: npm run linkedin:post -- <file> [--confirm] [--connections-only]\n\n` +
      `Without --confirm it prints the post and stops.`
  );
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const text = readFileSync(file, 'utf8').trim();

if (!text) {
  console.error(`${file} is empty.`);
  process.exit(1);
}

if (text.length > POST_CHARACTER_LIMIT) {
  console.error(
    `That's ${text.length} characters. LinkedIn caps a post at ${POST_CHARACTER_LIMIT}.\n` +
      `Trim ${text.length - POST_CHARACTER_LIMIT} and try again.`
  );
  process.exit(1);
}

// Every post goes through here, so this is the one place a voice check can't be
// forgotten, whichever session, task or person is doing the posting.
const skipVoiceCheck = args.includes('--skip-voice-check');
const voice = voiceCheck(text);
reportVoiceCheck(voice);

if (voice.errors.length && !skipVoiceCheck) {
  console.error(
    `Not posting. Fix those, or if they're deliberate re-run with --skip-voice-check.\n`
  );
  process.exit(1);
}
if (voice.errors.length && skipVoiceCheck) {
  console.warn(`Overriding the voice check because --skip-voice-check was passed.\n`);
}

const token = readToken();
const visibility = connectionsOnly ? 'CONNECTIONS' : 'PUBLIC';

console.log('\n' + '─'.repeat(60));
console.log(text);
console.log('─'.repeat(60));
console.log(`\n${text.length}/${POST_CHARACTER_LIMIT} characters, visibility ${visibility}, as ${token.name}`);

if (!confirm) {
  console.log(`\nDry run. Nothing was posted.`);
  console.log(`To publish for real, add --confirm to the same command.\n`);
  process.exit(0);
}

/** Current Posts API. */
async function postViaRestPosts() {
  return fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author: token.person_urn,
      commentary: escapeCommentary(text),
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
}

/** Older UGC endpoint, still what the self-serve "Share on LinkedIn" docs use. */
async function postViaUgcPosts() {
  return fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: token.person_urn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
    }),
  });
}

function postUrlFrom(res) {
  const id = res.headers.get('x-restli-id');
  return id ? `https://www.linkedin.com/feed/update/${id}/` : null;
}

console.log('\nPosting...');

let res = await postViaRestPosts();

// 426 means the version header is stale, 403 can mean the app isn't cleared for
// the versioned API. Either way the older endpoint usually still works.
if (res.status === 426 || res.status === 403) {
  console.log(`Versioned API returned ${res.status}, falling back to the UGC endpoint...`);
  res = await postViaUgcPosts();
}

if (!res.ok) {
  const body = await res.text();
  console.error(`\nLinkedIn rejected it (${res.status}):\n${body}\n`);
  if (res.status === 401) {
    console.error(`That's usually an expired token. Run: npm run linkedin:auth`);
  }
  if (res.status === 429) {
    console.error(`That's the rate limit. 150 posts per member per day, resets at UTC midnight.`);
  }
  process.exit(1);
}

const url = postUrlFrom(res);
console.log(`\nPosted.`);
if (url) console.log(url);
console.log();
