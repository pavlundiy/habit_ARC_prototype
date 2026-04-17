# Analytics module

This folder contains a framework-agnostic analytics package for the habit app.

Files:

- `types.ts`: shared TypeScript contracts for events, diary entries, snapshots, and the insights view model.
- `scoring.ts`: formulas, aggregation, subscore calculation, final dependency index, and a frontend-ready insights mapper.
- `mockData.ts`: a realistic mock habit, profile, events, diary entries, and precomputed snapshots for `7d`, `30d`, and `90d`.
- `advice-library.ts`: typed advice catalog architecture with metadata for habit fit, triggers, confidence, and review status.
- `advice-library.js`: browser-ready runtime matcher that can be plugged into the current HTML demo without a build step.
- `payload-examples.json`: example API-shaped JSON for frontend integration.

Suggested integration flow:

1. Save raw events from the app UI into storage.
2. Run `buildAnalyticsSnapshot(...)` whenever the user opens Insights or in a background job.
3. Convert the snapshot to UI data with `buildInsightViewModel(...)`.
4. Render the screen from the view model only.

Minimal usage:

```ts
import { buildAnalyticsSnapshot, buildInsightViewModel } from "./analytics";

const snapshot = buildAnalyticsSnapshot(habit, profile, events, diaryEntries, "30d");
const viewModel = buildInsightViewModel(snapshot);
```

Recommended product order:

1. Store `slip_recorded`, `resisted_logged`, and `diary_entry`.
2. Render the `30d` insights screen from `viewModel`.
3. Add onboarding profile fields to improve the first 14 days of scoring.
4. Add text analysis and predictive warnings later.

Advice architecture:

The advice layer is intentionally separated from scoring.

Each advice entry now has:

- `habits`: which habit types it applies to, or `any`
- `triggerTags`: which triggers it fits
- `riskLevels` and `timeSegments`: optional targeting metadata
- `sourceType`: `editorial`, `behavioral_principle`, `guideline_informed`, or `research_supported`
- `verificationStatus`: `needs_review`, `reviewed`, or `verified`
- `confidence`: internal product confidence from `0` to `1`

This is important because the current seed content is useful product guidance, but not all of it is yet clinically reviewed.

Minimal usage:

```ts
import { buildAdviceBundle } from "./analytics";

const bundle = buildAdviceBundle({
  habitId: "smoking",
  triggerTags: ["stress", "ritual"],
  riskLevel: "high",
  timeSegment: "afternoon",
  includeUnreviewed: true,
});
```

Browser demo usage:

```html
<script src="../analytics/advice-library.js"></script>
<script>
  const bundle = window.HabitAdviceLibrary.buildAdviceBundle({
    habitId: "social",
    triggerTags: ["fatigue", "ritual"],
    riskLevel: "high",
    timeSegment: "night",
    includeUnreviewed: true
  });
</script>
```
