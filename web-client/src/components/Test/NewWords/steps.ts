import { copy } from '../../../copy';

export type StepKey = 'understand' | 'say' | 'write';

export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'understand', label: copy.newWords.stepUnderstand },
  { key: 'say', label: copy.newWords.stepSay },
  { key: 'write', label: copy.newWords.stepWrite },
];
