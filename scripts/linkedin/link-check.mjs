/**
 * Stop a post going out that promises somewhere to go, with nowhere to go.
 *
 * On 1 September 2026 the drama-triangle post went out ending "I go deeper on
 * this in The Monthly Edge, my newsletter for owners. Link in the first
 * comment." The issue it pointed at was Issue 6, written but unsent, sat behind
 * two other unsent issues. There was no link to put in the comment, so none
 * went in. 264 impressions, one like, and the one line that was supposed to
 * turn readers into subscribers pointed at nothing.
 *
 * The draft it came from even said "do not post before Issue 6 sends". That
 * instruction was prose in a markdown file, so nothing enforced it.
 *
 * So: if the text promises a link, the link has to exist before it posts.
 */

/**
 * Phrases that promise the reader a link, usually in the first comment.
 */
const LINK_PROMISES = [
  /\bfirst comment\b/i,
  /\blinks?\s+in\s+the\s+comments?\b/i,
  /\blinks?\s+below\b/i,
  /\bin\s+the\s+comments?\s+below\b/i,
  /\b(?:details|sign\s?up|subscribe|full\s+piece)\s+in\s+the\s+comments?\b/i,
];

/**
 * Phrases that send the reader to a named destination. These need a link even
 * when the post never uses the word "link", because "I go deeper on this in
 * The Monthly Edge" is a promise whether or not it says where to find it.
 */
const DESTINATION_PROMISES = [
  /\bThe Monthly Edge\b/i,
  /\bmy newsletter\b/i,
  /\bSportivity 360\b/i,
  /\bthe CQI (?:pack|framework|document)\b/i,
];

const URL_PATTERN = /\bhttps?:\/\/\S+|\b(?:www\.)?[a-z0-9-]+\.(?:com|co\.uk|org|net|substack\.com)\b/i;

/** Does the post already carry its own link in the body? */
export function containsUrl(text) {
  return URL_PATTERN.test(text);
}

/**
 * Returns the phrase that makes a promise, or null if the post promises
 * nothing. The matched text is returned so the error can quote it back.
 */
export function promisesLink(text) {
  for (const pattern of LINK_PROMISES) {
    const m = text.match(pattern);
    if (m) return { phrase: m[0], kind: 'a link' };
  }
  for (const pattern of DESTINATION_PROMISES) {
    const m = text.match(pattern);
    if (m) return { phrase: m[0], kind: 'somewhere to go' };
  }
  return null;
}

/**
 * True when the post makes a promise it cannot keep: it points the reader
 * somewhere, and there is neither a link recorded against it nor one in the
 * body.
 */
export function missingPromisedLink(text, link) {
  if (link) return null;
  if (containsUrl(text)) return null;
  return promisesLink(text);
}
