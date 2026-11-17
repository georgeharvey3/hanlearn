/**
 * Generate a static mapping of character → meaning for all characters
 * used across the chengyu dataset.
 *
 * This allows the daily chengyu character breakdown to display meanings
 * instantly without an async dictionary lookup.
 *
 * Usage:
 *   node migration/build-chengyu-char-meanings.mjs
 *
 * Output:
 *   web-client/src/data/chengyuCharMeanings.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { readCedict } = require('./build-dictionary.js');
const { cleanDictionary } = require('./cleanMeaning.js');

function extractChengyuCharacters(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const chars = new Set();

  const charRegex = /characters:\s*'([^']+)'/g;
  let match;
  while ((match = charRegex.exec(content)) !== null) {
    for (const ch of match[1]) {
      if (ch !== '，' && ch !== ',') {
        chars.add(ch);
      }
    }
  }

  const tradRegex = /trad:\s*'([^']+)'/g;
  while ((match = tradRegex.exec(content)) !== null) {
    for (const ch of match[1]) {
      if (ch !== '，' && ch !== ',') {
        chars.add(ch);
      }
    }
  }

  return chars;
}

/**
 * Check if a CC-CEDICT entry is a surname-only or "used in" entry
 * (these are less useful as character meanings).
 */
function isLowQualityEntry(entry) {
  // Capitalized pinyin = proper noun / surname reading
  if (/^[A-Z]/.test(entry.pinyin)) return true;
  const m = entry.meaning.toLowerCase();
  if (m.startsWith('surname ')) return true;
  if (m.startsWith('used in ') && !m.includes('/')) return true;
  // Entry whose only meanings are "variant of..." references
  const parts = m.split('/').filter((p) => p.trim().length > 0);
  if (parts.every((p) => p.startsWith('variant of') || p.startsWith('old variant'))) return true;
  return false;
}

/**
 * Condense the clean meaning of an entry (#488) into a short, readable form.
 */
function condenseMeaning(cleanMeaning) {
  const parts = cleanMeaning
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('surname '));

  const selected = [];
  for (const part of parts) {
    if (selected.length >= 3) break;
    if (part.length > 40) continue;
    selected.push(part);
  }

  return selected.join('; ') || parts[0] || '';
}

async function buildCharMeanings() {
  const chengyuPath = path.join(__dirname, '..', 'web-client', 'src', 'data', 'chengyus.ts');
  const outputPath = path.join(__dirname, '..', 'web-client', 'src', 'data', 'chengyuCharMeanings.ts');

  console.log('Extracting characters from chengyus...');
  const targetChars = extractChengyuCharacters(chengyuPath);
  console.log(`Found ${targetChars.size} unique characters`);

  console.log('Parsing CC-CEDICT...');
  // Collect all entries per character, then pick the best one
  const charEntries = new Map(); // char -> entry[]

  // The choice of an entry reads the raw meaning, and the table shows the
  // clean meaning, as build:dict writes it.
  const raw = readCedict();
  const clean = new Map(cleanDictionary(raw).words.map((word) => [word.id, word.meaning]));
  for (const entry of raw) {
    if (clean.get(entry.id) === '') continue;

    // Only interested in single-character entries
    if (entry.simp.length !== 1 && entry.trad.length !== 1) continue;

    for (const char of [entry.simp, entry.trad]) {
      if (targetChars.has(char)) {
        if (!charEntries.has(char)) charEntries.set(char, []);
        charEntries.get(char).push(entry);
      }
    }
  }

  // Pick the best meaning for each character
  const charMeanings = new Map();
  for (const [char, entries] of charEntries) {
    // Prefer non-surname, non-"used in" entries
    const goodEntries = entries.filter((e) => !isLowQualityEntry(e));
    const best = goodEntries.length > 0 ? goodEntries[0] : entries[0];
    const meaning = condenseMeaning(clean.get(best.id));
    charMeanings.set(char, meaning);
  }

  const missing = [];
  for (const char of targetChars) {
    if (!charMeanings.has(char)) {
      missing.push(char);
    }
  }

  console.log(`Resolved ${charMeanings.size}/${targetChars.size} characters`);
  if (missing.length > 0) {
    console.log(`Missing: ${missing.join(', ')}`);
  }

  const entries = Array.from(charMeanings.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([char, meaning]) => {
      const escapedMeaning = meaning.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `  '${char}': '${escapedMeaning}',`;
    })
    .join('\n');

  const output = `/**
 * Pre-computed character meanings for chengyu character breakdowns.
 *
 * Generated from the clean CC-CEDICT meanings (#488) by migration/build-chengyu-char-meanings.mjs
 * Do not edit manually — re-run the build script to update.
 */

export const chengyuCharMeanings: Record<string, string> = {
${entries}
};
`;

  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`\nWritten to ${outputPath}`);
  console.log(`${charMeanings.size} character meanings`);
}

buildCharMeanings().catch(console.error);
