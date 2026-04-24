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

const cache = new Map<string, DecompositionComponent[]>();

export async function decomposeCharacter(char: string): Promise<DecompositionComponent[]> {
  const cached = cache.get(char);
  if (cached !== undefined) {
    return cached;
  }
  const result = await decomposeCharacterFn({ char });
  const components = result.data.components;
  cache.set(char, components);
  return components;
}
