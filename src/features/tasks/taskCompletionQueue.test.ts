import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

describe('safe task completion queue', () => {
  beforeEach(() => sessionStorage.clear());

  it('deduplicates a task and preserves its authoritative revision payload', async () => {
    const { taskCompletionQueue } = await import('./taskCompletionQueue');
    const base = { workspaceId: 'w1', userId: 'u1', taskId: 't1', progress: { revision: 3, notes: 'done', steps: [], evidence: [] } };
    await taskCompletionQueue.enqueue(base);
    await taskCompletionQueue.enqueue({ ...base, progress: { ...base.progress, revision: 4 } });
    const queued = await taskCompletionQueue.list('w1', 'u1');
    expect(queued).toHaveLength(1);
    expect(queued[0].progress.revision).toBe(4);
  });
});
