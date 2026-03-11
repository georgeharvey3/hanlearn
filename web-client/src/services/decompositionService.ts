import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

interface DecompositionComponent {
  char: string;
  meaning: string | null;
  pinyin: string | null;
}

interface DecomposeResult {
  components: DecompositionComponent[];
}

const decomposeCharacterFn = httpsCallable<{ char: string }, DecomposeResult>(
  functions,
  'decomposeCharacter',
);

export async function decomposeCharacter(char: string): Promise<DecompositionComponent[]> {
  const result = await decomposeCharacterFn({ char });
  return result.data.components;
}
