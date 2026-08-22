/**
 * The LinkedIn queue. One place everything waiting to be posted lives.
 *
 *   npm run linkedin                 list what's waiting
 *   npm run linkedin -- 2            preview item 2 (posts nothing)
 *   npm run linkedin -- 2 --confirm  post item 2, then archive it
 *   npm run linkedin -- --radar      pull the newest content-radar draft in
 *   echo "text" | npm run linkedin -- --add my-slug
 *
 * Anything that wants posting gets dropped in linkedin-queue/ready/ as a .txt
 * file. Routines write there, Andy writes there, Claude writes there. Then it
 * is always the same two words: post this.
 */
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  renameSync,
  existsSync,
  appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';
import { voiceCheck } from './voice-check.mjs';

const QUEUE = join(ROOT, 'linkedin-queue');
const READY = join(QUEUE, 'ready');
const POSTED = join(QUEUE, 'posted');
const LOG = join(QUEUE, 'posted.log');
const RADAR = join(ROOT, 'content-radar.md');

for (const dir of [QUEUE, READY, POSTED]) mkdirSync(dir, { recursive: true });

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));

function items() {
  return readdirSync(READY)
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .map((name) => {
      const text = readFileSync(join(READY, name), 'utf8').trim();
      return { name, text, voice: voiceCheck(text) };
    });
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'post';
}

function nextNumber() {
  const used = readdirSync(READY)
    .concat(readdirSync(POSTED))
    .map((f) => parseInt(f.slice(0, 3), 10))
    .filter((n) => !Number.isNaN(n));
  return String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0');
}

function add(text, slug) {
  const trimmed = text.trim();
  if (!trimmed) {
    console.error('Nothing to add, the text was empty.');
    process.exit(1);
  }
  const name = `${nextNumber()}-${slugify(slug || trimmed.split('\n')[0])}.txt`;
  writeFileSync(join(READY, name), trimmed + '\n');
  const v = voiceCheck(trimmed);
  console.log(`\nAdded to the queue: ${name}`);
  console.log(v.errors.length ? `  Voice check: ${v.errors.length} problem(s), run npm run voice:check on it` : `  Voice check: passed`);
  console.log(`\nSee the queue with:  npm run linkedin\n`);
}

function alreadyQueued(slug) {
  return readdirSync(READY)
    .concat(readdirSync(POSTED))
    .some((f) => f.replace(/^\d{3}-/, '').replace(/\.txt$/, '') === slug);
}

/**
 * Pull "LinkedIn draft:" blocks out of the content radar bank.
 * `days` limits how far back to go, so old news doesn't creep back in.
 */
function addFromRadar(days = 1) {
  if (!existsSync(RADAR)) {
    console.error(`No content-radar.md yet. The daily radar task writes it when something clears the bar.`);
    process.exit(1);
  }
  const entries = readFileSync(RADAR, 'utf8').split(/^## /m).slice(1);
  if (!entries.length) {
    console.error(`content-radar.md has no entries yet.`);
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  let added = 0;
  let skippedOld = 0;

  for (const entry of entries) {
    const heading = entry.split('\n')[0].trim();
    const date = heading.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (date && date < cutoff) {
      skippedOld++;
      continue;
    }

    const marker = entry.match(/\*\*LinkedIn draft:?\*\*:?/i);
    if (!marker) continue;

    let body = entry.slice(marker.index + marker[0].length);
    body = body.split(/^\*\*Folds into/m)[0].split(/^---\s*$/m)[0].trim();
    if (!body) continue;

    const label = heading.replace(/^\d{4}-\d{2}-\d{2}\s*(\([^)]*\))?\s*[:–-]*\s*/, '');
    if (alreadyQueued(slugify(label))) {
      console.log(`  already in the queue, skipping: ${label.slice(0, 60)}`);
      continue;
    }

    console.log(`\nFrom the radar (${date ?? 'undated'}): ${heading.slice(0, 70)}`);
    add(body, label);
    added++;
  }

  if (!added) console.log(`\nNothing new to add from the last ${days} day(s).\n`);
  if (skippedOld) console.log(`Skipped ${skippedOld} entry(s) older than ${days} days.\n`);
}

/** Take something back out of the queue without posting it. */
function drop(index) {
  const all = items();
  const item = all[index - 1];
  if (!item) {
    console.error(`\nThere's no item ${index}. The queue has ${all.length}.\n`);
    process.exit(1);
  }
  mkdirSync(join(QUEUE, 'dropped'), { recursive: true });
  renameSync(join(READY, item.name), join(QUEUE, 'dropped', item.name));
  console.log(`\nDropped ${item.name}. It's in linkedin-queue/dropped/ if you want it back.`);
  console.log(`${items().length} left in the queue.\n`);
}

function list() {
  const all = items();
  if (!all.length) {
    console.log(`\nNothing waiting.\n`);
    console.log(`Add something:`);
    console.log(`  npm run linkedin -- --radar              from the daily content radar`);
    console.log(`  echo "your post" | npm run linkedin -- --add my-slug\n`);
    return;
  }
  console.log(`\n${all.length} waiting to post:\n`);
  all.forEach((item, i) => {
    const first = item.text.split('\n')[0].slice(0, 62);
    const status = item.voice.errors.length ? `${item.voice.errors.length} voice problem(s)` : 'voice ok';
    console.log(`  ${i + 1}. ${first}${item.text.split('\n')[0].length > 62 ? '...' : ''}`);
    console.log(`     ${item.text.length} chars, ${status}, ${item.name}\n`);
  });
  console.log(`Preview:  npm run linkedin -- 1`);
  console.log(`Post it:  npm run linkedin -- 1 --confirm\n`);
}

function post(index) {
  const all = items();
  const item = all[index - 1];
  if (!item) {
    console.error(`\nThere's no item ${index}. There ${all.length === 1 ? 'is 1 item' : `are ${all.length} items`} in the queue.\n`);
    process.exit(1);
  }

  // Hand off to the poster so there is exactly one code path that talks to
  // LinkedIn, and exactly one place the voice check is enforced.
  const passthrough = flags.filter((f) => f !== '--radar');
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'linkedin', 'post.mjs'), join(READY, item.name), ...passthrough],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!confirm) return;

  const stamp = new Date().toISOString().slice(0, 10);
  renameSync(join(READY, item.name), join(POSTED, item.name));
  appendFileSync(LOG, `${stamp}  ${item.name}\n`);
  console.log(`Archived to linkedin-queue/posted/. ${items().length} left in the queue.\n`);
}

if (flags.includes('--radar')) {
  // Default to a week, which is what Andy asks for: only what's recent.
  const days = positional.length ? parseInt(positional[0], 10) : 7;
  addFromRadar(Number.isNaN(days) ? 7 : days);
} else if (flags.includes('--drop')) {
  drop(parseInt(positional[0], 10));
} else if (flags.includes('--add')) {
  const slug = positional[0];
  const stdin = existsSync('/dev/stdin') && !process.stdin.isTTY ? readFileSync(0, 'utf8') : '';
  if (!stdin.trim()) {
    console.error(`Pipe the text in, e.g.\n  echo "your post" | npm run linkedin -- --add my-slug\n`);
    process.exit(1);
  }
  add(stdin, slug);
} else if (positional.length) {
  post(parseInt(positional[0], 10));
} else {
  list();
}
