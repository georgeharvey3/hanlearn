import { copy } from '../../../copy';

export type StepKey = 'understand' | 'speak' | 'write';

export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'understand', label: copy.newWords.stepUnderstand },
  { key: 'speak', label: copy.newWords.stepSpeak },
  { key: 'write', label: copy.newWords.stepWrite },
];
