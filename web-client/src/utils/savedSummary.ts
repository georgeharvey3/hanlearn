import { Word, WordScore } from '../types/models';

/**
 * The finished session's summary, held in sessionStorage while the learner
 * looks at one of its words on the word page. The summary lives only in the
 * state of the Study screen, so leaving for the word page would lose it; Back
 * from the word page reads it again from here.
 *
 * It holds word ids, like the saved session: the words come from Redux on the
 * way back. The session already wrote its grades, so this record is only for
 * the screen, and a lost record costs nothing but the screen.
 */

export const SAVED_SUMMARY_KEY = 'savedSummary';

export interface SavedSummary {
  userId: string;
  listId: string;
  practiceMode: boolean;
  wordIds: number[];
  scores: WordScore[];
}

export interface RestoredSummary {
  practiceMode: boolean;
  words: Word[];
  scores: WordScore[];
}

export function saveSummary(summary: SavedSummary): void {
  try {
    sessionStorage.setItem(SAVED_SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    // Storage full or blocked: Back then starts the Study screen afresh.
  }
}

/** The summary of this learner and list, or null when there is none. */
export function loadSummary(userId: string, listId: string): SavedSummary | null {
  try {
    const raw = sessionStorage.getItem(SAVED_SUMMARY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSummary;
    if (saved.userId !== userId || saved.listId !== listId) return null;
    if (!Array.isArray(saved.wordIds) || !Array.isArray(saved.scores)) return null;
    return saved;
  } catch {
    return null;
  }
}

/**
 * The summary with its words. A word deleted since is left out, with its
 * scores; a summary with no word left is null.
 */
export function restoreSummary(saved: SavedSummary, words: Word[]): RestoredSummary | null {
  const byId = new Map(words.map((word) => [word.id, word]));
  const resolved = saved.wordIds
    .map((id) => byId.get(id))
    .filter((word): word is Word => word !== undefined);
  if (resolved.length === 0) return null;
  const chars = new Set(resolved.flatMap((word) => [word.simp, word.trad]));
  const scores = saved.scores.filter((score) => chars.has(score.char));
  if (scores.length === 0) return null;
  return { practiceMode: saved.practiceMode, words: resolved, scores };
}
