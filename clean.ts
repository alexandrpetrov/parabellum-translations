import * as fs from 'fs';
import * as path from 'path';
import { cleanText } from './translate_shared';

/**
 * yarn clean [--src source.txt] [--out source_cleaned.txt]
 *
 * Reads the source file, cleans PDF copy-paste artefacts, and writes the
 * result to a separate file for review. The original is never modified.
 * Once satisfied, rename/copy the cleaned file to source.txt and translate.
 */

const args = process.argv.slice(2);
let srcFile = 'source.txt';
let outFile = 'source_cleaned.txt';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src' && args[i + 1]) srcFile = args[++i];
  if (args[i] === '--out' && args[i + 1]) outFile = args[++i];
}

if (!fs.existsSync(srcFile)) {
  console.error(`❌  Source file not found: ${srcFile}`);
  process.exit(1);
}

const raw = fs.readFileSync(srcFile, 'utf-8');
const cleaned = cleanText(raw);

const rawLines = raw.split('\n').length;
const cleanedLines = cleaned.split('\n').length;

fs.writeFileSync(outFile, cleaned, 'utf-8');

console.log(`✓ Cleaned: ${srcFile} → ${outFile}`);
console.log(`  Lines : ${rawLines} → ${cleanedLines}  (−${rawLines - cleanedLines})`);
console.log(`  Chars : ${raw.length} → ${cleaned.length}  (−${raw.length - cleaned.length})`);
console.log(`\nReview ${outFile}, then when satisfied:`);
console.log(`  cp ${outFile} ${srcFile}  &&  yarn translate`);
