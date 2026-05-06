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
    if (!/[a-zA-Z0-9Ѐ-ӿ]/.test(line)) continue; // drop filler lines (e.g. ---)

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
 * Remove paragraphs that contain no alphanumeric characters — e.g. "---", "***".
 * These are typically AI-generation separator artifacts.
 */
export function removeFillers(paragraphs: string[]): string[] {
  return paragraphs.filter(p => /[a-zA-Z0-9Ѐ-ӿ]/.test(p));
}

/**
 * Auto-detect section titles and wrap them in square brackets.
 * A paragraph is treated as a title when it is:
 *   - short (≤ 100 chars)
 *   - does not end with sentence-terminating punctuation (. ! ? …)
 *   - not already wrapped in []
 *   - adjacent to at least one long paragraph (> 150 chars)
 */
export function markSectionTitles(paragraphs: string[]): string[] {
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return para;
    if (trimmed.length > 100) return para;
    if (/[.!?…]$/.test(trimmed)) return para;

    const prev = i > 0 ? paragraphs[i - 1].trim() : null;
    const next = i < paragraphs.length - 1 ? paragraphs[i + 1].trim() : null;
    const prevLong = prev !== null && prev.length > 150;
    const nextLong = next !== null && next.length > 150;

    return (prevLong || nextLong) ? `[${trimmed}]` : para;
  });
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
 * Returns true for paragraphs that are section titles: text wrapped in
 * square brackets, e.g. "[Chapter One]" or "[Вступ]".
 * Leading/trailing whitespace is ignored.
 */
export function isSectionTitle(para: string): boolean {
  return /^\[.*\]$/.test(para.trim());
}

/**
 * Group paragraphs into blocks with the following rules:
 *
 * - Section titles (text wrapped in square brackets) are ALWAYS their own
 *   standalone block. When one is encountered the current accumulating block
 *   is flushed first (even if it has fewer than 3 paragraphs), then the
 *   section title becomes its own single-paragraph block, and a new
 *   accumulating block starts afterward.
 *
 * - Regular paragraphs are grouped up to 3 non-title paragraphs per block.
 *   Short paragraphs (< 150 chars, excluding section titles) are treated as
 *   inline sub-headings and do not count toward the 3-paragraph limit; they
 *   are attached to the following content.
 */
export function createBlocks(paragraphs: string[]): string[] {
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  const flushCurrent = () => {
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n\n'));
      currentBlock = [];
    }
  };

  for (const para of paragraphs) {
    // Section title → flush whatever we have, emit title as its own block
    if (isSectionTitle(para)) {
      flushCurrent();
      blocks.push(para.trim());
      continue;
    }

    const isInlineHeading = para.length < 150;

    if (isInlineHeading) {
      // Inline sub-heading: accumulate into current block (doesn't count toward limit)
      currentBlock.push(para);
    } else {
      currentBlock.push(para);
      const bodyCount = currentBlock.filter(p => p.length >= 150 && !isSectionTitle(p)).length;
      if (bodyCount >= 3) {
        flushCurrent();
      }
    }
  }

  flushCurrent();

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
- If the entire text is a section title enclosed in square brackets (e.g. "[Title]"), translate the title and keep the square brackets in the output — do not remove them.
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
- If the text is a section title enclosed in square brackets (e.g. "[Title]"), keep the square brackets exactly as-is.
- Do NOT change any term listed in the glossary above — those are canonical and must remain exactly as written.
- Do not add any text before or after the result.
- Do not use markdown.

Text:
${text}`;
  },

  /**
   * Literary polish pass — glossary-aware.
   * Internally analyses stylistic weaknesses then rewrites; outputs only the final text.
   */
  naturalize: (lang: string, text: string, glossary: Glossary = []) => {
    const glossarySection = glossary.length > 0
      ? `\nThe following terms are fixed and must not be changed:\n\n${formatGlossaryForPrompt(glossary)}\n`
      : '';

    return `Before rewriting, internally analyse the following ${lang} text for stylistic weaknesses, awkward phrasing, unnatural constructions, bureaucratic language, calques, repetitions, overloaded sentences, and anything that sounds non-native or clumsy in literary ${lang}. For each problem, identify the fragment, explain why it is weak, and think of a better alternative. Do not include this analysis in your output.${glossarySection}
Then rewrite the entire passage according to these requirements:
- Natural, fluent, cinematic ${lang} suitable for a high-quality historical documentary narration.
- Preserve all factual meaning and information.
- Do not shorten the text significantly.
- Do not invent new facts.
- Prioritise natural ${lang} rhythm and flow.
- Avoid bureaucratic, academic, or modern political jargon unless absolutely necessary.
- Avoid English-like sentence structure and literal translations.
- Avoid repetitive syntax patterns.
- Avoid overusing participial constructions.
- Avoid overly abstract phrasing when a more concrete formulation exists.
- The text should sound like it was originally written by a skilled native ${lang} documentary writer, not translated from another language.
- No em dashes.
- Keep the tone serious, historical, cinematic, and authoritative.
- If the text is a section title enclosed in square brackets (e.g. "[Title]"), keep the square brackets exactly as-is.
- Do NOT change any term listed in the glossary above — those are canonical and must remain exactly as written.
- Output ONLY the rewritten passage. No analysis, no headers, no commentary.

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
- Preserve square brackets around section titles — do not remove them.
- Do not add any text before or after the result.
- Do not use markdown.

Text to check:
${text}`;
  },
};