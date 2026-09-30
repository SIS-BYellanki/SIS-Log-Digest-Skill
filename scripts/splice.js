#!/usr/bin/env node
// Usage: node splice.js <dashboardPath> <id1>=<blockPath1> [<id2>=<blockPath2> ...]
//
// Safely inserts/replaces <details class="log-details">...<pre id="ID">...</pre></details>
// blocks in a dashboard HTML file, one id at a time.
//
// Why this exists: a lazy-quantifier regex spanning from the FIRST `<details
// class="log-details">` in the whole document to a target block's closing tag can, once an
// earlier block has already been replaced with a large one, swallow everything in between -
// silently deleting large chunks of the file. This happened once building the original
// 346957e1 dashboard (a 448KB file collapsed to 37KB). This script instead locates each
// block by its unique `id` marker on the <pre> tag, then only touches the NEAREST enclosing
// `<details>...</details>` around that marker - it cannot span into a neighboring block.
//
// If the target id doesn't exist yet in the dashboard (first-time insert rather than a
// refresh), pass --after="<anchor text>" as an extra arg to insert the block right after the
// first occurrence of that literal anchor text instead of replacing an existing block.

const fs = require('fs');

const args = process.argv.slice(2);
const dashboardPath = args[0];
const pairs = args.slice(1).filter(a => !a.startsWith('--after='));
const afterArg = args.find(a => a.startsWith('--after='));
const anchorText = afterArg ? afterArg.slice('--after='.length) : null;

if (!dashboardPath || pairs.length === 0) {
  console.error('Usage: node splice.js <dashboardPath> <id1>=<blockPath1> [<id2>=<blockPath2> ...] [--after="<anchor>"]');
  process.exit(1);
}

let html = fs.readFileSync(dashboardPath, 'utf8');
const beforeSize = html.length;

function replaceBlock(html, id, newBlock) {
  const preMarker = `<pre class="log-full" id="${id}">`;
  const preIdx = html.indexOf(preMarker);

  if (preIdx === -1) {
    if (!anchorText) {
      throw new Error(`pre marker not found for id="${id}" and no --after anchor given for a first-time insert`);
    }
    const anchorIdx = html.indexOf(anchorText);
    if (anchorIdx === -1) throw new Error(`--after anchor text not found for id="${id}"`);
    const insertAt = anchorIdx + anchorText.length;
    return html.slice(0, insertAt) + '\n' + newBlock.trim() + html.slice(insertAt);
  }

  const detailsOpen = '<details class="log-details">';
  const startIdx = html.lastIndexOf(detailsOpen, preIdx);
  if (startIdx === -1) throw new Error(`opening <details> not found before id="${id}"`);

  const closeTag = '</details>';
  const closeIdx = html.indexOf(closeTag, preIdx);
  if (closeIdx === -1) throw new Error(`closing </details> not found after id="${id}"`);
  const endIdx = closeIdx + closeTag.length;

  return html.slice(0, startIdx) + newBlock.trim() + html.slice(endIdx);
}

for (const pair of pairs) {
  const eq = pair.indexOf('=');
  if (eq === -1) throw new Error(`Bad pair "${pair}", expected id=blockPath`);
  const id = pair.slice(0, eq);
  const blockPath = pair.slice(eq + 1);
  const block = fs.readFileSync(blockPath, 'utf8');
  html = replaceBlock(html, id, block);
}

fs.writeFileSync(dashboardPath, html, 'utf8');

const afterSize = html.length;
console.log(`Spliced OK. ${beforeSize} -> ${afterSize} bytes (delta ${afterSize - beforeSize >= 0 ? '+' : ''}${afterSize - beforeSize})`);

const openCount = (html.match(/<details class="log-details">/g) || []).length;
const closeCount = (html.match(/<\/details>/g) || []).length;
console.log(`log-details open: ${openCount} | close: ${closeCount}${openCount !== closeCount ? '  <-- MISMATCH, do not publish' : ''}`);

for (const pair of pairs) {
  const id = pair.slice(0, pair.indexOf('='));
  const count = (html.match(new RegExp(`id="${id}"`, 'g')) || []).length;
  console.log(`${id} occurrences: ${count}${count !== 1 ? '  <-- expected exactly 1, do not publish' : ''}`);
}
