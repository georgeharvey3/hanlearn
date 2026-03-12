## Summary

Adds a pronunciation playback (VolumeUp) button to the word bank so learners can hear any word spoken on demand — no study session required. This surfaces the existing `ttsService` (Cloud TTS with LRU cache + native SpeechSynthesis fallback) directly in the word bank views.

- **Mobile card view** (`WordCard.tsx`): VolumeUp icon button placed beside the pinyin text
- **Desktop table view** (`AddWords.tsx`): New "Play" column with a dedicated `PlayPronunciation` component in each row
- Visual feedback: button color changes to `primary.main` while audio is playing

## Key implementation details

- Reuses `ttsService.speak()` — no new service functions or API calls needed
- Respects the active `charSet` (simplified/traditional) setting so the correct characters are spoken
- `PlayPronunciation` extracted as a small component to allow `useState` for playing state inside table row `useMemo`
- `WordCard` uses inline state since it's already a per-word component

## Decisions and trade-offs

- **No `stop()` on unmount**: The TTS handle's `stop()` is not called on unmount because playback is short-lived and the existing `ttsService` already cancels previous audio when a new `speak()` is called
- **No Redux state**: Playing state is local (`useState`) per the issue recommendation — no added complexity
- **Separate component for desktop**: The desktop table rows are built inside `useMemo`, so a separate `PlayPronunciation` component was needed to use React hooks for the playing state

## Files modified

- `web-client/src/components/AddWords/WordCard.tsx` — Added VolumeUp button beside pinyin in mobile card
- `web-client/src/components/AddWords/PlayPronunciation.tsx` — New component for pronunciation button (used in desktop table)
- `web-client/src/containers/AddWords/AddWords.tsx` — Added PlayPronunciation in desktop table rows + "Play" column heading
- `web-client/src/containers/AddWords/AddWords.test.tsx` — Added ttsService mock and test for pronunciation button click

## Test plan

- [x] All 739 existing tests pass (45 files)
- [x] New test verifies `ttsService.speak` is called with correct character text and callbacks
- [ ] Manual: Click play button on mobile card view, verify audio plays
- [ ] Manual: Click play button on desktop table view, verify audio plays
- [ ] Manual: Switch charSet to traditional, verify traditional characters are spoken
