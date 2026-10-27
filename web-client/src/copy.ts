// Every string the app shows a user, grouped by screen. A component reads
// `copy.test.showAnswer`, never a literal. A string with a run-time value is a
// function. Screens move in here as they are restyled; `copy.test.ts` lists
// the files that must read from it.
export const copy = {
  shell: {
    brand: 'HanLearn',
    homeLink: 'HanLearn home',
    mainNav: 'Main',
    skipLink: 'Skip to main content',
    home: 'Home',
    add: 'Add',
    addWords: 'Add words',
    study: 'Study',
    studyDue: (due: number) => `Study, ${due} due`,
    settings: 'Settings',
    more: 'More',
    shortcuts: 'Shortcuts',
    logout: 'Log out',
    login: 'Log in',
    signUp: 'Sign up',
    collapse: 'Collapse',
    expand: 'Expand',
    // The loading mark, and the stamp of the error screen.
    loading: 'Loading',
    loadingMark: '学',
    errorStamp: '错',
    errorTitle: 'Something went wrong',
    errorBody: "This page didn't load.",
    tryAgain: 'Try again',
    dismiss: 'Dismiss',
    close: 'Close',
    shortcutsTitle: 'Keyboard shortcuts',
  },
  study: {
    endSession: 'End session',
    settings: 'Test settings',
    progressCount: (done: number, total: number) => `${done} / ${total}`,
    progressLabel: (percent: number) => `Progress: ${percent}% complete`,
    loading: 'Loading',
    // The labels of the session's stages, on the bar at the top.
    stageTest: 'Test',
    stageRead: 'Listen & translate',
    stageWrite: 'Write in Chinese',
  },
  sentence: {
    // "Translate the sentence with 电脑"
    readPrompt: 'Translate the sentence with ',
    playSentence: 'Play sentence',
    slowMode: 'Slow speech',
    slowLabel: '0.7×',
    showText: 'Show text',
    hideText: 'Hide text',
    wordMeaning: (word: string) => `${word}: show meaning`,
    englishTranslation: 'English translation',
    translationPlaceholder: 'Type your translation…',
    yourTranslation: 'Your translation',
    correctTranslation: 'Correct translation',
    noDefinition: 'No definition found',
    close: 'Close',
    addToList: 'Add to list',
    added: 'Added',
    nextWord: 'Next word',
    nextStage: 'Next stage',
    finish: 'Finish',
    loadFailed: "Couldn't load a sentence for this word.",
    skipWord: 'Skip word',
    skipAndFinish: 'Skip and finish',
    noTranslation: 'No translation found',
    tryAgain: 'Try again',
    mustUse: 'Must use',
    yourAnswer: 'Your answer',
    writePlaceholder: '用中文写',
    original: 'Original',
    englishWord: (word: string) => `${word}: show Chinese`,
    // The similarity of a translation to the answer.
    similarity: 'Similarity',
    scoring: 'Scoring…',
    scoreUnavailable: 'Score unavailable',
    scoreLabel: (score: number) =>
      score >= 90
        ? 'Match'
        : score >= 70
          ? 'Close match'
          : score >= 40
            ? 'Partly right'
            : 'Keep trying',
  },
  settings: {
    title: 'Settings',
    // The groups
    session: 'Study session',
    answers: 'Answers',
    focus: 'Skill focus',
    stages: 'Session stages',
    sound: 'Sound',
    account: 'Account',
    // Session
    questionsPerSession: 'Questions per session',
    // formatTestTime gives "~12 min".
    about: (time: string) => time.replace('~', 'About '),
    fewer: 'Fewer questions',
    more: 'More questions',
    characters: 'Characters',
    simp: 'Simplified',
    trad: 'Traditional',
    // Answers
    meaning: 'Meaning',
    pinyin: 'Pinyin',
    input: 'Input',
    flashcard: 'Flashcard',
    useHandwriting: 'Handwriting',
    useAutoRecord: 'Auto-start microphone',
    // Focus: the directions, by the skill each one trains
    noFocus: 'Balanced',
    MP: 'Listening',
    PM: 'Speaking',
    MC: 'Reading',
    CM: 'Writing',
    onlyPriority: 'Only this skill',
    // Stages
    newWords: 'New words',
    test: 'Test',
    sentenceRead: 'Translate sentences',
    sentenceStagesForAllWords: 'Translate with all words',
    sentenceWrite: 'Make sentences',
    // Sound
    useSound: 'Text-to-speech',
    useSoundEffects: 'Sound effects',
    // Account
    signedInAs: 'Signed in as',
    notSignedIn: 'Not signed in',
    logout: 'Log out',
    login: 'Log in',
    // Why a control is off
    unsupported: 'Not supported in this browser',
    needsInput: 'Set Meaning or Pinyin to Input first',
    needsRead: 'Turn on Translate sentences first',
    // The one-line values of a closed group
    sessionSummary: (questions: number, time: string, charSet: string) =>
      `${questions} questions · ${time} · ${charSet}`,
    answersSummary: (meaning: string, pinyin: string) => `Meaning: ${meaning} · Pinyin: ${pinyin}`,
    onlySummary: (skill: string) => `${skill} only`,
    // Between two stages in the closed header, for a screen reader. An arrow shows it on screen.
    stageSeparator: ', ',
    soundSummary: (sounds: string[]) => sounds.join(' · ') || 'Off',
  },
  test: {
    // "What is the meaning for", with the answer's category between the two.
    promptBefore: 'What is the ',
    promptFor: ' for',
    // A spoken question asks for the meaning *of* what the learner hears.
    promptOf: ' of',
    lapseMarker: 'Nearly: this question no longer counts as known',
    // The seal in the corner of the card. Decoration only, hidden from screen readers.
    seal: '学',
    playPronunciation: 'Play pronunciation',
    loadingAudio: 'Loading audio',
    showPinyin: 'Show pinyin',
    hidePinyin: 'Hide pinyin',
    showCharacter: 'Show character',
    hideCharacter: 'Hide character',
    answerInput: 'Your answer',
    placeholderMeaning: 'Type the meaning',
    placeholderPinyin: 'Pinyin with tone numbers',
    recordSpeech: 'Record speech',
    stopRecording: 'Stop recording',
    check: 'Check',
    continue: 'Continue',
    showAnswer: 'Show answer',
    didYouKnow: 'Did you know it?',
    gradeFail: 'No',
    gradeLapse: 'Nearly',
    gradePass: 'Yes',
    iDontKnow: "I don't know",
    hint: 'Hint',
    showHint: 'Show hint',
    hideHint: 'Hide hint',
    loadingHint: 'Loading hint',
    hintLabel: (hint: string) => `Hint: ${hint}`,
    moreSenses: (count: number) => `+ ${count} more ${count === 1 ? 'sense' : 'senses'}`,
    exampleSentence: 'Example sentence',
    playSentence: 'Play sentence',
    youTyped: 'You typed',
    drawArea: 'Handwriting area: draw the character here',
    characterProgress: (index: number, total: number) => `Character ${index} of ${total}`,
    characters: 'Characters',
    showComponents: 'Show components',
    hideComponents: 'Hide components',
    definitionLoading: (char: string) => `Loading the definition of ${char}`,
    definitionFailed: 'Definition unavailable',
    notInDictionary: 'Not in the dictionary',
    componentsLoading: (char: string) => `Loading the components of ${char}`,
    componentsFailed: "Couldn't load components",
    noComponents: 'No components',
    retry: 'Retry',
    // The line under the card. Each says what happened, in a word or two.
    status: {
      correct: 'Correct',
      nearly: 'Nearly',
      tryAgain: 'Try again',
      tones: 'Incorrect tones',
      notKnown: 'Not known',
      listening: 'Listening…',
      heardNothing: "Couldn't hear anything",
      noSentence: 'No example sentence found',
      hintFailed: "Couldn't load hint",
      audioFailed: "Couldn't play audio",
      finished: 'Finished!',
    },
  },
  // The introduction of new words, before the test. Each word goes through
  // three steps, and none of them records a result.
  newWords: {
    stage: 'New words',
    steps: 'Steps',
    stepUnderstand: 'Understand',
    stepSpeak: 'Speak',
    stepWrite: 'Write',
    characters: 'Characters',
    parts: 'Parts',
    partsLoading: 'Loading parts',
    partsFailed: 'Parts didn’t load',
    noParts: 'No parts',
    tryAgain: 'Try again',
    speakPrompt: 'Say the word',
    heard: 'Heard',
    listening: 'Listening…',
    wellSaid: 'Well said',
    checkTones: 'Check the tones',
    notQuite: 'Not quite. Try again.',
    heardNothing: 'Heard nothing. Try again.',
    noSpeech: 'Speech input is not available',
    writePrompt: 'Trace the word: ',
    traceHere: (char: string) => `Trace ${char} here`,
    traced: 'Traced',
    skip: 'Skip',
    skipToTest: 'Skip to test',
    continue: 'Continue',
    nextWord: 'Next word',
    startTest: 'Start test',
  },
  // The end of a session: the score, and a tile for each question.
  summary: {
    stage: 'Done',
    outOf: (total: number) => `/ ${total}`,
    questionsWords: (questions: number, words: number) =>
      `${questions} question${questions === 1 ? '' : 's'} · ${words} word${words === 1 ? '' : 's'}`,
    practiceNote: 'Practice · due dates unchanged',
    results: { pass: 'Known', lapse: 'Nearly', fail: 'Not known' },
    count: (n: number, result: string) => `${n} ${result}`,
    tile: (char: string, result: string) => `${char}, ${result}`,
    turnedTile: (char: string, result: string, pinyin: string, meaning: string) =>
      `${char}, ${result}: ${pinyin}, ${meaning}`,
    practiceMissed: 'Practise missed words',
    backToDashboard: 'Back to Dashboard',
  },
  // The Test page when no word is due. Counts only, never a due word.
  nothingDue: {
    // A seal of 休, "rest". Decoration only, hidden from screen readers.
    seal: '休',
    title: (list: string) => `Nothing due in ${list}`,
    allLists: 'All lists',
    noWords: 'No words yet',
    nextDue: (n: number, days: number) =>
      days === 0
        ? `${n} due later today`
        : days === 1
          ? `${n} due tomorrow`
          : `${n} due in ${days} days`,
    nothingThisWeek: 'Nothing due this week',
    otherLists: 'Other lists',
    due: (n: number) => `${n} due`,
    testAll: (n: number) => `Test all lists · ${n}`,
    practice: 'Practise',
    addWords: 'Add words',
  },
  // The word bank on /add-words: one search field, the list chips and the
  // words. A word due soon shows grey blocks until the learner taps it.
  wordBank: {
    search: 'Search a Chinese word',
    clear: 'Clear',
    searching: 'Searching…',
    searchFailed: 'Search failed',
    retry: 'Retry',
    add: 'Add',
    addEntry: (char: string, pinyin: string) => `Add ${char}, ${pinyin}`,
    added: 'Added',
    toastAdded: (char: string) => `Added ${char}`,
    inBank: 'In your bank',
    noMatch: 'No match',
    // "No entry for 囧"
    noEntry: 'No entry for ',
    addOwn: 'Add as your own word',
    meaning: 'Meaning',
    lists: 'Lists',
    allLists: 'All lists',
    newList: 'New list',
    listName: 'List name',
    listActions: 'List actions',
    create: 'Create',
    rename: 'Rename',
    renameTitle: (name: string) => `Rename ${name}`,
    save: 'Save',
    delete: 'Delete',
    cancel: 'Cancel',
    deleteTitle: (name: string) => `Delete ${name}?`,
    // The words of the list that no other list holds.
    deleteBody: (n: number) => `Deletes ${n} word${n === 1 ? '' : 's'}.`,
    heading: (list: string, n: number) => `${list} · ${n} word${n === 1 ? '' : 's'}`,
    study: 'Study',
    studyDue: (n: number) => `Study · ${n} due`,
    dueSoon: 'Due soon',
    showWord: 'Due soon. Show the word',
    leech: 'Hard to recall',
    leechDirections: (directions: string) => `Hard to recall: ${directions}`,
    play: 'Play',
    levelDue: (level: string, due: string) => (due ? `${level} · ${due}` : level),
    editLists: 'Edit lists',
    listsOf: (char: string) => `Lists for ${char}`,
    toastListsSaved: 'Lists saved',
    toastDeleted: 'Word deleted',
    toastRemovedFrom: (list: string) => `Removed from ${list}`,
    listsFailed: 'Failed to save lists',
    remove: 'Remove',
    removeFrom: (list: string) => `Remove from ${list}`,
    deleteWord: (char: string) => `Delete ${char}?`,
    deleteWordBody: 'Its progress is deleted too.',
    loading: 'Loading',
    loadFailed: 'Your words didn’t load',
    noWords: 'No words yet',
    emptyList: 'This list is empty',
    // The mark of the empty bank. Decoration only, hidden from screen readers.
    emptyMark: '字',
    errorStamp: '错',
    // Words to try on an empty bank. A tap searches for one.
    suggestions: ['你好', '朋友', '学习'],
  },
  // The Premade lists tab of the Add words page: the catalogue, and one list of
  // it. The names of the lists are data, in the catalogue.
  premadeLists: {
    // The two tabs of the Add words page.
    tabs: 'Add words',
    mine: 'My words',
    heading: 'Premade lists',
    browse: 'Browse premade lists',
    // A list in the catalogue. The new words are the words the learner does not have.
    size: (n: number, held: number) =>
      held === 0
        ? `${n.toLocaleString('en-GB')} words`
        : `${n.toLocaleString('en-GB')} words · ${(n - held).toLocaleString('en-GB')} new`,
    // Under the count of new words of one list.
    newWords: (held: number) =>
      held === 0 ? 'new words' : `new words · ${held.toLocaleString('en-GB')} added`,
    filterAll: 'All',
    filterNew: (n: number) => `New ${n.toLocaleString('en-GB')}`,
    filterAdded: (n: number) => `Added ${n.toLocaleString('en-GB')}`,
    // The label of the words of a list, for screen readers.
    words: 'Words',
    allLists: 'All lists',
    add: 'Add list',
    adding: 'Adding…',
    loadFailed: 'Couldn’t load lists',
    toastAdded: (name: string) => `Added ${name}`,
    toastFailed: 'Failed to add list',
  },
  // The list control of the signed-out home page.
  listSelector: {
    activeList: 'Active list',
    allLists: 'All Lists',
    due: (n: number) => `${n} due`,
    createLabel: 'Create new list',
    renameLabel: 'Rename list',
    deleteLabel: 'Delete list',
    renameTitle: 'Rename List',
    rename: 'Rename',
    createTitle: 'New list',
    listName: 'List name',
    create: 'Create',
    deleteTitle: 'Delete List',
    deleteBody: (name: string) => `Delete “${name}”? Words only in this list are deleted.`,
    cancel: 'Cancel',
    delete: 'Delete',
  },
  // The first screen after sign-in. It shows counts only: a word seen here just
  // before the test asks it primes the answer.
  dashboard: {
    title: 'Dashboard',
    // A number not known yet.
    none: '—',
    // Dates, from a YYYY-MM-DD key: "Friday 23 October", "23 October", "23 Oct".
    weekdayDate: (key: string) =>
      new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    longDate: (key: string) =>
      new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
    shortDate: (key: string) =>
      new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    today: 'Today',
    allLists: 'All lists',
    chooseList: (name: string) => `List: ${name}`,
    size: 'Size',
    sizes: { quick: 'Quick', usual: 'Usual', all: 'Everything' },
    questions: (n: number) => `${n} question${n === 1 ? '' : 's'}`,
    study: 'Study',
    includesNew: (n: number) => `Includes ${n} new word${n === 1 ? '' : 's'}`,
    nothingDue: 'Nothing due today',
    addWords: 'Add words',
    unfinished: (left: string) => `Unfinished · ${left}`,
    resume: 'Resume',
    startOver: 'Start over',
    couldNotLoad: "Couldn't load",
    tryAgain: 'Try again',
    sections: {
      calendar: 'Calendar',
      progress: 'Progress',
      chengyu: 'Chengyu',
      skills: 'Five skills',
    },
    calendar: {
      previous: 'Previous month',
      next: 'Next month',
      // "2026年 十月"
      month: (year: number, month: number) =>
        `${year}年 ${['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][month]}月`,
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      today: 'Today',
      dayAria: (date: string, line: string) => `${date}, ${line}`,
      reviewed: (n: number) => `${n} reviewed`,
      due: (n: number) => `${n} due`,
      reviewedAndDue: (reviewed: number, due: number) => `${reviewed} reviewed · ${due} due`,
      reviewedAndUp: (reviewed: number, up: number) => `${reviewed} reviewed · ${up} moved up`,
      noStudy: 'No study',
      monthReviews: 'reviews this month',
      monthPromoted: 'moved up a level',
    },
    progress: {
      chart: (counts: { level: string; n: number }[]) =>
        `Words by level: ${counts.map((c) => `${c.level} ${c.n}`).join(', ')}`,
      weeks: 'Weeks',
      weekAria: (date: string, counts: { level: string; n: number }[]) =>
        `${date}: ${counts.map((c) => `${c.n} ${c.level}`).join(', ')}`,
      today: 'Today',
      change: (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`,
      pastMonth: 'Past month',
      noWords: 'No words yet',
      noHistory: 'No history yet',
    },
    chengyu: {
      label: '今日成语',
      question: 'What does it mean?',
      showPinyin: 'Show pinyin',
      hidePinyin: 'Hide pinyin',
      correct: 'Correct',
      itMeans: 'It means',
      addToWords: 'Add to my words',
      added: 'Added',
      noSentence: 'No example sentence',
    },
    skills: {
      // The skill each direction trains, by its answer-first code.
      names: { MC: 'Reading', MP: 'Listening', PM: 'Speaking', PC: 'Pronouncing', CM: 'Writing' },
      strong: 'Familiar or better',
      recall: 'Recalled, 30 days',
      noWords: 'No words yet',
      percent: (n: number | null) => (n === null ? '—' : `${n}%`),
      chart: (shares: { name: string; percent: number | null }[]) =>
        `Familiar or better: ${shares.map((s) => `${s.name} ${s.percent ?? '—'}%`).join(', ')}`,
      corner: (name: string, label: string) => `${name}, ${label}`,
    },
  },
  // The page a visitor sees before an account exists.
  landing: {
    startLearning: 'Start learning',
    trySession: 'Try a session',
    headline: 'Stop forgetting the Chinese you learn.',
    sub: 'Add the words you meet. HanLearn brings each one back before it fades.',
    facts: [
      { value: '124,000', label: 'words in the dictionary' },
      { value: '5 ways', label: 'to test each word' },
      { value: 'Smart', label: 'review scheduling' },
      { value: 'Free', label: 'with no ads' },
    ],
    // The phone in the hero, which plays a short session.
    phone: {
      takeOver: 'Tap to take over',
      draw: 'Write the character',
      again: 'Start over',
      done: (n: number) => `${n} words reviewed`,
      next: (due: string) => `Next review in ${due}`,
      // "Give the meaning for", by the kind of card.
      category: { flash: 'meaning', type: 'pinyin', write: 'character' },
    },
    fiveWays: {
      headline: 'One word, from every angle.',
      sub: 'Characters, sound and meaning, tested in every direction.',
      steps: [
        'Understand the characters',
        'Recognise the sound',
        'Speak the word',
        'Read it aloud',
        'Write it by hand',
      ],
      faces: { char: 'Characters', pinyin: 'Sound', meaning: 'Meaning' },
    },
    features: [
      {
        glyph: '查',
        title: 'Look up any word',
        body: 'Search in hanzi, pinyin or English and add a word to your list.',
      },
      {
        glyph: '拆',
        title: 'Character breakdown',
        body: 'See the parts that build each character.',
      },
      {
        glyph: '句',
        title: 'Sentences',
        body: 'Read and write sentences with the words you know.',
      },
      {
        glyph: '成',
        title: 'Chengyu of the day',
        body: 'A new four-character idiom every day.',
      },
    ],
    // The Analects' opening line: learn, and review in time.
    proverb: '学而时习之',
    proverbGloss: 'Learn, and review it often.',
  },
} as const;
