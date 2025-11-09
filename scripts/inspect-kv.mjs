import { kv } from '@vercel/kv';

async function run() {
  const maxScore = Date.now();
  const ids = await kv.zrange('finance:records:list', maxScore, 0, {
    byScore: true,
    rev: true,
    offset: 0,
    count: 20,
  });

  console.log('ids', ids);

  if (Array.isArray(ids)) {
    for (const id of ids) {
      const record = await kv.get(`finance:records:${id}`);
      console.log('record', id, record);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
