import * as fs from 'fs';
import OpenAI from 'openai';
import { readFile, splitIntoParagraphs, createBlocks, isSectionTitle, parseArgs, prompts } from './translate_shared';
import { extractGlossary, logGlossary, Glossary } from './glossary';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchRequest {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  };
}

interface BatchResponse {
  custom_id: string;
  response: {
    body: {
      choices: Array<{ message: { content: string } }>;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeBatchFile(requests: BatchRequest[], filename: string): void {
  fs.writeFileSync(filename, requests.map(r => JSON.stringify(r)).join('\n'), 'utf-8');
  console.log(`  ✓ Wrote ${requests.length} requests → ${filename}`);
}

async function submitBatch(batchFile: string, description: string): Promise<string> {
  console.log(`\n  Uploading ${batchFile}…`);
  const file = await openai.files.create({
    file: fs.createReadStream(batchFile),
    purpose: 'batch',
  });
  console.log(`  ✓ File uploaded: ${file.id}`);

  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
    metadata: { description },
  });
  console.log(`  ✓ Batch created: ${batch.id}  (${batch.status})`);
  return batch.id;
}

async function waitForBatch(batchId: string): Promise<void> {
  console.log(`\n  Polling batch ${batchId} every 30 s…`);
  console.log(`  (Run "yarn translate:batch:status ${batchId}" to check manually)`);

  let poll = 0;
  while (true) {
    const batch = await openai.batches.retrieve(batchId);
    poll++;
    const { total = 0, completed = 0, failed = 0 } = batch.request_counts ?? {};
    console.log(`  [poll ${poll}] ${batch.status}  ${completed}/${total} done, ${failed} failed`);

    if (batch.status === 'completed') return;

    if (['failed', 'expired', 'cancelled'].includes(batch.status)) {
      throw new Error(`Batch ${batch.status}: ${JSON.stringify(batch.errors)}`);
    }

    await new Promise(r => setTimeout(r, 30_000));
  }
}

async function downloadResults(batchId: string): Promise<Map<string, string>> {
  const batch = await openai.batches.retrieve(batchId);
  if (!batch.output_file_id) throw new Error('No output file available on completed batch.');

  const raw = await (await openai.files.content(batch.output_file_id)).text();
  const resultMap = new Map<string, string>();

  for (const line of raw.trim().split('\n')) {
    const r: BatchResponse = JSON.parse(line);
    resultMap.set(r.custom_id, r.response.body.choices[0]?.message?.content ?? '');
  }

  console.log(`  ✓ Downloaded ${resultMap.size} results`);
  return resultMap;
}

function makeRequests(
  payloads: Array<{ id: string; content: string }>,
  model = 'gpt-4o',
  temperature = 0.3,
): BatchRequest[] {
  return payloads.map(({ id, content }) => ({
    custom_id: id,
    method: 'POST',
    url: '/v1/chat/completions',
    body: { model, messages: [{ role: 'user', content }], temperature },
  }));
}

// ---------------------------------------------------------------------------
// Core three-phase pipeline
// ---------------------------------------------------------------------------

async function runBatchTranslation(
  blocks: string[],
  sourceLang: string,
  targetLang: string,
  glossary: Glossary,
): Promise<string[]> {
  // Pre-classify blocks so section titles are excluded from phases 2 and 3.
  const titleIndices = new Set(blocks.map((b, i) => isSectionTitle(b) ? i : -1).filter(i => i >= 0));
  const contentIndices = blocks.map((_, i) => i).filter(i => !titleIndices.has(i));

  // ── Phase 1: translate ALL blocks ────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 1 / 3 — Translation  (${sourceLang} → ${targetLang})`);
  if (glossary.length > 0) console.log(`  Using glossary with ${glossary.length} entries`);
  console.log(`  ${titleIndices.size} section title block(s) will stop here after this phase`);
  console.log('='.repeat(60));

  const p1Requests = makeRequests(
    blocks.map((b, i) => ({
      id: `block_${i}_step_1`,
      content: prompts.translate(sourceLang, targetLang, b, glossary),
    })),
  );
  writeBatchFile(p1Requests, 'batch_step1.jsonl');
  const p1Id = await submitBatch('batch_step1.jsonl', 'Step 1: Translation');
  await waitForBatch(p1Id);
  const p1Map = await downloadResults(p1Id);

  // ── Phase 2: style — content blocks only ─────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 2 / 3 — Style improvement  (${contentIndices.length} blocks)`);
  console.log('='.repeat(60));

  const p2Map = new Map<string, string>();
  if (contentIndices.length > 0) {
    const p2Requests = makeRequests(
      contentIndices.map(i => ({
        id: `block_${i}_step_2`,
        content: prompts.style(targetLang, p1Map.get(`block_${i}_step_1`) ?? '', glossary),
      })),
    );
    writeBatchFile(p2Requests, 'batch_step2.jsonl');
    const p2Id = await submitBatch('batch_step2.jsonl', 'Step 2: Style improvement');
    await waitForBatch(p2Id);
    const downloaded = await downloadResults(p2Id);
    downloaded.forEach((v, k) => p2Map.set(k, v));
  } else {
    console.log('  (skipped — no content blocks)');
    fs.writeFileSync('batch_step2.jsonl', '', 'utf-8');
  }

  // ── Phase 3: naturalise — content blocks only ────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`Phase 3 / 3 — Naturalisation  (${contentIndices.length} blocks)`);
  console.log('='.repeat(60));

  const p3Map = new Map<string, string>();
  if (contentIndices.length > 0) {
    const p3Requests = makeRequests(
      contentIndices.map(i => ({
        id: `block_${i}_step_3`,
        content: prompts.naturalize(targetLang, p2Map.get(`block_${i}_step_2`) ?? '', glossary),
      })),
    );
    writeBatchFile(p3Requests, 'batch_step3.jsonl');
    const p3Id = await submitBatch('batch_step3.jsonl', 'Step 3: Naturalisation');
    await waitForBatch(p3Id);
    const downloaded = await downloadResults(p3Id);
    downloaded.forEach((v, k) => p3Map.set(k, v));
  } else {
    console.log('  (skipped — no content blocks)');
    fs.writeFileSync('batch_step3.jsonl', '', 'utf-8');
  }

  // Reassemble in original order: titles use p1 result, content blocks use p3.
  return blocks.map((_, i) => {
    if (titleIndices.has(i)) return p1Map.get(`block_${i}_step_1`) ?? '';
    return p3Map.get(`block_${i}_step_3`) ?? '';
  });
}

// ---------------------------------------------------------------------------
// Final consistency pass (batch version — single request, not batched)
// Because the full translated text needs to be checked as a whole,
// and we want sequential ordering, a single standard API call is clearest.
// ---------------------------------------------------------------------------

async function runConsistencyPass(
  text: string,
  targetLang: string,
  glossary: Glossary,
): Promise<string> {
  console.log('\n' + '='.repeat(60));
  console.log('Final consistency pass — normalising glossary terms');
  console.log('='.repeat(60));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompts.consistencyPass(targetLang, text, glossary) }],
    temperature: 0.1,
  });

  const result = response.choices[0]?.message?.content ?? text;
  console.log(`  ✓ Done. ${result.length} chars`);
  return result;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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

  console.log('='.repeat(60));
  console.log('Translation — Batch API (50 % cheaper, asynchronous)');
  console.log('='.repeat(60));
  console.log(`  ${sourceLang} → ${targetLang}`);
  console.log(`  Source : ${sourceFile}`);
  console.log(`  Output : ${outputFile}`);
  if (skipGlossary) console.log(`  Glossary: disabled (--no-glossary)`);
  if (skipConsistencyPass) console.log(`  Consistency pass: disabled (--no-consistency)`);

  const text = readFile(sourceFile);
  const paragraphs = splitIntoParagraphs(text);
  const blocks = createBlocks(paragraphs);

  console.log(`\n  ${paragraphs.length} paragraphs → ${blocks.length} blocks`);
  console.log(`  Total batch requests: ${blocks.length * 3}  (3 phases)`);
  blocks.forEach((b, i) =>
    console.log(`  Block ${i + 1}: ${b.substring(0, 80).replace(/\n/g, ' ')}…`),
  );

  // ── Glossary extraction ───────────────────────────────────────────────────
  let glossary: Glossary = [];
  const glossaryFile = outputFile.replace(/(\.[^.]+)?$/, '_glossary.json');

  if (!skipGlossary) {
    // Reuse glossary if one already exists from a previous interrupted run
    if (fs.existsSync(glossaryFile)) {
      console.log(`\n  Loading existing glossary from ${glossaryFile}…`);
      try {
        glossary = JSON.parse(fs.readFileSync(glossaryFile, 'utf-8'));
        console.log(`  Loaded ${glossary.length} entries`);
      } catch {
        console.warn('  ⚠️  Could not parse existing glossary — re-extracting');
      }
    }

    if (glossary.length === 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`Glossary extraction — ${sourceLang} → ${targetLang}`);
      console.log('='.repeat(60));
      console.log(`  Sending full source text (${text.length} chars) to API…`);

      // Glossary extraction is a single real-time call (not batched):
      // it must complete before any translation batch can be composed.
      glossary = await extractGlossary(openai, sourceLang, targetLang, text);

      fs.writeFileSync(glossaryFile, JSON.stringify(glossary, null, 2), 'utf-8');
      console.log(`  Saved glossary → ${glossaryFile}`);
    }

    console.log(`\n  Glossary (${glossary.length} entries):`);
    logGlossary(glossary);
  }

  // ── Three-phase batch translation ─────────────────────────────────────────
  const translated = await runBatchTranslation(blocks, sourceLang, targetLang, glossary);

  let output = translated.join('\n\n');
  fs.writeFileSync(outputFile, output, 'utf-8');

  // ── Optional final consistency pass ──────────────────────────────────────
  if (!skipConsistencyPass && glossary.length > 0) {
    output = await runConsistencyPass(output, targetLang, glossary);
    fs.writeFileSync(outputFile, output, 'utf-8');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅  Batch translation complete');
  console.log(`  Output : ${outputFile}  (${output.length} chars)`);
  if (!skipGlossary) console.log(`  Glossary: ${glossaryFile}`);
  console.log('  Intermediate JSONL files: batch_step1.jsonl  batch_step2.jsonl  batch_step3.jsonl');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});