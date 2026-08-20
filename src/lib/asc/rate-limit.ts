import PQueue from "p-queue";

const queues = new Map<string, PQueue>();

export function queueFor(accountId: string): PQueue {
  let q = queues.get(accountId);
  if (!q) {
    q = new PQueue({ concurrency: 3, interval: 1000, intervalCap: 8 });
    queues.set(accountId, q);
  }
  return q;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
