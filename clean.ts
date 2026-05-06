import * as fs from 'fs';
import { cleanText, splitIntoParagraphs, removeFillers, markSectionTitles } from './translate_shared';

/**
 * yarn clean [--src source.txt]
 *
 * Reads the source file, cleans PDF copy-paste artefacts, and writes the
 * result back to the same file.
 */

const args = process.argv.slice(2);
let srcFile = 'source.txt';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--src' && args[i + 1]) srcFile = args[++i];
}

if (!fs.existsSync(srcFile)) {
  console.error(`❌  Source file not found: ${srcFile}`);
  process.exit(1);
}

const raw = fs.readFileSync(srcFile, 'utf-8');
const cleaned = cleanText(raw);
const paragraphs = splitIntoParagraphs(cleaned);
const noFillers = removeFillers(paragraphs);
const withTitles = markSectionTitles(noFillers);
const result = withTitles.join('\n\n');

const fillersRemoved = paragraphs.length - noFillers.length;
const titlesMarked = withTitles.filter((p, i) => p !== noFillers[i]).length;

fs.writeFileSync(srcFile, result, 'utf-8');

console.log(`✓ Cleaned ${srcFile} in place`);
console.log(`  Paragraphs : ${paragraphs.length} → ${withTitles.length}`);
console.log(`  Fillers removed  : ${fillersRemoved}`);
console.log(`  Titles detected  : ${titlesMarked}`);
console.log(`  Chars : ${raw.length} → ${result.length}`);
