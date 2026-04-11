import * as fs from 'fs';
import { Glossary, formatGlossaryForPrompt } from './glossary';

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

    if (ch >= 'a' && ch <= 'z') concat = true;
    else if (isQuote(ch)) concat = false;
    else if (ch === ' ') {
      if (isQuote(firstNonSpace)) {
        if (!SENTENCE_END.test(prev)) concat = true;
      } else if (firstNonSpace >= 'a' && firstNonSpace <= 'z') {
        concat = true;
      } else if (firstNonSpace >= 'A' && firstNonSpace <= 'Z') {
        if (!SENTENCE_END.test(prev)) concat = true;
      } else if (firstNonSpace && !/[A-Za-z0-9]/.test(firstNonSpace)) {
        concat = true;
      }
    } else if (!/[A-Za-z0-9]/.test(ch) && !isQuote(ch)) {
      concat = true;
    }

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
  skipGlossary: boolean;
  skipConsistencyPass: boolean;
}

export function parseArgs(argv: string[]): TranslateConfig {
  const args = argv.slice(2);
  let sourceLang = 'Ukrainian';
  let targetLang = 'Spanish';
  let sourceFile = 'source.txt';
  let outputFile = 'output.txt';
  let skipGlossary = false;
  let skipConsistencyPass = false;

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--src' && args[i + 1]) {
      sourceFile = args[++i];
    } else if (args[i] === '--out' && args[i + 1]) {
      outputFile = args[++i];
    } else if (args[i] === '--no-glossary') {
      skipGlossary = true;
    } else if (args[i] === '--no-consistency') {
      skipConsistencyPass = true;
    } else if (!args[i].startsWith('--')) {
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

  return { sourceLang, targetLang, sourceFile, outputFile, skipGlossary, skipConsistencyPass };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export const prompts = {
  /**
   * Paragraph translation — glossary-aware.
   */
  translate: (src: string, tgt: string, text: string, glossary: Glossary = []) => {
    const glossarySection = glossary.length > 0
      ? `\nYou MUST follow this glossary exactly. For every term listed below, use the exact canonical ${tgt} form shown. No alternate spellings, no variant renderings, no exceptions — even if a different form might sound more natural in isolation:\n\n${formatGlossaryForPrompt(glossary)}\n`
      : '';

    return `Translate the following text from ${src} to ${tgt}.${glossarySection}
Rules:
- Translate accurately and naturally, preserving the meaning, tone, and register of the original.
- Keep the paragraph structure intact: the output must have the same number of paragraphs as the input, in the same order.
- For every term that appears in the glossary above, use exactly the form shown — no deviation.
- Do not add any text before or after the translation.
- Do not use markdown.

Text to translate:
${text}`;
  },

  /**
   * Style improvement — glossary-aware.
   */
  style: (lang: string, text: string, glossary: Glossary = []) => {
    const glossarySection = glossary.length > 0
      ? `\nThe following terms are fixed and must not be changed:\n\n${formatGlossaryForPrompt(glossary)}\n`
      : '';

    return `Improve the style of the following ${lang} text.${glossarySection}
Rules:
- Improve clarity, flow, and literary quality while preserving meaning and tone.
- Do NOT change any term listed in the glossary above — those are canonical and must remain exactly as written.
- Do not add any text before or after the result.
- Do not use markdown.

Text:
${text}`;
  },

  /**
   * Naturalisation — glossary-aware.
   */
  naturalize: (lang: string, text: string, glossary: Glossary = []) => {
    const glossarySection = glossary.length > 0
      ? `\nThe following terms are fixed and must not be changed:\n\n${formatGlossaryForPrompt(glossary)}\n`
      : '';

    return `Make the following ${lang} text sound natural to a native speaker.${glossarySection}
Rules:
- Adjust phrasing, word order, and idiomatic expression so the text reads as if originally written in ${lang}.
- Do NOT change any term listed in the glossary above — those are canonical and must remain exactly as written.
- Do not add any text before or after the result.
- Do not use markdown.

Text:
${text}`;
  },

  /**
   * Final consistency normalisation pass.
   */
  consistencyPass: (lang: string, text: string, glossary: Glossary) => {
    return `You are a copy editor performing a final consistency check on a ${lang} translation.

Compare the text below against the canonical glossary. Where any glossary term appears in an incorrect, variant, or inconsistent form, replace it with the exact canonical form shown in the glossary.

Canonical glossary:
${formatGlossaryForPrompt(glossary)}

Rules:
- Only fix glossary inconsistencies. Do not rephrase, rewrite, or improve anything else.
- If a passage already uses the canonical form, leave it completely unchanged.
- Preserve all paragraph breaks and formatting.
- Do not add any text before or after the result.
- Do not use markdown.

Text to check:
${text}`;
  },
};