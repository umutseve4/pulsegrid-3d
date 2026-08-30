import { describe, expect, it } from 'vitest';
import { nextState, scenarioNumber, snapshotFor, statusColor } from '../src/simulation';

describe('incident lifecycle', () => {
  it('moves deterministically from healthy through verified recovery and reset', () => {
    const states = ['healthy'] as string[];
    for (let index = 0; index < 5; index += 1) states.push(nextState(states.at(-1) as Parameters<typeof nextState>[0]));
    expect(states).toEqual(['healthy','failure','quarantined','replaying','recovered','healthy']);
  });

  it('exposes truthful evidence for every state', () => {
    expect(snapshotFor('failure')).toMatchObject({ label:'DEGRADED', latency:286, validity:'94.12' });
    expect(snapshotFor('quarantined').detail).toBe('2,418 events isolated');
    expect(snapshotFor('recovered')).toMatchObject({ progress:100, validity:'100.00', nextAction:'Reset scenario' });
  });

  it('assigns semantic color and ordered scenario labels', () => {
    expect(statusColor('failure')).toBe('#ff5d6c');
    expect(statusColor('quarantined')).toBe('#ffbd59');
    expect(scenarioNumber('replaying')).toBe('04');
  });
});
