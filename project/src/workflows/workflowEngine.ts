// Lightweight client-side workflow engine (demo only, no persistence)
export interface WorkflowStep {
  id: string;
  type: string; // info | capture | analyze | review | commit
  [key: string]: any;
}
export interface WorkflowDefinition {
  id: string;
  name: string;
  modality?: string;
  version: number;
  steps: WorkflowStep[];
}
export interface WorkflowState {
  definition: WorkflowDefinition;
  index: number;
  data: Record<string, any>;
  complete: boolean;
}
export type WorkflowListener = (evt: { type: string; step?: WorkflowStep; state: WorkflowState; payload?: any }) => void;

export class WorkflowRunner {
  private state: WorkflowState;
  private listeners: WorkflowListener[] = [];
  constructor(def: WorkflowDefinition) {
    this.state = { definition: def, index: 0, data: {}, complete: false };
  }
  on(listener: WorkflowListener) { this.listeners.push(listener); }
  private emit(type: string, payload?: any) { const step = this.currentStep(); this.listeners.forEach(l=>l({ type, step, state: this.state, payload })); }
  currentStep(): WorkflowStep | undefined { return this.state.definition.steps[this.state.index]; }
  start() { this.emit('workflow.start'); this.emit('step.enter'); }
  next(payload?: any) {
    if (payload) this.state.data[this.currentStep()?.id || ''] = payload;
    if (this.state.index + 1 >= this.state.definition.steps.length) { this.state.complete = true; this.emit('workflow.complete'); return; }
    this.state.index += 1; this.emit('step.enter');
  }
  getState() { return this.state; }
}
