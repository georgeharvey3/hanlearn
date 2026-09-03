import { DirectionGrade, QueuePair, Word, WordScore } from '../types/models';
import { dayKey } from './retention';

/**
 * The unfinished session held in localStorage, so that a learner who closes the
 * page halfway through can pick it up where they left off.
 *
 * Nothing reaches Firestore until a session finishes: the grades sit in the
 * engine's `gradeList` and only `finishTest` writes them. A session that is
 * abandoned therefore loses every answer it collected, and the learner repeats
 * them. This record is what survives that, and it is local because a session is
 * a thing one device is in the middle of, not a thing an account owns.
 *
 * The record holds word ids rather than words. The words come from Redux on
 * restore, so a meaning the learner amended between the two visits is the one
 * they see, and a session can never resurrect a word that has since been
 * deleted. See issue #305.
 */

export const SAVED_SESSION_KEY = 'savedSession';

/** Bumped whenever the shape below changes; an older record is discarded. */
export const SAVED_SESSION_VERSION = 1;

/** The stages a session can be resumed at. `summary` has nothing left to do. */
export type SavedStage = 'new' | 'vocab' | 'read' | 'write';

export interface SeenOffset {
  offset: number;
  text: string;
  english: string;
}

/** The vocab stage's progress: what is left to ask, and what it has graded. */
export interface VocabProgress {
  queue: QueuePair[];
  gradeList: DirectionGrade[];
  /** The queue length the session started with, so the bar reads the same. */
  initialQueueLength: number;
}

export interface SavedSession extends VocabProgress {
  version: number;
  /** Whose session it is: a shared device must not offer someone else's. */
  userId: string;
  listId: string;
  /** The day the session was planned on. A session does not outlive its day. */
  date: string;
  savedAt: string;
  stage: SavedStage;
  practiceMode: boolean;
  /** The plan's words, in plan order: a queue entry's index points into this. */
  wordIds: number[];
  newWordIds: number[];
  sentenceReadWordIds: number[];
  sentenceWriteWordIds: number[];
  seenOffsets: Record<string, SeenOffset>;
  /** The grades so far as the summary reads them. */
  scoreList: WordScore[];
}

/** A saved session with its words put back, ready to hand to the components. */
export interface RestoredSession {
  stage: SavedStage;
  practiceMode: boolean;
  words: Word[];
  newWords: Word[];
  sentenceReadWords: Word[];
  sentenceWriteWords: Word[];
  seenOffsets: Record<string, SeenOffset>;
  scoreList: WordScore[];
  progress: VocabProgress;
}

const isStage = (value: unknown): value is SavedStage =>
  value === 'new' || value === 'vocab' || value === 'read' || value === 'write';

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

/**
 * Whether a parsed value is a session this build can read.
 *
 * The record is user-editable storage, so every field is checked rather than
 * trusted: a malformed one restores a session whose queue indexes into words
 * that are not there, which fails inside the engine rather than here.
 */
function isSavedSession(value: unknown): value is SavedSession {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === SAVED_SESSION_VERSION &&
    typeof record.userId === 'string' &&
    typeof record.listId === 'string' &&
    typeof record.date === 'string' &&
    typeof record.savedAt === 'string' &&
    isStage(record.stage) &&
    typeof record.practiceMode === 'boolean' &&
    typeof record.initialQueueLength === 'number' &&
    isNumberArray(record.wordIds) &&
    isNumberArray(record.newWordIds) &&
    isNumberArray(record.sentenceReadWordIds) &&
    isNumberArray(record.sentenceWriteWordIds) &&
    Array.isArray(record.queue) &&
    Array.isArray(record.gradeList) &&
    Array.isArray(record.scoreList) &&
    typeof record.seenOffsets === 'object' &&
    record.seenOffsets !== null
  );
}

export function clearSavedSession(): void {
  try {
    localStorage.removeItem(SAVED_SESSION_KEY);
  } catch {
    // Storage can be unavailable (private browsing, a full quota). A session
    // that cannot be saved is the behaviour that existed before this record.
  }
}

export function saveSession(session: SavedSession): void {
  try {
    localStorage.setItem(SAVED_SESSION_KEY, JSON.stringify(session));
  } catch {
    // As above: losing the record costs the resume, not the session.
  }
}

/** The stored record, or null when there is none this build can read. */
export function readSavedSession(): SavedSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVED_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isSavedSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The saved session to offer, or null.
 *
 * A session belongs to one learner, one list and one day. The day matters most:
 * the plan is seeded from the date and the due dates move at midnight, so
 * yesterday's queue is not a session today would have planned. A vocab stage
 * with an empty queue is finished rather than unfinished, and is not offered.
 *
 * A record that fails any of these is deleted, not merely ignored, so that it
 * cannot be offered by a later visit that happens to match it.
 */
export function loadResumableSession(
  userId: string,
  listId: string,
  now: Date = new Date(),
): SavedSession | null {
  const saved = readSavedSession();
  if (!saved) {
    clearSavedSession();
    return null;
  }

  if (saved.userId !== userId || saved.date !== dayKey(now)) {
    clearSavedSession();
    return null;
  }

  // Another list's session is not this one's to delete. It is left where it is,
  // and the day check above collects it in the end.
  if (saved.listId !== listId) return null;

  if (saved.stage === 'vocab' && saved.queue.length === 0) {
    clearSavedSession();
    return null;
  }

  return saved;
}

/**
 * Put the words back into a saved session.
 *
 * Every id has to resolve. The queue holds positions in `wordIds`, so dropping
 * a word that has since been deleted would shift every question after it onto
 * the wrong word; the whole session goes instead.
 */
export function restoreSession(saved: SavedSession, words: Word[]): RestoredSession | null {
  const byId = new Map(words.map((word) => [word.id, word]));

  const resolve = (ids: number[]): Word[] | null => {
    const resolved: Word[] = [];
    for (const id of ids) {
      const word = byId.get(id);
      if (!word) return null;
      resolved.push(word);
    }
    return resolved;
  };

  const planWords = resolve(saved.wordIds);
  const newWords = resolve(saved.newWordIds);
  const readWords = resolve(saved.sentenceReadWordIds);
  const writeWords = resolve(saved.sentenceWriteWordIds);

  if (!planWords || !newWords || !readWords || !writeWords) return null;
  if (planWords.length === 0) return null;

  // A queue entry that points outside the plan cannot be asked at all.
  const inRange = saved.queue.every((pair) => {
    const index = parseInt(pair.index, 10);
    return Number.isInteger(index) && index >= 0 && index < planWords.length;
  });
  if (!inRange) return null;

  return {
    stage: saved.stage,
    practiceMode: saved.practiceMode,
    words: planWords,
    newWords,
    sentenceReadWords: readWords,
    sentenceWriteWords: writeWords,
    seenOffsets: saved.seenOffsets,
    scoreList: saved.scoreList,
    progress: {
      queue: saved.queue,
      gradeList: saved.gradeList,
      initialQueueLength: saved.initialQueueLength,
    },
  };
}

/** How far through a resumable session the learner is, for the offer to say. */
export function describeSavedSession(saved: SavedSession): string {
  if (saved.stage === 'new') return 'Learning new words';
  if (saved.stage === 'vocab') {
    const left = saved.queue.length;
    return `${left} question${left === 1 ? '' : 's'} left`;
  }
  return 'Sentences';
}
