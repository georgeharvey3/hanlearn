export interface ShortcutDef {
  keys: string;
  description: string;
  context?: string;
}

export interface ShortcutGroup {
  id: string;
  label: string;
  shortcuts: ShortcutDef[];
}

export const keyboardShortcuts: ShortcutGroup[] = [
  {
    id: 'global',
    label: 'Global',
    shortcuts: [{ keys: '?', description: 'Open keyboard shortcuts' }],
  },
  {
    id: 'test',
    label: 'Test',
    shortcuts: [
      { keys: 'Space', description: 'Speak character / show answer', context: 'context-dependent' },
      { keys: 'Ctrl+B', description: 'Focus answer input' },
      { keys: 'Ctrl+M', description: 'Activate microphone' },
      { keys: 'Ctrl+Q', description: 'Speak character (TTS)' },
      { keys: 'Ctrl+I', description: "I don't know" },
      { keys: 'Up', description: 'Mark known', context: 'flashcard mode' },
      { keys: 'Right', description: 'Mark nearly known', context: 'flashcard mode' },
      { keys: 'Down', description: 'Mark not known', context: 'flashcard mode' },
      { keys: 'S', description: 'Toggle sentence display' },
      { keys: 'H', description: 'Show hint' },
      { keys: 'P', description: 'Toggle pinyin visibility' },
      { keys: 'A', description: 'Toggle auto-record' },
      { keys: 'C', description: 'Toggle character drawing' },
      { keys: 'E', description: 'Toggle English display' },
      { keys: 'T', description: 'Toggle translation' },
      { keys: 'Enter', description: 'Submit answer' },
    ],
  },
  {
    id: 'new-words',
    label: 'New Words Carousel',
    shortcuts: [
      { keys: 'Left', description: 'Previous word' },
      { keys: 'Right', description: 'Next word / start test' },
    ],
  },
  {
    id: 'add-words',
    label: 'Add Words',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Focus add-word input' },
      { keys: 'Escape', description: 'Dismiss open modal' },
    ],
  },
  {
    id: 'sentence',
    label: 'Sentence Exercises',
    shortcuts: [
      { keys: 'Ctrl+B', description: 'Focus answer input' },
      { keys: 'Ctrl+M', description: 'Activate microphone' },
      { keys: 'Left', description: 'Previous sentence' },
      { keys: 'Right', description: 'Next sentence' },
      { keys: 'Up', description: 'Next word', context: 'after submit' },
      { keys: 'Down', description: 'Try again', context: 'after submit' },
      { keys: 'Escape', description: 'Close popup' },
    ],
  },
];
