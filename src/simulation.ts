export type SystemState = 'healthy' | 'failure' | 'quarantined' | 'replaying' | 'recovered';

export interface Snapshot {
  state: SystemState;
  label: string;
  detail: string;
  throughput: string;
  latency: number;
  validity: string;
  progress: number;
  nextAction: string;
}

const snapshots: Record<SystemState, Snapshot> = {
  healthy: { state:'healthy', label:'NOMINAL', detail:'All districts synchronized', throughput:'48.2K', latency:84, validity:'99.97', progress:0, nextAction:'Inject failure' },
  failure: { state:'failure', label:'DEGRADED', detail:'Schema drift at Validation', throughput:'31.4K', latency:286, validity:'94.12', progress:25, nextAction:'Quarantine events' },
  quarantined: { state:'quarantined', label:'CONTAINED', detail:'2,418 events isolated', throughput:'38.7K', latency:164, validity:'99.94', progress:50, nextAction:'Replay batch' },
  replaying: { state:'replaying', label:'REPLAYING', detail:'Verified batch returning', throughput:'52.1K', latency:118, validity:'99.98', progress:75, nextAction:'Verify recovery' },
  recovered: { state:'recovered', label:'RECOVERED', detail:'Evidence chain complete', throughput:'48.6K', latency:82, validity:'100.00', progress:100, nextAction:'Reset scenario' }
};

const sequence: SystemState[] = ['healthy','failure','quarantined','replaying','recovered'];

export function snapshotFor(state: SystemState): Snapshot { return snapshots[state]; }
export function nextState(state: SystemState): SystemState {
  const index = sequence.indexOf(state);
  return sequence[(index + 1) % sequence.length] ?? 'healthy';
}
export function scenarioNumber(state: SystemState): string {
  return String(sequence.indexOf(state) + 1).padStart(2, '0');
}
export function statusColor(state: SystemState): string {
  if (state === 'failure') return '#ff5d6c';
  if (state === 'quarantined') return '#ffbd59';
  if (state === 'replaying' || state === 'recovered') return '#a4ff84';
  return '#55f7e4';
}
