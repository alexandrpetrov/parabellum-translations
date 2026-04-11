import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface GlossaryEntry {
  source: string;       // Original term in source language
  target: string;       // Canonical translation in target language
  category: string;     // e.g. "person", "place", "ethnonym", "dynasty", ...
  confidence: 'high' | 'medium' | 'low';
  notes?: string;       // e.g. "Wikipedia: es.wikipedia.org/wiki/..."
}

export type Glossary = GlossaryEntry[];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set([
  'person', 'place', 'ethnonym', 'tribe', 'kingdom', 'dynasty',
  'title', 'religion', 'event', 'period', 'term', 'other',
]);

const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

function validateEntry(raw: unknown, index: number): GlossaryEntry | null {
  if (typeof raw !== 'object' || raw === null) {
    console.warn(`  ⚠️  Glossary entry ${index}: not an object — skipped`);
    return null;
  }
  const e = raw as Record<string, unknown>;

  if (typeof e.source !== 'string' || e.source.trim() === '') {
    console.warn(`  ⚠️  Glossary entry ${index}: missing/empty "source" — skipped`);
    return null;
  }
  if (typeof e.target !== 'string' || e.target.trim() === '') {
    console.warn(`  ⚠️  Glossary entry ${index}: missing/empty "target" — skipped`);
    return null;
  }

  // Normalise category
  const rawCat = typeof e.category === 'string' ? e.category.toLowerCase().trim() : '';
  const category = VALID_CATEGORIES.has(rawCat) ? rawCat : 'other';

  // Normalise confidence
  const rawConf = typeof e.confidence === 'string' ? e.confidence.toLowerCase().trim() : '';
  const confidence = (VALID_CONFIDENCE.has(rawConf) ? rawConf : 'medium') as GlossaryEntry['confidence'];

  return {
    source: e.source.trim(),
    target: e.target.trim(),
    category,
    confidence,
    notes: typeof e.notes === 'string' ? e.notes.trim() : undefined,
  };
}

function parseGlossaryJSON(raw: string): Glossary {
  // Strip possible markdown fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to rescue partial JSON: find the first '[' and last ']'
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error(`Glossary JSON could not be parsed even after rescue attempt.\nRaw: ${raw.slice(0, 300)}`);
      }
    } else {
      throw new Error(`Glossary response is not valid JSON.\nRaw: ${raw.slice(0, 300)}`);
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Glossary JSON root must be an array, got ${typeof parsed}`);
  }

  const entries: GlossaryEntry[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const entry = validateEntry(parsed[i], i);
    if (entry) entries.push(entry);
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicateGlossary(entries: GlossaryEntry[]): GlossaryEntry[] {
  // Keep one entry per (lowercased) source term — prefer higher confidence
  const confidenceRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const map = new Map<string, GlossaryEntry>();

  for (const entry of entries) {
    const key = entry.source.toLowerCase();
    const existing = map.get(key);
    if (!existing || confidenceRank[entry.confidence] > confidenceRank[existing.confidence]) {
      map.set(key, entry);
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export function glossaryExtractionPrompt(
  sourceLang: string,
  targetLang: string,
  text: string,
): string {
  return `You are a historical-text translator and terminology specialist.

Read the following ${sourceLang} text and extract every proper noun or fixed historical term that must be translated consistently throughout the entire document.

Include all of these categories where they appear:
- personal names (rulers, generals, authors, religious figures, etc.)
- place names (cities, regions, rivers, mountains, countries)
- ethnonyms (peoples and ethnic groups)
- tribes and clans
- kingdoms, states, empires, and polities
- dynasties and ruling houses
- titles and offices (e.g. khan, tsar, caliph, voivode)
- religions, sects, and named religious groups
- battles, treaties, and named historical events
- historical periods and eras
- fixed historical expressions and domain-specific terms
- any other term that should remain lexically stable across paragraphs

For each entry, choose ONE canonical ${targetLang} translation and follow this priority:
1. Use the standard form found on ${targetLang}-language Wikipedia if you are confident it exists.
2. Otherwise use the most established conventional form in ${targetLang} historical literature.
3. Only if neither is known, generate the best reasonable translation or transliteration.

Rules:
- One entry per unique source term (deduplicate).
- Never include variant spellings in the same list.
- Do not include common nouns or adjectives that do not need to be fixed.
- Return ONLY a JSON array. No prose, no markdown fences, no extra keys.

Each element must have exactly these fields:
{
  "source": "<exact term as it appears in the source text>",
  "target": "<canonical ${targetLang} translation>",
  "category": "<one of: person | place | ethnonym | tribe | kingdom | dynasty | title | religion | event | period | term | other>",
  "confidence": "<high | medium | low>",
  "notes": "<optional: e.g. Wikipedia article name, or reason for the chosen form>"
}

Source text:
${text}`;
}

export function formatGlossaryForPrompt(glossary: Glossary): string {
  if (glossary.length === 0) return '(no glossary entries)';

  const lines = glossary.map(
    e => `  "${e.source}" → "${e.target}" [${e.category}]${e.notes ? ` (${e.notes})` : ''}`,
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// API call with retries
// ---------------------------------------------------------------------------

export async function extractGlossary(
  openai: OpenAI,
  sourceLang: string,
  targetLang: string,
  text: string,
  model = 'gpt-4o',
  retries = 3,
): Promise<Glossary> {
  const prompt = glossaryExtractionPrompt(sourceLang, targetLang, text);

  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`  [glossary] Extraction attempt ${attempt}/${retries}…`);
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low randomness — we want deterministic term choices
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const entries = parseGlossaryJSON(raw);
      const deduped = deduplicateGlossary(entries);

      console.log(`  [glossary] Extracted ${entries.length} entries, ${deduped.length} after deduplication`);
      return deduped;
    } catch (err: any) {
      const isLast = attempt === retries;
      console.warn(`  ⚠️  Glossary extraction error (attempt ${attempt}/${retries}): ${err?.message ?? err}`);
      if (isLast) throw new Error(`Glossary extraction failed after ${retries} attempts: ${err}`);
      const delay = 5000 * Math.pow(2, attempt - 1);
      console.warn(`  Retrying in ${delay / 1000}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return []; // unreachable
}

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

export function logGlossary(glossary: Glossary): void {
  if (glossary.length === 0) {
    console.log('  (empty glossary)');
    return;
  }

  // Group by category for readability
  const byCategory = new Map<string, GlossaryEntry[]>();
  for (const e of glossary) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category)!.push(e);
  }

  for (const [cat, entries] of byCategory) {
    console.log(`\n  [${cat}]`);
    for (const e of entries) {
      const conf = e.confidence === 'high' ? '' : ` (${e.confidence})`;
      console.log(`    ${e.source}  →  ${e.target}${conf}`);
      if (e.notes) console.log(`      ↳ ${e.notes}`);
    }
  }
}