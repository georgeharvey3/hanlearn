# 11. Gate the Write stage on partial mastery

- Status: accepted
- Date: 2026-09-02
- Issue: #333
- Related: #339 (the Read half of it is decided here), #278,
  [0002-direction-level-scheduling.md](0002-direction-level-scheduling.md)

## Context

The Write stage asks the learner to produce a Chinese sentence containing a
word. It fired for a word that was new, that is, one whose five directions were
all at bank 1. A word met one minute earlier was therefore the word the app
asked the learner to write with.

That is the case the research says is worst.

- Barcroft (2004, _Second Language Research_ 20(4):303-334) found a strong
  negative effect of sentence writing on word form learning, with time on task
  controlled.
- Barcroft (2006) found the same for copying a novel word, which is a weaker
  demand than composing with it.
- Wong and Pyun (2012) replicated the negative effect for French and Korean.

The reading of these results is that production competes with the encoding of
the word form. Output helps once the learner knows the form well enough for
retrieval to succeed, and before that it takes the attention that encoding the
form needs. Barcroft's own Input-Based Incremental model draws the practical
conclusion: present new words in meaning-bearing comprehensible input, and limit
forced output in the early stages.

Issue #339 proposed the opposite treatment for the Read stage, gating it on the
same milestone. The research does not support that. Reading a sentence is input,
which is what Barcroft recommends **in place of** early output, and no study
above argues against it. Contextual reading does pay off more once a form to
meaning link exists — Elgort and Warren (2014) and Pellicer-Sánchez (2016) both
found gains tied to prior partial knowledge, and Webb (2007) puts substantial
gains at around ten encounters — but "lower yield early" is not "harmful early".

## Decision

The Write stage fires on partial mastery. The Read stage keeps firing on
novelty, unchanged.

A word reaches the Write stage when all four recall directions — `MC`, `MP`,
`PC` and `PM` — are at bank 3 or higher. Bank 3 is an interval of 7 to 29 days,
so the word has survived a week or more in each direction that asks for recall.
`CM` is left out because handwriting is itself production, and production is the
thing the gate holds back.

`readyForWriteStage` in `utils/directions.ts` holds the predicate, and
`WRITE_STAGE_BANK` holds the threshold. The research names no threshold, so this
one is a starting point to tune.

Three consequences follow from the decision:

- The two sentence stages take **separate word lists**. `onFinishTest` builds a
  Read list and a Write list, and a clean run is still required for either. The
  lists are disjoint unless the learner turned the Read stage on for all words.
- The **"sentence stages for all words" setting widens the Read stage only**.
  The reason for the Write gate is that early output impedes learning, not that
  the stage is slow, so a setting cannot opt back into it. The setting is
  relabelled "Translate sentences for all words". Practice mode is the same: it
  ignores due dates, not the research.
- The gate reads the state the word held when the **session started**, so a word
  that reaches bank 3 on this run writes its first sentence on the next one.

The `/tryout` demo is the one exception: it is a tour of the stages rather than
a study session, so its single word reaches both.

The Write task keeps **no time limit**. `SentenceWrite` has no timer and no auto
advance, which is already what the research asks for: the negative output effect
is worst under time pressure.

## Consequences

Good:

- The app no longer asks for output at the one stage the research says output
  hurts.
- A word that reaches the Write stage keeps reaching it on later reviews, so
  output practice recurs instead of happening once, on the day the word was
  least known.
- The Read stage still supplies input for a new word, which is what Barcroft
  recommends in place of early output.

Bad:

- A new learner sees no Write stage at all for the first week or more of a
  word's life. This is the point of the change, and it does make an empty-ish
  session stage for a new collection.
- The threshold is a guess. Four directions at bank 3 is defensible and not
  established, and the value needs tuning against real use.
- The Settings estimate has no word list, so it guesses how many words of a
  session have reached the gate. `ASSUMED_WRITE_WORD_SHARE` holds that guess.
  The Dashboard estimate counts the real ones from the plan.
