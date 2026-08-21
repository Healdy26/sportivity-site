/**
 * Asks for the two LinkedIn credentials and writes .env.linkedin.
 *
 * Beats editing a hidden dotfile by hand: no text editor, no risk of TextEdit
 * saving it as rich text, and the secret never goes near your shell history.
 */
import { createInterface } from 'node:readline';
import { writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { ENV_FILE } from './lib.mjs';

// One interface for the whole run. Opening a fresh one per question leaves
// stdin closed after the first answer and the next question hangs forever.
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

rl._writeToOutput = function (str) {
  if (rl.muted) rl.output.write('*');
  else rl.output.write(str);
};

// Queue every line as it arrives. Without this, input that turns up faster than
// we ask for it (a paste of several lines, or piped input) gets dropped between
// questions and the script hangs waiting for something already gone.
const pending = [];
const waiting = [];
let closed = false;

rl.on('line', (line) => {
  if (waiting.length) waiting.shift()(line);
  else pending.push(line);
});
rl.on('close', () => {
  closed = true;
  while (waiting.length) waiting.shift()(null);
});

function nextLine() {
  return new Promise((resolve) => {
    if (pending.length) resolve(pending.shift());
    else if (closed) resolve(null);
    else waiting.push(resolve);
  });
}

async function ask(prompt, { mask = false } = {}) {
  rl.muted = false; // keep the prompt itself readable
  process.stdout.write(prompt);
  rl.muted = mask; // mute only what they type
  const answer = await nextLine();
  rl.muted = false;
  if (mask) process.stdout.write('\n');
  if (answer === null) return '';
  // Strip quotes and stray whitespace so a sloppy paste still works.
  return answer.trim().replace(/^["']|["']$/g, '').trim();
}

function fail(message) {
  rl.close();
  console.error(`\n${message}\nRun the command again when you've got it.\n`);
  process.exit(1);
}

function check(label, value) {
  if (!value) return `${label} is empty.`;
  if (value.includes('PASTE_')) return `That's the placeholder text, not your real ${label}.`;
  if (/\s/.test(value)) return `${label} has a space in it. Copy just the code itself.`;
  return null;
}

console.log(`\nLinkedIn setup\n`);
console.log(`Get both of these from https://www.linkedin.com/developers/apps`);
console.log(`Open your app, click the Auth tab, look under "Application credentials".\n`);

if (existsSync(ENV_FILE) && !readFileSync(ENV_FILE, 'utf8').includes('PASTE_')) {
  const again = await ask(`You've already set this up. Replace it? (y/n) `);
  if (again.toLowerCase() !== 'y') {
    rl.close();
    console.log(`\nLeft as it was. Nothing changed.\n`);
    process.exit(0);
  }
  console.log();
}

const clientId = await ask(`Paste your Client ID and press enter:\n> `);
const idProblem = check('Client ID', clientId);
if (idProblem) fail(idProblem);

console.log();
const clientSecret = await ask(`Paste your Primary Client Secret and press enter:\n> `, { mask: true });
const secretProblem = check('Client Secret', clientSecret);
if (secretProblem) fail(secretProblem);

rl.close();

writeFileSync(
  ENV_FILE,
  `# Written by npm run linkedin:setup. This file is gitignored, keep it off email and chat.\n` +
    `LINKEDIN_CLIENT_ID=${clientId}\n` +
    `LINKEDIN_CLIENT_SECRET=${clientSecret}\n`,
  { mode: 0o600 }
);
// mode above only applies when the file is created, so set it explicitly too.
chmodSync(ENV_FILE, 0o600);

console.log(`\nSaved.`);
console.log(`  Client ID:     ${clientId.slice(0, 4)}${'*'.repeat(Math.max(0, clientId.length - 4))}`);
console.log(`  Client Secret: ${'*'.repeat(clientSecret.length)}`);
console.log(`\nNow run:\n\n  npm run linkedin:auth\n`);
