// Every string the app shows a user, grouped by screen. A component reads
// `copy.test.showAnswer`, never a literal. A string with a run-time value is a
// function. Screens move in here as they are restyled; `copy.test.ts` lists
// the files that must read from it.
export const copy = {
  test: {
    verbDraw: 'Draw the ',
    verbFlashcard: 'What is the ',
    verbEnter: 'Enter the ',
    promptAfter: ' for...',
    progressCount: (done: number, total: number) => `${done} / ${total}`,
    progressLabel: (percent: number) => `Test progress: ${percent}% complete`,
    audioSettings: 'Audio settings',
    loadingTest: 'Loading test',
    lapseMarker: 'Nearly: this question no longer counts as known',
    // The seal in the corner of the card. Decoration only, hidden from screen readers.
    seal: '学',
    playPronunciation: 'Play pronunciation',
    showPinyin: 'Show Pinyin',
    hidePinyin: 'Hide Pinyin',
    answerInput: 'Enter your answer',
    gradeFail: "I didn't know this",
    gradeLapse: 'I nearly knew this',
    gradePass: 'I knew this',
    showAnswer: 'Show Answer',
    drawArea: 'Handwriting input area — draw the character here',
    drawHere: 'Draw here',
    submit: 'Submit',
    recordSpeech: 'Record speech',
    iDontKnow: "I Don't Know",
    hint: 'Hint',
    showHint: 'Show Hint',
    hideHint: 'Hide Hint',
    loadingHint: 'Loading Hint',
    loadingHintLabel: 'Loading hint',
    showCharacter: 'Show Character',
    hideCharacter: 'Hide Character',
  },
} as const;
