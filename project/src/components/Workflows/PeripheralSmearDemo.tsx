import React, { useEffect, useState } from 'react';
import workflow from '../../workflows/cbcPeripheralSmearExample.json';
import { WorkflowRunner, WorkflowStep } from '../../workflows/workflowEngine';

// Very lightweight demo UI; not wired into orders/results yet.
const PeripheralSmearDemo: React.FC = () => {
  const [runner] = useState(() => new WorkflowRunner(workflow as any));
  const [step, setStep] = useState<WorkflowStep | undefined>();
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    runner.on(evt => {
      if (evt.type === 'step.enter') setStep(evt.step);
      setLog(l => [...l, evt.type + (evt.step ? ':' + evt.step.id : '')]);
    });
    runner.start();
  }, [runner]);

  const advance = () => runner.next({ timestamp: Date.now() });

  if (!step) return <div className="p-4">Loading workflow...</div>;
  if (runner.getState().complete) return <div className="p-4">Workflow Complete<div className='mt-4 text-xs whitespace-pre-wrap bg-gray-50 p-2 border rounded'>{log.join('\n')}</div></div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Peripheral Smear Demo</h2>
      <div className="border rounded p-4 bg-white shadow-sm">
        <div className="text-sm font-medium mb-2">Step: {step.id}</div>
        <pre className="text-xs bg-gray-50 p-2 rounded border overflow-x-auto">{JSON.stringify(step, null, 2)}</pre>
        <button onClick={advance} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Next</button>
      </div>
      <div className="text-xs whitespace-pre-wrap bg-gray-50 p-2 border rounded">{log.join('\n')}</div>
    </div>
  );
};

export default PeripheralSmearDemo;
