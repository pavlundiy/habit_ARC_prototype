import { buildAnalyticsSnapshot, buildInsightViewModel } from "./scoring";
import { DiaryEntry, Habit, HabitEvent, HabitProfile, InsightViewModel, PeriodKey } from "./types";

const USER_ID = "user-001";
const HABIT_ID = "habit-smoking-001";

function localDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function localHour(timestamp: string): number {
  return Number(timestamp.slice(11, 13));
}

function makeSlip(
  id: string,
  timestamp: string,
  triggerTags: Array<"stress" | "boredom" | "company" | "after_food" | "fatigue" | "ritual">,
  cravingLevel: number,
  note: string,
): HabitEvent {
  return {
    id,
    userId: USER_ID,
    habitId: HABIT_ID,
    eventType: "slip_recorded",
    timestamp,
    localDate: localDate(timestamp),
    localHour: localHour(timestamp),
    triggerTags,
    cravingLevel,
    context: {
      atWork: timestamp.includes("13:") || timestamp.includes("14:") || timestamp.includes("15:"),
      afterFood: triggerTags.includes("after_food"),
      withPeople: triggerTags.includes("company"),
      alone: !triggerTags.includes("company"),
    },
    note,
    sourceScreen: "main",
  };
}

function makeResisted(
  id: string,
  timestamp: string,
  triggerTags: Array<"stress" | "boredom" | "company" | "after_food" | "fatigue" | "ritual">,
  cravingLevel: number,
): HabitEvent {
  return {
    id,
    userId: USER_ID,
    habitId: HABIT_ID,
    eventType: "resisted_logged",
    timestamp,
    localDate: localDate(timestamp),
    localHour: localHour(timestamp),
    triggerTags,
    cravingLevel,
    copingToolUsed: "walk",
  };
}

function makeCraving(
  id: string,
  timestamp: string,
  triggerTags: Array<"stress" | "boredom" | "company" | "after_food" | "fatigue" | "ritual">,
  cravingLevel: number,
  resolvedWithoutSlip: boolean,
  delayMinutes: number,
): HabitEvent {
  return {
    id,
    userId: USER_ID,
    habitId: HABIT_ID,
    eventType: "craving_logged",
    timestamp,
    localDate: localDate(timestamp),
    localHour: localHour(timestamp),
    triggerTags,
    cravingLevel,
    resolvedWithoutSlip,
    delayMinutes,
    copingToolUsed: resolvedWithoutSlip ? "breathing" : "other",
  };
}

export const mockHabit: Habit = {
  id: HABIT_ID,
  userId: USER_ID,
  type: "smoking",
  title: "Smoking",
  dailyLimit: 5,
  weeklyTarget: 28,
  createdAt: "2026-03-01T09:00:00.000Z",
};

export const mockProfile: HabitProfile = {
  habitId: HABIT_ID,
  baselineDailyCount: 8,
  yearsWithHabit: 6,
  firstUseAfterWakingMinutes: 35,
  strongCravingFrequency: 4,
  failedCutbackAttempts: 3,
  mainReasons: ["stress", "after_food", "ritual"],
  selfControlRating: 4,
};

export const mockEvents: HabitEvent[] = [
  makeSlip("s1", "2026-03-10T13:32:00.000Z", ["stress", "after_food"], 4, "After meeting"),
  makeSlip("s2", "2026-03-10T15:05:00.000Z", ["stress"], 5, "Deadline pressure"),
  makeSlip("s3", "2026-03-11T09:10:00.000Z", ["boredom", "ritual"], 2, "Morning coffee"),
  makeSlip("s4", "2026-03-11T14:20:00.000Z", ["stress", "after_food"], 4, "Lunch break"),
  makeSlip("s5", "2026-03-12T13:40:00.000Z", ["stress"], 4, "Review call"),
  makeSlip("s6", "2026-03-14T18:15:00.000Z", ["company"], 3, "Friends"),
  makeSlip("s7", "2026-03-17T13:25:00.000Z", ["stress", "after_food"], 4, "Work overload"),
  makeSlip("s8", "2026-03-17T15:10:00.000Z", ["fatigue"], 3, "Energy drop"),
  makeSlip("s9", "2026-03-18T09:05:00.000Z", ["ritual", "boredom"], 2, "Coffee"),
  makeSlip("s10", "2026-03-18T14:10:00.000Z", ["stress"], 5, "After sync"),
  makeSlip("s11", "2026-03-21T13:55:00.000Z", ["after_food", "stress"], 4, "Lunch"),
  makeSlip("s12", "2026-03-23T14:02:00.000Z", ["stress"], 4, "Delivery issue"),
  makeSlip("s13", "2026-03-24T13:48:00.000Z", ["stress", "after_food"], 5, "Tight afternoon"),
  makeSlip("s14", "2026-03-24T15:22:00.000Z", ["stress"], 4, "Second wave"),
  makeSlip("s15", "2026-03-25T09:03:00.000Z", ["ritual"], 2, "Automatic habit"),
  makeSlip("s16", "2026-03-26T13:38:00.000Z", ["stress", "after_food"], 4, "Lunch stress"),
  makeSlip("s17", "2026-03-28T18:40:00.000Z", ["company"], 3, "Weekend social trigger"),
  makeSlip("s18", "2026-03-31T13:31:00.000Z", ["stress", "after_food"], 4, "Office tension"),
  makeSlip("s19", "2026-04-01T14:15:00.000Z", ["stress"], 4, "Post-lunch"),
  makeSlip("s20", "2026-04-02T09:08:00.000Z", ["ritual", "boredom"], 2, "Coffee"),
  makeSlip("s21", "2026-04-02T13:44:00.000Z", ["stress", "after_food"], 5, "Midday stress"),
  makeSlip("s22", "2026-04-03T15:12:00.000Z", ["fatigue"], 3, "Tired"),
  makeSlip("s23", "2026-04-04T18:25:00.000Z", ["company"], 3, "Saturday"),
  makeSlip("s24", "2026-04-06T13:27:00.000Z", ["stress", "after_food"], 4, "Lunch rush"),
  makeSlip("s25", "2026-04-07T14:32:00.000Z", ["stress"], 4, "After meeting"),
  makeResisted("r1", "2026-03-19T13:05:00.000Z", ["stress", "after_food"], 4),
  makeResisted("r2", "2026-03-20T14:00:00.000Z", ["stress"], 3),
  makeResisted("r3", "2026-03-27T13:10:00.000Z", ["stress", "after_food"], 4),
  makeResisted("r4", "2026-03-30T09:20:00.000Z", ["ritual"], 2),
  makeResisted("r5", "2026-04-05T13:15:00.000Z", ["stress"], 4),
  makeResisted("r6", "2026-04-07T12:50:00.000Z", ["stress", "after_food"], 3),
  makeCraving("c1", "2026-03-22T13:15:00.000Z", ["stress"], 4, false, 5),
  makeCraving("c2", "2026-03-29T13:05:00.000Z", ["after_food"], 3, true, 12),
  makeCraving("c3", "2026-04-01T12:58:00.000Z", ["stress"], 4, false, 4),
  makeCraving("c4", "2026-04-06T12:45:00.000Z", ["stress", "after_food"], 5, false, 3),
];

export const mockDiaryEntries: DiaryEntry[] = [
  {
    id: "d1",
    userId: USER_ID,
    habitId: HABIT_ID,
    timestamp: "2026-03-10T13:40:00.000Z",
    entryType: "slip_note",
    relatedSlipId: "s1",
    tag: "stress",
    text: "After meetings I feel pressure and reach for a cigarette without thinking.",
  },
  {
    id: "d2",
    userId: USER_ID,
    habitId: HABIT_ID,
    timestamp: "2026-03-11T09:18:00.000Z",
    entryType: "slip_note",
    relatedSlipId: "s3",
    tag: "boredom",
    text: "Morning smoking is mostly hands and ritual, not a real need.",
  },
  {
    id: "d3",
    userId: USER_ID,
    habitId: HABIT_ID,
    timestamp: "2026-03-24T14:05:00.000Z",
    entryType: "free_note",
    tag: "stress",
    text: "Stress spikes after lunch when deadlines pile up and I feel anxious.",
  },
  {
    id: "d4",
    userId: USER_ID,
    habitId: HABIT_ID,
    timestamp: "2026-04-02T09:15:00.000Z",
    entryType: "free_note",
    tag: "ritual",
    text: "Coffee is a ritual trigger. If I stand up and walk, the urge drops.",
  },
  {
    id: "d5",
    userId: USER_ID,
    habitId: HABIT_ID,
    timestamp: "2026-04-07T14:40:00.000Z",
    entryType: "slip_note",
    relatedSlipId: "s25",
    tag: "stress",
    text: "Another hard meeting. The pattern is obvious: pressure, tension, cigarette.",
  },
];

export function buildMockSnapshot(period: PeriodKey, now = new Date("2026-04-07T18:00:00.000Z")) {
  return buildAnalyticsSnapshot(mockHabit, mockProfile, mockEvents, mockDiaryEntries, period, now);
}

export const mockSnapshots = {
  "7d": buildMockSnapshot("7d"),
  "30d": buildMockSnapshot("30d"),
  "90d": buildMockSnapshot("90d"),
};

export const mockInsightViewModels: Record<PeriodKey, InsightViewModel> = {
  "7d": buildInsightViewModel(mockSnapshots["7d"]),
  "30d": buildInsightViewModel(mockSnapshots["30d"]),
  "90d": buildInsightViewModel(mockSnapshots["90d"]),
};
