# API Comparison Guide

## Standard API vs Batch API - Which Should You Use?

### Quick Decision Tree

```
Do you need results immediately (< 1 minute)?
├─ YES → Use Standard API (translate.ts)
└─ NO
   └─ Is your document large (> 20 blocks)?
      ├─ YES → Use Batch API (translate_batch.ts) - Save 50%!
      └─ NO
         └─ Do you want to save money?
            ├─ YES → Use Batch API
            └─ NO → Use Standard API for convenience
```

## Detailed Comparison

| Aspect | Standard API | Batch API |
|--------|-------------|-----------|
| **Cost** | Full price | **50% discount** ✨ |
| **Response Time** | Seconds | Minutes to hours |
| **Processing** | Synchronous | Asynchronous |
| **Best For** | Urgent, small tasks | Large volumes |
| **Rate Limits** | Standard | Higher throughput |
| **Complexity** | Simple | Moderate |
| **File Management** | None | Creates JSONL files |
| **Monitoring** | Real-time | Periodic polling |
| **Cancellation** | Not needed | Can cancel anytime |
| **Results** | Immediate | Must download |

## Use Case Examples

### When to Use Standard API

**Example 1: Quick Translation**
```
User uploads a 2-page document
Needs translation for a meeting in 10 minutes
→ Use Standard API
```

**Example 2: Interactive Chat**
```
User is having a conversation
Wants to translate responses in real-time
→ Use Standard API
```

**Example 3: Testing**
```
Developer testing translation quality
Iterating on prompts quickly
→ Use Standard API
```

### When to Use Batch API

**Example 1: Book Translation**
```
100-page book split into 200 blocks
User can wait overnight for results
Cost: $10 (standard) vs $5 (batch) → Save $5
→ Use Batch API
```

**Example 2: Document Archive**
```
Company has 50 documents to translate
Not urgent - can wait 24 hours
Cost savings: ~50%
→ Use Batch API
```

**Example 3: Bulk Processing**
```
Weekly newsletter translation
Scheduled job runs overnight
Consistent cost savings add up
→ Use Batch API
```

## Cost Breakdown

### Small Document (5 blocks, ~5,000 tokens total)

**Standard API:**
```
Input:  2,500 tokens × $2.50/1M = $0.00625
Output: 2,500 tokens × $10/1M  = $0.025
× 15 API calls (5 blocks × 3 steps) = $0.469
Total: ~$0.47
```

**Batch API:**
```
Same calculation × 0.5 = $0.234
Total: ~$0.23
Savings: $0.23 (50% off)
```

**Time difference:** ~30 seconds vs ~15-30 minutes

**Verdict:** Unless you're in a rush, use Batch API


### Medium Document (20 blocks, ~20,000 tokens total)

**Standard API:**
```
Total cost: ~$1.88
Processing time: ~2 minutes
```

**Batch API:**
```
Total cost: ~$0.94
Processing time: ~30-60 minutes
Savings: $0.94 (50% off)
```

**Verdict:** Batch API is a no-brainer for non-urgent work


### Large Document (100 blocks, ~100,000 tokens total)

**Standard API:**
```
Total cost: ~$9.40
Processing time: ~10 minutes
Risk: May hit rate limits
```

**Batch API:**
```
Total cost: ~$4.70
Processing time: ~1-3 hours
Savings: $4.70 (50% off)
Benefits: No rate limit issues
```

**Verdict:** Batch API strongly recommended

## Time Expectations

### Standard API Processing Time

| Document Size | API Calls | Expected Time |
|--------------|-----------|---------------|
| Small (5 blocks) | 15 | ~30 seconds |
| Medium (20 blocks) | 60 | ~2 minutes |
| Large (100 blocks) | 300 | ~10 minutes |
| Very Large (500 blocks) | 1500 | May hit rate limits |

### Batch API Processing Time

| Document Size | Typical Time | Maximum Time |
|--------------|--------------|--------------|
| Small (5 blocks) | 15-30 min | 24 hours |
| Medium (20 blocks) | 30-60 min | 24 hours |
| Large (100 blocks) | 1-3 hours | 24 hours |
| Very Large (500 blocks) | 3-6 hours | 24 hours |

**Note:** Batch times depend on OpenAI's queue load. Could be faster or slower.

## Monthly Cost Analysis

If you translate **10 medium documents per month**:

| API Type | Cost per Doc | Monthly Cost | Annual Cost |
|----------|-------------|--------------|-------------|
| Standard | $1.88 | $18.80 | $225.60 |
| Batch | $0.94 | $9.40 | $112.80 |
| **Savings** | **$0.94** | **$9.40** | **$112.80** |

## Feature Comparison

### Standard API Features
```typescript
✅ Real-time progress tracking
✅ Immediate results
✅ Simple implementation
✅ No file management
✅ Easy error handling
❌ Full price
❌ Rate limit constraints
❌ Higher costs at scale
```

### Batch API Features
```typescript
✅ 50% cheaper
✅ Higher throughput
✅ Better for bulk work
✅ No rate limit issues
✅ Can pause/resume
❌ Asynchronous (wait time)
❌ More complex setup
❌ Requires polling
```

## Code Complexity

### Standard API (Simple)
```typescript
// Simple and direct
const result = await callChatGPT(prompt);
console.log(result);
```

### Batch API (More Complex)
```typescript
// Multi-step process
1. Create JSONL file
2. Upload file
3. Create batch job
4. Poll for completion
5. Download results
6. Parse JSONL output
```

**Verdict:** Standard is easier, but Batch is worth the extra complexity for savings.

## Error Handling

### Standard API
- Errors happen immediately
- Easy to retry single requests
- Can debug in real-time

### Batch API
- Errors discovered after processing
- Must check error file
- Partial failures possible
- Can retry entire batch

## Recommendations

### For Individuals
- **Occasional use:** Standard API (convenience)
- **Regular use:** Batch API (cost savings)
- **Urgent work:** Standard API
- **Scheduled work:** Batch API

### For Businesses
- **Customer-facing:** Standard API (responsiveness)
- **Internal processing:** Batch API (efficiency)
- **Prototype/MVP:** Standard API (speed)
- **Production at scale:** Batch API (cost optimization)

### For Developers
- **Development:** Standard API (quick iteration)
- **Testing:** Standard API (immediate feedback)
- **CI/CD pipelines:** Batch API (cost-effective)
- **Production jobs:** Batch API (reliability)

## Switching Between APIs

Both versions share the same:
- Input format (`source.txt`)
- Output format (`output.txt`)
- Block creation logic
- Translation prompts

You can easily switch between them:

```bash
# Try standard first
npm run dev

# Then switch to batch for production
npm run batch
```

## Final Recommendation

```
Start with Standard API to:
- Validate translation quality
- Test your source.txt format
- Ensure prompts work well

Switch to Batch API when:
- Quality is confirmed
- Processing larger volumes
- Cost becomes significant
- Time pressure is low
```

## Summary

| Priority | Recommendation |
|----------|---------------|
| **Speed First** | Standard API |
| **Cost First** | Batch API ✨ |
| **Balanced** | Batch API (usually) |
| **Learning** | Start with Standard |
| **Production** | Batch API for volumes |

---

**Bottom Line:** If you can wait 30-60 minutes instead of 2 minutes, use Batch API and save 50%. For most use cases, the wait is worth it! 💰
