declare module 'hanzi' {
  interface DecomposeResult {
    character: string;
    components: string[];
  }

  interface DictionaryEntry {
    traditional: string;
    simplified: string;
    pinyin: string;
    definition: string;
  }

  function start(): void;
  function decompose(character: string, type?: number): DecomposeResult;
  function getRadicalMeaning(radical: string): string;
  function definitionLookup(
    character: string,
    scriptType?: string
  ): DictionaryEntry[] | undefined;
}
