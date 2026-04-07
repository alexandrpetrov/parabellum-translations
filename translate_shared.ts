import * as fs from 'fs';

/**
 * Read a text file, throwing a clear error on failure.
 */
export function readFile(filepath: string): string {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filepath}: ${error}`);
  }
}

/**
 * Clean text copied from a PDF:
 * - Remove empty lines
 * - Concatenate lines that start with a lowercase letter (mid-sentence page break)
 * - Concatenate lines that start with a space or non-alphanumeric character
 * - Concatenate lines that start with a digit when the previous line does not
 *   end with a sentence-ending punctuation mark (i.e. not a new numbered item)
 *
 * Exported for use by clean.ts — not called automatically during translation.
 */
const SENTENCE_END = /[.!?…]\s*["'»\])]?\s*$/;

export function cleanText(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') continue;

    if (result.length === 0) {
      result.push(line);
      continue;
    }

    const prev = result[result.length - 1].trimEnd();
    const ch = line[0] ?? '';
    const firstNonSpace = line.trimStart()[0] ?? '';
    const isQuote = (c: string) => /^[«»„"\u201f❝❞\u201c\u2018\u201b❛❜\u2019\u2018\u201a\u2039\u203a]$/.test(c);
    let concat = false;

    // Lowercase start → always concatenate (mid-sentence page break)
    if (ch >= 'a' && ch <= 'z') concat = true;

    // Line starts directly with a quote → always keep as new line
    else if (isQuote(ch)) concat = false;

    // Line starts with a space
    else if (ch === ' ') {
      if (isQuote(firstNonSpace)) {
        // Space + quote → concatenate only if prev has no sentence-ending punctuation
        if (!SENTENCE_END.test(prev)) concat = true;
      } else if (firstNonSpace >= 'a' && firstNonSpace <= 'z') {
        // Space + lowercase → always concatenate (mid-sentence break)
        concat = true;
      } else if (firstNonSpace >= 'A' && firstNonSpace <= 'Z') {
        // Space + uppercase → concatenate only if prev has no sentence-ending punctuation
        if (!SENTENCE_END.test(prev)) concat = true;
      } else if (firstNonSpace && !/[A-Za-z0-9]/.test(firstNonSpace)) {
        // Space + other non-alphanumeric → concatenate
        concat = true;
      }
    }

    // Line starts with a non-alphanumeric, non-quote character
    else if (!/[A-Za-z0-9]/.test(ch) && !isQuote(ch)) {
      concat = true;
    }

    // Starts with a digit → concatenate only if prev has no sentence-ending punctuation
    if (/^[0-9]/.test(line) && !SENTENCE_END.test(prev)) concat = true;

    if (concat) {
      result[result.length - 1] = prev + ' ' + line.trimStart();
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Split text into non-empty paragraphs.
 * Falls back to single-newline splitting when no double-newlines exist.
 */
export function splitIntoParagraphs(text: string): string[] {
  let paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (paragraphs.length <= 1) {
    paragraphs = text
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  return paragraphs;
}

/**
 * Group paragraphs into blocks of up to 3 non-title paragraphs.
 * Paragraphs shorter than 150 characters are treated as titles and
 * attached to the following block rather than counted toward the limit.
 */
export function createBlocks(paragraphs: string[]): string[] {
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let pendingTitle: string | null = null;

  for (const para of paragraphs) {
    const isTitle = para.length < 150;

    if (isTitle) {
      if (pendingTitle) currentBlock.push(pendingTitle);
      pendingTitle = para;
    } else {
      if (pendingTitle) {
        currentBlock.push(pendingTitle);
        pendingTitle = null;
      }
      currentBlock.push(para);

      const nonTitleCount = currentBlock.filter(p => p.length >= 150).length;
      if (nonTitleCount >= 3) {
        blocks.push(currentBlock.join('\n\n'));
        currentBlock = [];
      }
    }
  }

  if (pendingTitle) currentBlock.push(pendingTitle);
  if (currentBlock.length > 0) blocks.push(currentBlock.join('\n\n'));

  return blocks;
}

export interface TranslateConfig {
  sourceLang: string;
  targetLang: string;
  sourceFile: string;
  outputFile: string;
}

export function parseArgs(argv: string[]): TranslateConfig {
  const args = argv.slice(2);
  let sourceLang = 'Ukrainian';
  let targetLang = 'Spanish';
  let sourceFile = 'source.txt';
  let outputFile = 'output.txt';

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--src' && args[i + 1]) {
      sourceFile = args[++i];
    } else if (args[i] === '--out' && args[i + 1]) {
      outputFile = args[++i];
    } else {
      positional.push(args[i]);
    }
  }

  if (positional.length >= 2) {
    sourceLang = positional[0];
    targetLang = positional[1];
  } else if (positional.length === 1) {
    console.warn('⚠️  Only one language provided — using Ukrainian as source.');
    targetLang = positional[0];
  }

  return { sourceLang, targetLang, sourceFile, outputFile };
}

export const prompts = {
  translate: (src: string, tgt: string, text: string) =>
    `Translate this text from ${src} to ${tgt}:\n\n${text}\n\nDon't add anything before or after the resulting text. Reply only with the resulting text. Don't use markdown.`,

  style: (lang: string, text: string) =>
    `Improve the style of this text in ${lang}:\n\n${text}\n\nDon't add anything before or after the resulting text. Reply only with the resulting text. Don't use markdown.`,

  naturalize: (lang: string, text: string) =>
    `Make this text sound natural to a native ${lang} speaker:\n\n${text}\n\nDon't add anything before or after the resulting text. Reply only with the resulting text. Don't use markdown.`,
};