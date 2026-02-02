// Global type augmentations

// Extend Window interface for webkit speech recognition
interface Window {
  webkitSpeechRecognition: typeof SpeechRecognition;
  HanziWriter: {
    create(
      target: string | HTMLElement,
      character: string,
      options?: HanziWriterOptions
    ): HanziWriterInstance;
  };
}

interface HanziWriterOptions {
  width?: number;
  height?: number;
  padding?: number;
  showOutline?: boolean;
  showCharacter?: boolean;
  strokeAnimationSpeed?: number;
  delayBetweenStrokes?: number;
  strokeColor?: string;
  radicalColor?: string;
  highlightColor?: string;
  outlineColor?: string;
  drawingColor?: string;
  drawingWidth?: number;
  showHintAfterMisses?: number;
  highlightOnComplete?: boolean;
  highlightCompleteColor?: string;
  charDataLoader?: (char: string, onComplete: (data: object) => void) => void;
  onLoadCharDataSuccess?: (data: object) => void;
  onLoadCharDataError?: (error: Error) => void;
  renderer?: 'svg' | 'canvas';
}

interface HanziWriterInstance {
  showCharacter(): void;
  hideCharacter(): void;
  showOutline(): void;
  hideOutline(): void;
  animateCharacter(): Promise<void>;
  animateStroke(strokeNum: number): Promise<void>;
  quiz(options?: QuizOptions): void;
  cancelQuiz(): void;
  setCharacter(char: string): Promise<void>;
}

interface QuizOptions {
  onComplete?: (summaryData: { totalMistakes: number }) => void;
  onCorrectStroke?: (strokeData: object) => void;
  onMistake?: (strokeData: object) => void;
}

// CSS modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Asset imports
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.mp3' {
  const value: string;
  export default value;
}

declare module '*.wav' {
  const value: string;
  export default value;
}
