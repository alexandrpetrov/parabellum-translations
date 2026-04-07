import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function guard(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌  OPENAI_API_KEY is not set.');
    process.exit(1);
  }
}

function fmtTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function status(batchId: string): Promise<void> {
  const b = await openai.batches.retrieve(batchId);

  console.log('='.repeat(60));
  console.log('Batch status');
  console.log('='.repeat(60));
  console.log(`  ID          : ${b.id}`);
  console.log(`  Status      : ${b.status}`);
  console.log(`  Created     : ${fmtTime(b.created_at)}`);

  if (b.metadata?.description) console.log(`  Description : ${b.metadata.description}`);

  if (b.request_counts) {
    const { total, completed, failed } = b.request_counts;
    console.log(`  Progress    : ${completed}/${total}  (${failed} failed)`);
  }

  if (b.completed_at) console.log(`  Completed   : ${fmtTime(b.completed_at)}`);
  if (b.expires_at)   console.log(`  Expires     : ${fmtTime(b.expires_at)}`);
  if (b.output_file_id) console.log(`  Output file : ${b.output_file_id}`);
  if (b.error_file_id)  console.log(`  Error file  : ${b.error_file_id}`);

  if (b.errors) {
    console.log('\n  Errors:');
    console.log(JSON.stringify(b.errors, null, 4));
  }

  console.log('='.repeat(60));
}

async function list(limit = 10): Promise<void> {
  console.log(`=`.repeat(60));
  console.log(`Recent batch jobs  (limit ${limit})`);
  console.log('='.repeat(60));

  const batches = await openai.batches.list({ limit });

  for (const b of batches.data) {
    const { total = 0, completed = 0 } = b.request_counts ?? {};
    console.log(`\n  ${b.id}`);
    console.log(`    Status  : ${b.status}`);
    console.log(`    Created : ${fmtTime(b.created_at)}`);
    console.log(`    Progress: ${completed}/${total}`);
    if (b.metadata?.description) console.log(`    Desc    : ${b.metadata.description}`);
    console.log('  ' + '-'.repeat(56));
  }
}

async function cancel(batchId: string): Promise<void> {
  const b = await openai.batches.cancel(batchId);
  console.log('='.repeat(60));
  console.log(`Batch ${b.id} cancelled`);
  console.log(`Status: ${b.status}`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  guard();
  const [, , command, arg] = process.argv;

  switch (command) {
    case 'status':
      if (!arg) { console.error('Usage: yarn translate:batch:status <batch_id>'); process.exit(1); }
      await status(arg);
      break;

    case 'list':
      await list(arg ? parseInt(arg, 10) : 10);
      break;

    case 'cancel':
      if (!arg) { console.error('Usage: yarn translate:batch:cancel <batch_id>'); process.exit(1); }
      await cancel(arg);
      break;

    default:
      console.log('Batch management utility');
      console.log('='.repeat(60));
      console.log('  yarn translate:batch:status <id>   — check batch status');
      console.log('  yarn translate:batch:list [limit]  — list recent batches');
      console.log('  yarn translate:batch:cancel <id>   — cancel a batch');
  }
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});