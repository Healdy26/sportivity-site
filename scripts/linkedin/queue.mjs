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
import { createHash } from 'node:crypto';
import { ROOT } from './lib.mjs';
import { voiceCheck } from './voice-check.mjs';

const QUEUE = join(ROOT, 'linkedin-queue');
const READY = join(QUEUE, 'ready');
const POSTED = join(QUEUE, 'posted');
const LOG = join(QUEUE, 'posted.log');
const LEDGER = join(QUEUE, 'posted.json');
const META = join(QUEUE, 'queued.json');
const RADAR = join(ROOT, 'content-radar.md');

for (const dir of [QUEUE, READY, POSTED]) mkdirSync(dir, { recursive: true });

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));

/**
 * The ledger, not the file location, decides what has been posted.
 *
 * This repo lives in iCloud Drive, which will happily restore a file we moved
 * out of ready/ minutes later. Relying on the move alone means a posted item
 * reappears in the queue and goes out twice. Hashing the text means it stays
 * caught even if the file comes back under a different name.
 */
function readLedger() {
  if (!existsSync(LEDGER)) return [];
  try {
    return JSON.parse(readFileSync(LEDGER, 'utf8'));
  } catch {
    console.warn(`Couldn't read ${LEDGER}, treating it as empty.`);
    return [];
  }
}

function hash(text) {
  return createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
}

function recordPosted(name, text) {
  const ledger = readLedger();
  ledger.push({ name, sha: hash(text), posted: new Date().toISOString() });
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');
}

function items() {
  const ledger = readLedger();
  const postedNames = new Set(ledger.map((e) => e.name));
  const postedShas = new Set(ledger.map((e) => e.sha));

  return readdirSync(READY)
    .filter((f) => f.endsWith('.txt'))
    .sort()
    .map((name) => {
      const text = readFileSync(join(READY, name), 'utf8').trim();
      return { name, text, voice: voiceCheck(text) };
    })
    .filter((item) => !postedNames.has(item.name) && !postedShas.has(hash(item.text)));
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

/** When each item was queued, and the date of the news behind it. */
function readMeta() {
  if (!existsSync(META)) return {};
  try {
    return JSON.parse(readFileSync(META, 'utf8'));
  } catch {
    return {};
  }
}

function add(text, slug, sourceDate, priority = null) {
  const trimmed = text.trim();
  if (!trimmed) {
    console.error('Nothing to add, the text was empty.');
    process.exit(1);
  }
  const name = `${nextNumber()}-${slugify(slug || trimmed.split('\n')[0])}.txt`;
  writeFileSync(join(READY, name), trimmed + '\n');

  const meta = readMeta();
  meta[name] = { added: new Date().toISOString(), sourceDate: sourceDate ?? null };
  if (priority) meta[name].priority = priority;
  writeFileSync(META, JSON.stringify(meta, null, 2) + '\n');
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
    // Radar items are daily, time-sensitive content: they jump the queue.
    add(body, label, date ?? null, 'immediate');
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


/**
 * Post without anyone approving it. Used by the scheduled poster.
 *
 * Guardrails, because nobody is reading this before it reaches his network:
 *   - never more than MAX_PER_DAY posts in a rolling day
 *   - never two posts closer together than MIN_GAP_HOURS
 *   - never anything whose news is older than MAX_AGE_DAYS
 *   - the voice check still blocks, and the ledger still stops duplicates
 * If any of those bite, it exits quietly. Silence is a valid outcome.
 */
const MAX_PER_DAY = 3;
const MIN_GAP_HOURS = 2.5;
const MAX_AGE_DAYS = 3;

function auto() {
  const ledger = readLedger();
  const now = Date.now();

  const recent = ledger
    .map((e) => new Date(e.posted).getTime())
    .filter((t) => !Number.isNaN(t));

  const inLastDay = recent.filter((t) => now - t < 86400000).length;
  if (inLastDay >= MAX_PER_DAY) {
    console.log(`Already posted ${inLastDay} time(s) in the last 24h. Cap is ${MAX_PER_DAY}. Nothing to do.`);
    return;
  }

  const last = recent.length ? Math.max(...recent) : 0;
  const gapHours = (now - last) / 3600000;
  if (last && gapHours < MIN_GAP_HOURS) {
    console.log(`Last post was ${gapHours.toFixed(1)}h ago, minimum gap is ${MIN_GAP_HOURS}h. Nothing to do.`);
    return;
  }

  const meta = readMeta();
  const all = items();
  if (!all.length) {
    console.log('Queue is empty. Nothing to do.');
    return;
  }

  const fresh = [];
  const stale = [];
  for (const item of all) {
    const m = meta[item.name] ?? {};
    const when = m.sourceDate ? new Date(m.sourceDate) : m.added ? new Date(m.added) : null;
    const ageDays = when ? (now - when.getTime()) / 86400000 : 0;
    (ageDays > MAX_AGE_DAYS ? stale : fresh).push({ item, ageDays });
  }

  if (stale.length) {
    console.log(`Skipping ${stale.length} item(s) older than ${MAX_AGE_DAYS} days:`);
    for (const s of stale) console.log(`  ${s.item.name} (${s.ageDays.toFixed(1)} days old)`);
  }

  if (!fresh.length) {
    console.log('Nothing fresh enough to post. Nothing to do.');
    return;
  }

  // Immediate items jump the queue. Daily and time-sensitive content goes
  // straight away; everything else waits its turn, oldest first, so nothing
  // sits and rots.
  fresh.sort((a, b) => {
    const pa = meta[a.item.name]?.priority === 'immediate' ? 0 : 1;
    const pb = meta[b.item.name]?.priority === 'immediate' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.ageDays - a.ageDays;
  });
  const chosen = fresh[0].item;
  const index = all.indexOf(chosen) + 1;
  console.log(`Auto-posting: ${chosen.name}\n`);
  post(index, { publish: true });
}

/**
 * Post the newest queued item straight away.
 *
 * For breaking news, waiting for a scheduled slot defeats the point. This skips
 * the minimum-gap rule on purpose. It still honours the daily cap, the
 * freshness window, the voice check and the duplicate ledger.
 */
function postNow() {
  const ledger = readLedger();
  const now = Date.now();

  const inLastDay = ledger
    .map((e) => new Date(e.posted).getTime())
    .filter((t) => !Number.isNaN(t) && now - t < 86400000).length;

  if (inLastDay >= MAX_PER_DAY) {
    console.log(`Already posted ${inLastDay} time(s) today, cap is ${MAX_PER_DAY}. Holding it in the queue.`);
    return;
  }

  const meta = readMeta();
  const all = items();
  if (!all.length) {
    console.log('Queue is empty. Nothing to post.');
    return;
  }

  // Newest first: breaking news beats whatever has been sat there.
  const ranked = all
    .map((item) => {
      const m = meta[item.name] ?? {};
      const when = m.sourceDate ? new Date(m.sourceDate) : m.added ? new Date(m.added) : new Date(0);
      return { item, when, ageDays: (now - when.getTime()) / 86400000 };
    })
    .sort((a, b) => b.when - a.when);

  const pick = ranked.find((r) => r.ageDays <= MAX_AGE_DAYS);
  if (!pick) {
    console.log(`Nothing in the queue is newer than ${MAX_AGE_DAYS} days. Not posting stale news.`);
    return;
  }

  console.log(`Posting now: ${pick.item.name} (${pick.ageDays.toFixed(1)} days old)\n`);
  post(all.indexOf(pick.item) + 1, { publish: true });
}

function list() {
  const all = items();
  const meta = readMeta();
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
    const prio = meta[item.name]?.priority === 'immediate' ? ', IMMEDIATE' : '';
    console.log(`  ${i + 1}. ${first}${item.text.split('\n')[0].length > 62 ? '...' : ''}`);
    console.log(`     ${item.text.length} chars, ${status}${prio}, ${item.name}\n`);
  });
  console.log(`Preview:  npm run linkedin -- 1`);
  console.log(`Post it:  npm run linkedin -- 1 --confirm\n`);
}

function post(index, { publish = confirm } = {}) {
  const all = items();
  const item = all[index - 1];
  if (!item) {
    console.error(`\nThere's no item ${index}. There ${all.length === 1 ? 'is 1 item' : `are ${all.length} items`} in the queue.\n`);
    process.exit(1);
  }

  // Hand off to the poster so there is exactly one code path that talks to
  // LinkedIn, and exactly one place the voice check is enforced.
  const passthrough = flags.filter((f) => !['--radar', '--auto', '--confirm'].includes(f));
  if (publish) passthrough.push('--confirm');
  const result = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'linkedin', 'post.mjs'), join(READY, item.name), ...passthrough],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!publish) return;

  // Record first. If iCloud restores the file, the ledger still keeps it out
  // of the queue, so nothing goes out twice.
  const stamp = new Date().toISOString().slice(0, 10);
  recordPosted(item.name, item.text);
  appendFileSync(LOG, `${stamp}  ${item.name}\n`);
  try {
    renameSync(join(READY, item.name), join(POSTED, item.name));
  } catch (err) {
    console.warn(`Couldn't archive the file (${err.code}), but it's recorded as posted.`);
  }
  console.log(`Recorded as posted. ${all.length - 1} left in the queue.\n`);
}

// --add is checked before --now on purpose: `--add <slug> --now` means "queue
// this and send it straight out", so the add has to happen first. A bare --now
// posts whatever is newest in the queue.
if (flags.includes('--add')) {
  const slug = positional[0];
  const piped = !process.stdin.isTTY ? readFileSync(0, 'utf8') : '';
  if (!piped.trim()) {
    console.error(`Pipe the text in, e.g.\n  echo "your post" | npm run linkedin -- --add my-slug\n`);
    process.exit(1);
  }
  add(piped, slug, null, flags.includes('--now') ? 'immediate' : null);
  if (flags.includes('--now')) postNow();
} else if (flags.includes('--now')) {
  postNow();
} else if (flags.includes('--auto')) {
  auto();
} else if (flags.includes('--radar')) {
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
  add(stdin, slug, null, flags.includes('--now') ? 'immediate' : null);
} else if (positional.length) {
  post(parseInt(positional[0], 10));
} else {
  list();
}
