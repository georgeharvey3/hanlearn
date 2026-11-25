import { Word, WordScore } from '../types/models';

/**
 * The finished session that the summary shows, held while the learner looks at
 * one of its words on the word page. The summary lives only in the state of
 * the Test page, and that state goes when the route changes, so the Back of the
 * word page needs this to show the summary again.
 *
 * It is held in memory only. After a reload, Back finds nothing and the Test
 * page starts as normal: the session is already saved, so nothing is lost.
 */
export interface HeldSummary {
  scores: WordScore[];
  words: Word[];
  practiceMode: boolean;
}

/** The router state of a Test page entry that shows the held summary again. */
export interface SummaryReturnState {
  summary: true;
}

let held: HeldSummary | null = null;

export const holdSummary = (summary: HeldSummary): void => {
  held = summary;
};

/** The held summary, if the entry asks for it. It stays held for the next visit. */
export const heldSummaryFor = (state: unknown): HeldSummary | null =>
  (state as Partial<SummaryReturnState> | null | undefined)?.summary === true ? held : null;
