import { describe, expect, it } from 'vitest';
import { makeTask } from '../../services/export/testFixtures';
import { dependencyCandidates, dependencyLinks, wouldCreateCycle } from './dependencies';

const tasks = [
  makeTask({ id: 'a', startDate: '2026-03-02', dueDate: '2026-03-04' }),
  makeTask({ id: 'b', startDate: '2026-03-05', dueDate: '2026-03-08', dependencies: ['a'] }),
  makeTask({ id: 'c', startDate: '2026-03-03', dueDate: '2026-03-09', dependencies: ['b'] }),
];

describe('dependencyLinks', () => {
  it('returns one link per known predecessor', () => {
    expect(dependencyLinks(tasks)).toEqual([
      { predecessorId: 'a', successorId: 'b', violation: false },
      { predecessorId: 'b', successorId: 'c', violation: true },
    ]);
  });

  it('flags a predecessor that ends after its successor starts', () => {
    const links = dependencyLinks(tasks);
    expect(links.find((l) => l.successorId === 'c')?.violation).toBe(true);
  });

  it('does not flag a handover on the day after', () => {
    const ok = [
      makeTask({ id: 'a', startDate: '2026-03-02', dueDate: '2026-03-04' }),
      makeTask({ id: 'b', startDate: '2026-03-05', dueDate: '2026-03-06', dependencies: ['a'] }),
    ];
    expect(dependencyLinks(ok)[0].violation).toBe(false);
  });

  it('drops unknown ids, self references and duplicates', () => {
    const noisy = [
      makeTask({ id: 'a', startDate: '2026-03-02', dueDate: '2026-03-04' }),
      makeTask({ id: 'b', startDate: '2026-03-05', dueDate: '2026-03-07', dependencies: ['a', 'a', 'b', 'ghost'] }),
    ];
    expect(dependencyLinks(noisy)).toEqual([{ predecessorId: 'a', successorId: 'b', violation: false }]);
  });

  it('survives a cycle in the stored data', () => {
    const cyclic = [
      makeTask({ id: 'a', dependencies: ['b'] }),
      makeTask({ id: 'b', dependencies: ['a'] }),
    ];
    expect(dependencyLinks(cyclic)).toHaveLength(2);
  });
});

describe('wouldCreateCycle', () => {
  it('rejects a self dependency', () => {
    expect(wouldCreateCycle(tasks, 'a', 'a')).toBe(true);
  });

  it('rejects a direct back edge', () => {
    expect(wouldCreateCycle(tasks, 'a', 'b')).toBe(true);
  });

  it('rejects a transitive back edge', () => {
    expect(wouldCreateCycle(tasks, 'a', 'c')).toBe(true);
  });

  it('accepts a forward edge', () => {
    const extra = [...tasks, makeTask({ id: 'd' })];
    expect(wouldCreateCycle(extra, 'd', 'c')).toBe(false);
    expect(wouldCreateCycle(extra, 'c', 'd')).toBe(false);
  });

  it('accepts an unknown candidate rather than throwing', () => {
    expect(wouldCreateCycle(tasks, 'a', 'ghost')).toBe(false);
  });

  it('terminates on data that already contains a cycle', () => {
    const cyclic = [
      makeTask({ id: 'a', dependencies: ['b'] }),
      makeTask({ id: 'b', dependencies: ['a'] }),
      makeTask({ id: 'c' }),
    ];
    expect(wouldCreateCycle(cyclic, 'c', 'a')).toBe(false);
    expect(wouldCreateCycle(cyclic, 'a', 'b')).toBe(true);
  });
});

describe('dependencyCandidates', () => {
  it('excludes itself and every task that would close a loop', () => {
    expect(dependencyCandidates(tasks, 'a').map((t) => t.id)).toEqual([]);
    expect(dependencyCandidates(tasks, 'b').map((t) => t.id)).toEqual(['a']);
    expect(dependencyCandidates(tasks, 'c').map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('keeps an already-selected dependency in the list', () => {
    const selected = [
      makeTask({ id: 'a', dependencies: ['b'] }),
      makeTask({ id: 'b', dependencies: ['a'] }),
    ];
    expect(dependencyCandidates(selected, 'a').map((t) => t.id)).toEqual(['b']);
  });

  it('returns nothing for an unknown task', () => {
    expect(dependencyCandidates(tasks, 'ghost').map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});
