#!/usr/bin/env node
// Usage: node gen_logs.js <id> <label> <logFilePath> <outDir> ["<note>"]
//
// Groups a raw log file into entries (a new entry starts at a line beginning with
// YYYY-MM-DD HH:MM:SS; continuation lines - stack frames, wrapped text - stay attached
// to the entry above them), reverses the ENTRIES (not raw lines, so multi-line stack
// traces keep their original internal order), and writes an HTML <details> block to
// <outDir>/block-<id>.html ready for scripts/splice.js to insert into a dashboard.

const fs = require('fs');
const path = require('path');

const [, , id, label, logFilePath, outDir, note] = process.argv;

if (!id || !label || !logFilePath || !outDir) {
  console.error('Usage: node gen_logs.js <id> <label> <logFilePath> <outDir> ["<note>"]');
  process.exit(1);
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildBlock() {
  const raw = fs.readFileSync(logFilePath, 'utf8');
  const rawLines = raw.split(/\r?\n/).filter(l => l.length > 0);

  const entryStart = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
  const entries = [];
  for (const line of rawLines) {
    if (entryStart.test(line) || entries.length === 0) {
      entries.push([line]);
    } else {
      entries[entries.length - 1].push(line);
    }
  }
  entries.reverse();
  const lines = entries.flat();

  const html = lines.map(line => {
    const e = esc(line);
    if (/\bERROR\b/.test(line)) return `<span class="log-l err">${e}</span>`;
    if (/\bWARN\b/.test(line)) return `<span class="log-l warn">${e}</span>`;
    return `<span class="log-l">${e}</span>`;
  }).join('\n');

  return `<details class="log-details">
        <summary>View full log &middot; ${lines.length} lines, newest first${note ? ' &middot; ' + note : ''}</summary>
        <pre class="log-full" id="${id}">${html}</pre>
      </details>`;
}

const block = buildBlock();
const outPath = path.join(outDir, `block-${id}.html`);
fs.writeFileSync(outPath, block);
console.log(`${label} (${id}): ${block.length} bytes -> ${outPath}`);
