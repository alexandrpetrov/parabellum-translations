import * as fs from 'fs';
import OpenAI from 'openai';
import { readFile, splitIntoParagraphs, createBlocks, isSectionTitle, parseArgs, prompts } from './translate_shared';
import { extractGlossary, logGlossary, Glossary } from './glossary';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Remove characters that can corrupt a JSON payload:
 * - ASCII control characters (except tab, newline, carriage return)
 * - Lone surrogates that are not valid Unicode
 */
function sanitize(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // control chars
    .replace(/[\uD800-\uDFFF]/g, '');                      // lone surrogates
}

async function callChatGPT(
  prompt: string,
  model = 'gpt-4o',
  retries = 3,
  temperature = 0.3,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
      });
      return sanitize(response.choices[0]?.message?.content ?? '');
    } catch (err: any) {
      const isLast = attempt === retries;
      console.warn(`  ⚠️  API error (attempt ${attempt}/${retries}): ${err?.message ?? err}`);
      if (isLast) throw new Error(`ChatGPT API error after ${retries} attempts: ${err}`);
      const delay = 5000 * Math.pow(2, attempt - 1);
      console.warn(`  Retrying in ${delay / 1000}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

async function processBlock(
  block: string,
  blockNum: number,
  total: number,
  sourceLang: string,
  targetLang: string,
  glossary: Glossary,
): Promise<string> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Block ${blockNum}/${total}${isSectionTitle(block) ? '  [section title]' : ''}`);
  console.log('='.repeat(60));

  console.log(`\nStep 1: Translating ${sourceLang} → ${targetLang}…`);
  const step1 = await callChatGPT(
    prompts.translate(sourceLang, targetLang, sanitize(block), glossary),
  );
  console.log(`  Done. ${step1.length} chars`);

  // Section titles only need the translation step — skip style and naturalisation.
  if (isSectionTitle(block)) {
    return step1;
  }

  console.log(`\nStep 2: Improving ${targetLang} style…`);
  const step2 = await callChatGPT(prompts.style(targetLang, step1, glossary));
  console.log(`  Done. ${step2.length} chars`);

  console.log(`\nStep 3: Naturalising for native ${targetLang} speakers…`);
  const step3 = await callChatGPT(prompts.naturalize(targetLang, sourceLang, step2, glossary));
  console.log(`  Done. ${step3.length} chars`);

  return step3;
}

async function consistencyPass(
  text: string,
  targetLang: string,
  glossary: Glossary,
): Promise<string> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Final consistency pass — normalising glossary terms');
  console.log('='.repeat(60));

  const result = await callChatGPT(
    prompts.consistencyPass(targetLang, text, glossary),
    'gpt-4o',
    3,
    0.1, // Very low temperature — we only want mechanical find-replace style fixes
  );
  console.log(`  Done. ${result.length} chars`);
  return result;
}

async function main(): Promise<void> {
  const { sourceLang, targetLang, sourceFile, outputFile, skipGlossary, skipConsistencyPass } =
    parseArgs(process.argv);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌  OPENAI_API_KEY is not set.');
    process.exit(1);
  }
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌  Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  // Allow resuming from a specific block: yarn translate -- --start=43
  const startArg = process.argv.find(a => a.startsWith('--start='));
  const startBlock = startArg ? parseInt(startArg.split('=')[1], 10) : 1;

  console.log('='.repeat(60));
  console.log('Translation — Standard API (real-time)');
  console.log('='.repeat(60));
  console.log(`  ${sourceLang} → ${targetLang}`);
  console.log(`  Source : ${sourceFile}`);
  console.log(`  Output : ${outputFile}`);
  if (startBlock > 1) console.log(`  Resuming from block ${startBlock}`);
  if (skipGlossary) console.log(`  Glossary: disabled (--no-glossary)`);
  if (skipConsistencyPass) console.log(`  Consistency pass: disabled (--no-consistency)`);

  const text = readFile(sourceFile);
  const paragraphs = splitIntoParagraphs(text);
  const blocks = createBlocks(paragraphs);

  console.log(`\n  ${paragraphs.length} paragraphs → ${blocks.length} blocks`);
  blocks.forEach((b, i) =>
    console.log(`  Block ${i + 1}: ${b.substring(0, 80).replace(/\n/g, ' ')}…`),
  );

  // ── Glossary extraction ───────────────────────────────────────────────────
  let glossary: Glossary = [];

  if (!skipGlossary) {
    // If resuming and a glossary file already exists, reuse it
    const glossaryFile = outputFile.replace(/(\.[^.]+)?$/, '_glossary.json');

    if (startBlock > 1 && fs.existsSync(glossaryFile)) {
      console.log(`\n  Loading existing glossary from ${glossaryFile}…`);
      try {
        glossary = JSON.parse(fs.readFileSync(glossaryFile, 'utf-8'));
        console.log(`  Loaded ${glossary.length} entries`);
      } catch {
        console.warn('  ⚠️  Could not parse existing glossary file — re-extracting');
      }
    }

    if (glossary.length === 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`Glossary extraction — ${sourceLang} → ${targetLang}`);
      console.log('='.repeat(60));
      console.log(`  Sending full source text (${text.length} chars) to API…`);

      glossary = await extractGlossary(openai, sourceLang, targetLang, text);

      // Persist glossary alongside output so it can be inspected and reused
      fs.writeFileSync(glossaryFile, JSON.stringify(glossary, null, 2), 'utf-8');
      console.log(`  Saved glossary → ${glossaryFile}`);
    }

    console.log(`\n  Glossary (${glossary.length} entries):`);
    logGlossary(glossary);
  }

  // ── Load any previously translated blocks if resuming ────────────────────
  const translated: string[] = [];
  if (startBlock > 1 && fs.existsSync(outputFile)) {
    const existing = fs.readFileSync(outputFile, 'utf-8').split('\n\n');
    for (let i = 0; i < startBlock - 1 && i < existing.length; i++) {
      translated.push(existing[i]);
    }
    console.log(`\n  Loaded ${translated.length} blocks from existing output.`);
  }

  // ── Block-by-block translation ────────────────────────────────────────────
  for (let i = startBlock - 1; i < blocks.length; i++) {
    translated.push(
      await processBlock(blocks[i], i + 1, blocks.length, sourceLang, targetLang, glossary),
    );
    // Write after every block so progress is never lost
    fs.writeFileSync(outputFile, translated.join('\n\n'), 'utf-8');
  }

  // ── Optional final consistency pass ──────────────────────────────────────
  if (!skipConsistencyPass && glossary.length > 0) {
    const rawOutput = fs.readFileSync(outputFile, 'utf-8');
    const normalised = await consistencyPass(rawOutput, targetLang, glossary);
    fs.writeFileSync(outputFile, normalised, 'utf-8');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅  Translation complete');
  console.log(`  Output : ${outputFile}  (${fs.readFileSync(outputFile).length} chars)`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});