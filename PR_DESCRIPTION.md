## Summary

Adds a "This Week" summary widget to the Dashboard showing the number of practice sessions and total words reviewed in the last 7 days. This closes the gap between the existing streak counter (which rewards consistency) and understanding weekly study volume.

Resolves #135.

## Key Implementation Details

- **No new Firestore queries**: `computeWeeklyStats()` is a pure function that reuses the `streakData` already fetched by `getDashboardStats()`. It filters the descending-sorted `testCompletions` entries to the last 7 days and sums `testsCount` values. Zero additional network requests.
- **`WeeklyStatsCard` widget**: A new memoized card component matching the visual style of existing dashboard cards (Paper, elevation, MUI Typography). Shows two stats side-by-side: session count and words reviewed, with a "Last 7 days" subtitle. Degrades gracefully for new users (shows 0/0).
- **Singular/plural**: The card shows "session" vs "sessions" based on count.

## Files Modified

- **`web-client/src/services/streakService.ts`** — Added `WeeklyStats` interface and `computeWeeklyStats()` pure function
- **`web-client/src/services/streakService.test.ts`** — Added 4 tests for `computeWeeklyStats` covering empty data, date boundary, and filtering
- **`web-client/src/services/dashboardService.ts`** — Added `weeklyStats` to `DashboardStats` interface; computed from existing streak data
- **`web-client/src/containers/Dashboard/widgets/WeeklyStatsCard.tsx`** — New widget component
- **`web-client/src/containers/Dashboard/Dashboard.tsx`** — Wired `WeeklyStatsCard` into the dashboard grid
- **`web-client/src/containers/Dashboard/Dashboard.test.tsx`** — Added 2 tests for the weekly stats card; updated `sampleStats` fixture

## Test Plan

- [x] All 917 existing tests pass
- [x] New `computeWeeklyStats` unit tests cover edge cases (empty data, boundary dates, today inclusion)
- [x] Dashboard integration tests verify the card renders with correct data and singular/plural labels

🤖 Generated with [Claude Code](https://claude.com/claude-code)
