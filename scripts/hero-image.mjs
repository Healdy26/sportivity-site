#!/usr/bin/env node
/**
 * Generate an on-brand hero image for a blog post.
 *
 *   node scripts/hero-image.mjs <slug> ["Optional title override"]
 *   node scripts/hero-image.mjs --all        # fill every post missing an image
 *
 * Reads the title straight out of src/blog/<slug>.md unless you pass one.
 * Writes src/assets/<slug>.png at 1200x630, which is also the right shape
 * for the social share card.
 *
 * These are title cards, not photographs. They exist so a post never goes
 * live bare. Swap any of them for a real photo whenever you have one: keep
 * the filename and the frontmatter needs no change.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG = join(ROOT, 'src', 'blog');
const ASSETS = join(ROOT, 'src', 'assets');
const LOGO = join(ROOT, 'public', 'logo.png');

const W = 1200;
const H = 630;
const RED = '#DC2626';
const DARK = '#111111';

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

/** Rough text width for Helvetica Bold, good enough for wrapping. */
const widthOf = (s, size) =>
	[...s].reduce((n, c) => n + (/[ilIjtf.,'!|]/.test(c) ? 0.30 : /[mwMW]/.test(c) ? 0.88 : 0.56), 0) * size;

function wrap(text, size, maxWidth) {
	const lines = [];
	let line = '';
	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (widthOf(next, size) > maxWidth && line) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** Pick the biggest size that fits in at most 4 lines. */
function fitTitle(title, maxWidth) {
	for (const size of [78, 72, 66, 60, 54, 48, 44]) {
		const lines = wrap(title, size, maxWidth);
		if (lines.length <= 4) return { size, lines };
	}
	return { size: 44, lines: wrap(title, 44, maxWidth).slice(0, 4) };
}

const esc = (s) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Red mark -> white silhouette, the same trick the footer does in CSS. */
async function whiteLogo(height) {
	const src = sharp(LOGO).resize({ height, fit: 'inside' });
	const { width, height: h } = await src.clone().toBuffer({ resolveWithObject: true })
		.then(({ info }) => info);
	const alpha = await src.clone().ensureAlpha().extractChannel('alpha').toBuffer();
	return sharp({ create: { width, height: h, channels: 3, background: { r: 255, g: 255, b: 255 } } })
		.joinChannel(alpha)
		.png()
		.toBuffer();
}

function titleOf(slug) {
	const file = join(BLOG, `${slug}.md`);
	if (!existsSync(file)) throw new Error(`No post at src/blog/${slug}.md`);
	const m = readFileSync(file, 'utf8').match(/^title:\s*(['"])([\s\S]*?)\1\s*$/m);
	if (!m) throw new Error(`No title in ${slug}.md`);
	return m[2].replace(/''/g, "'").replace(/\\'/g, "'");
}

export async function makeHero(slug, titleOverride) {
	const title = titleOverride || titleOf(slug);
	const PAD = 90;
	const { size, lines } = fitTitle(title, W - PAD * 2);
	const lh = Math.round(size * 1.22);

	// Block the title so it sits above the footer rule, bottom-aligned-ish.
	const blockTop = 150;
	const rows = lines
		.map((l, i) => `<text x="${PAD}" y="${blockTop + size + i * lh}" font-family="${FONT}" font-size="${size}" font-weight="bold" fill="#ffffff" letter-spacing="-0.5">${esc(l)}</text>`)
		.join('\n    ');

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${DARK}"/>
    <rect x="0" y="0" width="${W}" height="10" fill="${RED}"/>
    <rect x="${PAD}" y="86" width="96" height="7" fill="${RED}"/>
    <circle cx="${W - 80}" cy="${H - 120}" r="230" fill="${RED}" opacity="0.07"/>
    ${rows}
    <rect x="${PAD}" y="${H - 118}" width="${W - PAD * 2}" height="1" fill="#ffffff" opacity="0.18"/>
    <text x="${W - PAD}" y="${H - 66}" text-anchor="end" font-family="${FONT}" font-size="25" fill="#ffffff" opacity="0.62">sportivityconsultants.com</text>
  </svg>`;

	const base = await sharp(Buffer.from(svg)).png().toBuffer();
	const logo = await whiteLogo(46);
	const out = join(ASSETS, `${slug}.png`);

	await sharp(base)
		.composite([{ input: logo, left: PAD, top: H - 90 }])
		.png({ compressionLevel: 9 })
		.toFile(out);

	return out;
}

/** Make sure the post's frontmatter actually points at the image. */
export function activateHeroImage(slug) {
	const file = join(BLOG, `${slug}.md`);
	const src = readFileSync(file, 'utf8');
	const live = `heroImage: '../assets/${slug}.png'`;
	let out;
	if (/^#\s*heroImage:.*$/m.test(src)) out = src.replace(/^#\s*heroImage:.*$/m, live);
	else if (/^heroImage:.*$/m.test(src)) out = src.replace(/^heroImage:.*$/m, live);
	else out = src.replace(/^(pubDate:.*)$/m, `$1\n${live}`);
	if (out !== src) {
		writeFileSync(file, out);
		return true;
	}
	return false;
}

/** Posts with no usable image: no heroImage line, or one that is commented out. */
export function postsMissingImages() {
	return readdirSync(BLOG)
		.filter((f) => f.endsWith('.md'))
		.map((f) => f.replace(/\.md$/, ''))
		.filter((slug) => {
			const src = readFileSync(join(BLOG, `${slug}.md`), 'utf8');
			const live = src.match(/^heroImage:\s*'(.+?)'/m);
			if (!live) return true;
			return !existsSync(join(ASSETS, live[1].replace('../assets/', '')));
		});
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
	const [arg, override] = process.argv.slice(2);
	if (!arg) {
		console.error('usage: node scripts/hero-image.mjs <slug> ["Title"]  |  --all  |  --check');
		process.exit(1);
	}
	if (arg === '--check') {
		const missing = postsMissingImages();
		if (missing.length) {
			console.error(`\nThese posts would publish with no image:\n${missing.map((s) => `  - ${s}`).join('\n')}\n\nRun: npm run hero -- --all\n`);
			process.exit(1);
		}
		console.log('Every post has a hero image.');
		process.exit(0);
	}
	const slugs = arg === '--all' ? postsMissingImages() : [arg];
	if (!slugs.length) console.log('Every post already has an image. Nothing to do.');
	for (const slug of slugs) {
		const out = await makeHero(slug, slugs.length === 1 ? override : undefined);
		const changed = activateHeroImage(slug);
		console.log(`${slug} -> ${out.replace(ROOT + '/', '')}${changed ? '  (frontmatter updated)' : ''}`);
	}
}
