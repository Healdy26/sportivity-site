/**
 * Checks a piece of writing against Andy's own voice files.
 *
 * Reads the rules live from ~/Claude Cowork/About Me/anti-ai-writing.md, so
 * when Andy edits that file the check changes with it. Nothing is hardcoded
 * that he can't override by editing his own notes.
 *
 * Used automatically by the LinkedIn poster, and runnable on any file:
 *   npm run voice:check -- blog-drafts/something.md
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const ABOUT_ME_DIR = join(homedir(), 'Claude Cowork', 'About Me');
const RULES_FILE = join(ABOUT_ME_DIR, 'anti-ai-writing.md');

function sectionBody(markdown, heading) {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'mi');
  return markdown.match(pattern)?.[1] ?? '';
}

/** Pull the banned word and phrase lists out of Andy's own file. */
export function loadRules() {
  if (!existsSync(RULES_FILE)) return null;
  const md = readFileSync(RULES_FILE, 'utf8');

  const words = sectionBody(md, 'Banned words')
    .split('\n')
    .filter((l) => l.includes(',') && !l.startsWith('#'))
    .join(' ')
    .split(',')
    .map((w) =>
      w
        .replace(/\([^)]*\)/g, '') // drop notes like "(as a buzzword)"
        .replace(/[.:]/g, '')
        .trim()
    )
    .flatMap((w) => w.split('/').map((p) => p.trim())) // "seamless / seamlessly"
    .filter((w) => w && w.length > 2 && !w.includes(' '));

  const phrases = [];
  for (const line of sectionBody(md, 'Banned phrases').split('\n')) {
    if (!line.trim().startsWith('-')) continue;
    for (const match of line.matchAll(/"([^"]+)"/g)) {
      const phrase = match[1].replace(/\.{3}$/, '').trim();
      if (phrase) phrases.push(phrase);
    }
  }

  return { words: [...new Set(words)], phrases: [...new Set(phrases)] };
}

// Things his files describe in prose rather than a list, so they can't be parsed.
const STRUCTURES = [
  { re: /not only\b[\s\S]{0,80}?\bbut also\b/i, label: '"Not only... but also..."' },
  { re: /it'?s not just\b[\s\S]{0,60}?,\s*it'?s\b/i, label: '"It\'s not just X, it\'s Y"' },
  { re: /\bin conclusion\b|\bto summarise\b|\bin essence\b/i, label: 'wrap-up tag' },
  { re: /\blet'?s dive in\b|\bembark on a journey\b/i, label: 'AI opener' },
];

// Deliberately conservative. "fall" and "resume" are left out because they have
// perfectly normal British meanings and would fire on innocent sentences.
const AMERICANISMS = [
  'organize', 'organized', 'organizing', 'recognize', 'recognized', 'realize', 'realized',
  'apologize', 'prioritize', 'summarize', 'emphasize', 'specialize', 'minimize',
  'maximize', 'utilize', 'analyze', 'categorize', 'criticize',
  'math', 'vacation', 'trash', 'mom', 'gotten',
  'reach out', 'circle back', 'touch base',
];

function findAll(text, needle, { wholeWord = true } = {}) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, 'gi');
  const hits = [];
  for (const m of text.matchAll(re)) {
    const start = Math.max(0, m.index - 30);
    hits.push({
      match: m[0],
      context: (start > 0 ? '...' : '') + text.slice(start, m.index + m[0].length + 30).replace(/\n/g, ' ').trim() + '...',
    });
  }
  return hits;
}

/** Returns { errors, warnings, rulesLoaded }. Errors should stop a post. */
export function voiceCheck(text) {
  const errors = [];
  const warnings = [];
  const rules = loadRules();

  if (!rules) {
    warnings.push({
      label: 'voice files not found',
      detail: `Couldn't read ${RULES_FILE}, so only the built-in checks ran.`,
    });
  }

  for (const hit of findAll(text, '—', { wholeWord: false })) {
    errors.push({ label: 'em dash', detail: hit.context });
  }

  for (const word of rules?.words ?? []) {
    for (const hit of findAll(text, word)) {
      errors.push({ label: `banned word "${hit.match}"`, detail: hit.context });
    }
  }

  for (const phrase of rules?.phrases ?? []) {
    for (const hit of findAll(text, phrase, { wholeWord: false })) {
      errors.push({ label: `banned phrase "${hit.match}"`, detail: hit.context });
    }
  }

  for (const { re, label } of STRUCTURES) {
    const m = text.match(re);
    if (m) errors.push({ label: `banned structure, ${label}`, detail: m[0].replace(/\n/g, ' ').slice(0, 90) });
  }

  for (const word of AMERICANISMS) {
    for (const hit of findAll(text, word)) {
      errors.push({ label: `American spelling or idiom "${hit.match}"`, detail: hit.context });
    }
  }

  return { errors, warnings, rulesLoaded: Boolean(rules) };
}

export function reportVoiceCheck({ errors, warnings, rulesLoaded }) {
  if (rulesLoaded) console.log(`Voice check: read from ${ABOUT_ME_DIR}`);
  for (const w of warnings) console.warn(`  note: ${w.label} ${w.detail ? `- ${w.detail}` : ''}`);
  if (!errors.length) {
    console.log(`Voice check: passed.\n`);
    return;
  }
  console.error(`\nVoice check found ${errors.length} thing(s) that aren't Andy's voice:\n`);
  for (const e of errors) {
    console.error(`  ${e.label}`);
    console.error(`    ${e.detail}\n`);
  }
}

// Allow running directly on any file.
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file || !existsSync(file)) {
    console.error(`Usage: npm run voice:check -- <file>`);
    process.exit(1);
  }
  const result = voiceCheck(readFileSync(file, 'utf8'));
  reportVoiceCheck(result);
  process.exit(result.errors.length ? 1 : 0);
}
