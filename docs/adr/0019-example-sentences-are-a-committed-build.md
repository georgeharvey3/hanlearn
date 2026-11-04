# 19. Example sentences are a committed build, not runtime AI

- Status: amended by [0020](0020-every-example-sentence-is-generated.md)
- Date: 2026-11-01
- Issue: #465

## Context

The app generated example sentences with Gemini in the browser and cached them in Firestore. Each new word cost an AI call. The browser call exposed the quota (#387). The quality and the difficulty of a sentence were not controlled, and a sentence needed the network.

## Decision

The example sentences are a build output. Committed copies of Tatoeba and Wiktionary are the input. The build has no network and no AI, so the same inputs always give the same files. The files are static on Hosting.

Claude Code writes sentences only for the HSK words that the real sources do not fill. A developer starts this session. The grader of the build admits each generated sentence.

The id of a sentence is a hash of its text. Thus the data of #386 stays attached when a better source supplies the same sentence.

## Consequences

- Words outside HSK get only the real sentences that match them. Some get none.
- A new source or a rule change needs a pull request and a new build, not a cache flush.
- A corrected source text gets a new id, and the #386 data for the old text drops away.

## Alternatives

- Runtime generation with a Firestore cache (the old design). It covers any word, but it has the problems in Context.
- Generation on each deploy. The output changes from one deploy to the next, and each deploy costs money.
