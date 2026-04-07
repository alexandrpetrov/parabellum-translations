# Ukrainian to Spanish Translation Tool - Batch API Version

A TypeScript application that translates Ukrainian text to Spanish using the **OpenAI Batch API** with a 3-step refinement process. This version is **50% cheaper** than the standard API but processes asynchronously.

## 🎯 Why Use Batch API?

| Feature | Standard API | Batch API |
|---------|-------------|-----------|
| **Cost** | Standard pricing | **50% discount** |
| **Speed** | Real-time (seconds) | Asynchronous (minutes to 24h) |
| **Best For** | Urgent, small tasks | Large volumes, non-urgent |
| **Rate Limits** | Standard limits | Higher throughput |

## 📋 Features

- 💰 **50% cheaper** than standard API
- 📝 Intelligent paragraph grouping (blocks of 3)
- 🏷️ Automatic title detection (< 150 characters)
- 🔄 3-phase translation pipeline:
  - **Phase 1:** Ukrainian → Spanish translation
  - **Phase 2:** Style improvement
  - **Phase 3:** Natural Spanish enhancement
- 📊 Automatic polling and status tracking
- 🛠️ Batch management utilities
- ⚡ TypeScript with full type safety

## 🚀 Quick Start

### 1. Installation

```bash
# If using nvm, use the specified Node version
nvm use    # Uses Node 20 from .nvmrc

# Install dependencies
npm install
```

### 2. Setup API Key

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 3. Add Your Text

Place your Ukrainian text in `source.txt`

### 4. Run Translation

```bash
npm run batch
```

## 📖 How It Works

### Process Overview

```
1. Read source.txt
   ↓
2. Split into blocks (3 paragraphs each)
   ↓
3. PHASE 1: Submit translation batch → Wait → Download results
   ↓
4. PHASE 2: Submit style improvement batch → Wait → Download results
   ↓
5. PHASE 3: Submit naturalization batch → Wait → Download results
   ↓
6. Concatenate results → Save to output.txt
```

### Three-Phase Execution

The batch process runs in **three sequential phases** (each block goes through all phases):

**Phase 1: Translation**
- Creates `batch_step1.jsonl` with all translation requests
- Uploads and submits batch job
- Polls every 30 seconds until complete
- Downloads translated text

**Phase 2: Style Improvement**
- Takes Phase 1 outputs
- Creates `batch_step2.jsonl` with style improvement requests
- Submits new batch job
- Polls and downloads results

**Phase 3: Naturalization**
- Takes Phase 2 outputs
- Creates `batch_step3.jsonl` with naturalization requests
- Submits final batch job
- Polls and downloads final results

### Custom IDs

Each request has a unique ID: `block_{index}_step_{1,2,3}`
- Example: `block_0_step_1` = Block 0, Translation step
- Example: `block_5_step_3` = Block 5, Naturalization step

## 🛠️ Available Commands

### Translation Commands

```bash
# Run batch translation (recommended)
npm run batch

# Build and run compiled version
npm run batch:build
```

### Batch Management Commands

```bash
# Check status of a specific batch
npm run batch:status <batch_id>

# List recent batch jobs
npm run batch:list [limit]

# Cancel a running batch
npm run batch:cancel <batch_id>
```

### Examples

```bash
# Check if your batch is complete
npm run batch:status batch_abc123xyz

# List last 20 batches
npm run batch:list 20

# Cancel a batch you submitted by mistake
npm run batch:cancel batch_abc123xyz
```

## ⏱️ Timing Expectations

### Processing Time

- **Minimum:** A few minutes (if queue is empty)
- **Typical:** 15-60 minutes
- **Maximum:** Up to 24 hours (per batch job)

### Total Time for 3 Phases

For a document with 10 blocks:
- Phase 1: 10-30 minutes
- Phase 2: 10-30 minutes
- Phase 3: 10-30 minutes
- **Total:** 30-90 minutes (typical)

**Note:** You can stop the script and check status later using the batch ID printed in the console.

## 💰 Cost Comparison

### Example: 100,000 tokens total (large document)

**Standard API (gpt-4o):**
- Input: 50,000 tokens × $2.50/1M = $0.125
- Output: 50,000 tokens × $10/1M = $0.500
- **Total:** ~$0.625

**Batch API (gpt-4o):**
- Same calculation × 0.5 (50% discount)
- **Total:** ~$0.312

**Savings:** $0.313 (50% off)

### Per Block Calculation

For 10 blocks × 3 steps = 30 API calls:
- Standard: ~$0.625
- Batch: ~$0.312
- **You save:** ~$0.31 per document

## 📂 File Structure

```
project/
├── translate_batch.ts      # Main batch translation script
├── batch_utils.ts          # Batch management utilities
├── translate.ts            # Standard API version (for comparison)
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── source.txt              # Input (your Ukrainian text)
├── output.txt              # Generated output
├── batch_step1.jsonl       # Phase 1 requests (auto-generated)
├── batch_step2.jsonl       # Phase 2 requests (auto-generated)
└── batch_step3.jsonl       # Phase 3 requests (auto-generated)
```

## 🔧 Configuration

### Change Model

Edit `translate_batch.ts`, line ~42:

```typescript
model: 'gpt-4o',  // Change to 'gpt-4-turbo', 'gpt-3.5-turbo', etc.
```

### Adjust Polling Interval

Edit `translate_batch.ts`, in `waitForBatchCompletion()`:

```typescript
await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
// Change to 60000 for 1 minute, etc.
```

### Modify Block Size

Edit `createBlocks()` function:

```typescript
if (nonTitleCount >= 3) {  // Change 3 to desired number
```

### Change Title Threshold

```typescript
const isTitle = para.length < 150;  // Adjust character count
```

## 🐛 Troubleshooting

### "Batch job failed"
- Check batch errors: `npm run batch:status <batch_id>`
- Review error file if available
- Ensure input doesn't contain invalid characters

### "No output file available"
- Batch might still be processing
- Check status: `npm run batch:status <batch_id>`
- Wait and try again

### Long processing time
- Normal for batch API (can take hours)
- Check current status periodically
- OpenAI queues are FIFO (first in, first out)

### API rate limits
- Batch API has different (higher) limits
- If you hit limits, requests will queue
- Check your account limits at platform.openai.com

## 🔍 Monitoring Your Batches

### Check Status Programmatically

```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const batch = await openai.batches.retrieve('batch_abc123');
console.log(batch.status); // 'validating', 'in_progress', 'completed', etc.
```

### View in Dashboard

Visit https://platform.openai.com/batches to see all your batch jobs

## 📊 Batch Lifecycle

```
1. validating     - Checking your input file
2. in_progress    - Processing requests
3. finalizing     - Preparing output file
4. completed      - Done! Results available
5. failed         - Error occurred
6. expired        - Took > 24h (rare)
7. cancelled      - You cancelled it
```

## 🆚 When to Use Which Version?

### Use Batch API (`translate_batch.ts`) When:
- ✅ You have large documents (many blocks)
- ✅ You can wait minutes/hours for results
- ✅ Cost savings are important
- ✅ Processing in bulk

### Use Standard API (`translate.ts`) When:
- ✅ You need results immediately
- ✅ Document is small (< 10 blocks)
- ✅ Interactive use case
- ✅ Time is more important than cost

## 🔐 Security Notes

- Never commit `.env` file (it contains your API key)
- Batch files (`.jsonl`) don't contain API keys
- Output files may contain sensitive translations
- Add sensitive outputs to `.gitignore`

## 📝 JSONL Format

Batch request files use JSONL (JSON Lines) format:

```jsonl
{"custom_id":"block_0_step_1","method":"POST","url":"/v1/chat/completions","body":{...}}
{"custom_id":"block_1_step_1","method":"POST","url":"/v1/chat/completions","body":{...}}
```

Each line is a separate JSON object (no commas between lines).

## 🎓 Advanced Usage

### Resume from Specific Phase

If Phase 1 completes but Phase 2 fails, you can modify the script to:
1. Skip Phase 1
2. Load Phase 1 results from file
3. Continue with Phase 2

### Parallel Processing

For very large documents, you could:
1. Split into multiple source files
2. Run multiple batch jobs in parallel
3. Merge results afterward

### Custom Prompts

Modify the prompts in `createBatchRequests()` and subsequent phases to customize translation behavior.

## 📚 Additional Resources

- [OpenAI Batch API Documentation](https://platform.openai.com/docs/guides/batch)
- [Batch API Pricing](https://openai.com/api/pricing/)
- [Rate Limits](https://platform.openai.com/docs/guides/rate-limits)

## 🤝 Support

For issues:
- Check batch status first
- Review JSONL files for malformed requests
- Check OpenAI service status: https://status.openai.com

## 📄 License

MIT

---

**Happy translating with 50% savings! 💰**
