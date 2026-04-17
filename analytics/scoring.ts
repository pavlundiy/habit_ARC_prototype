import {
  AggregateMetrics,
  AnalyticsSnapshot,
  DayOfWeekStat,
  DiaryEntry,
  Habit,
  HabitEvent,
  HabitProfile,
  InsightViewModel,
  PeriodKey,
  RiskLevel,
  SlipRecordedEvent,
  Subscores,
  TriggerBreakdown,
  TriggerTag,
} from "./types";

const HEATMAP_HOURS = [7, 9, 11, 13, 15, 17, 19, 21, 23];
const HEATMAP_HOUR_LABELS = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"];
const WEEKDAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NEGATIVE_TRIGGER_TAGS = new Set<TriggerTag>(["stress", "boredom", "fatigue", "loneliness", "anxiety"]);
const EMOTION_KEYWORDS = [
  "stress",
  "deadline",
  "anx",
  "panic",
  "empty",
  "lonely",
  "tired",
  "fatigue",
  "bored",
  "pressure",
  "angry",
  "irritat",
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalized(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function periodDays(period: PeriodKey): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  return 30;
}

function dateMinusDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function eventDate(event: HabitEvent): Date {
  return new Date(event.timestamp);
}

function isInWindow(timestamp: string, start: Date, end: Date): boolean {
  const date = new Date(timestamp);
  return date >= start && date <= end;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toLocalDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getOrDefault<K extends string | number, V>(map: Map<K, V>, key: K, fallback: V): V {
  return map.has(key) ? (map.get(key) as V) : fallback;
}

function buildDateRange(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    return toLocalDate(value);
  });
}

function localHourBucket(hour: number): number {
  let bucketIndex = 0;
  for (let index = 0; index < HEATMAP_HOURS.length; index += 1) {
    if (hour >= HEATMAP_HOURS[index]) bucketIndex = index;
  }
  return bucketIndex;
}

function dayOfWeekIndex(localDate: string): number {
  const utcDate = new Date(`${localDate}T12:00:00Z`);
  const day = utcDate.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function topEntries<K>(items: Map<K, number>, limit: number): Array<[K, number]> {
  return Array.from(items.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function buildHeatmap(slips: SlipRecordedEvent[]): number[][] {
  const matrix = HEATMAP_HOURS.map(() => Array.from({ length: 7 }, () => 0));
  slips.forEach((event) => {
    const row = localHourBucket(event.localHour);
    const col = dayOfWeekIndex(event.localDate);
    matrix[row][col] += 1;
  });
  return matrix;
}

function buildTriggerBreakdown(events: Array<SlipRecordedEvent | { triggerTags: TriggerTag[] }>): TriggerBreakdown[] {
  const triggerCounts = new Map<TriggerTag, number>();
  events.forEach((event) => {
    event.triggerTags.forEach((tag) => {
      triggerCounts.set(tag, getOrDefault(triggerCounts, tag, 0) + 1);
    });
  });
  const total = Array.from(triggerCounts.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(triggerCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([tag, count]) => ({
      tag,
      count,
      share: total ? round(count / total) : 0,
    }));
}

function buildDayOfWeekStats(slips: SlipRecordedEvent[]): DayOfWeekStat[] {
  const counts = Array.from({ length: 7 }, () => 0);
  slips.forEach((event) => {
    counts[dayOfWeekIndex(event.localDate)] += 1;
  });
  return WEEKDAY_KEYS.map((day, index) => ({ day, slips: counts[index] }));
}

function calculateEmotionKeywordScore(entries: DiaryEntry[]): number {
  if (!entries.length) return 0;
  const hits = entries.reduce((sum, entry) => {
    const text = entry.text.toLowerCase();
    const matched = EMOTION_KEYWORDS.filter((keyword) => text.includes(keyword)).length;
    return sum + matched;
  }, 0);
  return clamp(hits / Math.max(entries.length * 2, 1), 0, 1);
}

function countSlipClusters(slips: SlipRecordedEvent[]): number {
  if (slips.length < 2) return 0;
  const sorted = [...slips].sort((left, right) => eventDate(left).getTime() - eventDate(right).getTime());
  let clusters = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const gapMinutes = (eventDate(sorted[index]).getTime() - eventDate(sorted[index - 1]).getTime()) / 60000;
    if (gapMinutes <= 180) clusters += 1;
  }
  return clusters;
}

function calculateRecoveryDays(orderedDates: string[], dailySlipCounts: Map<string, number>, dailyLimit: number): number {
  const badDayIndexes = orderedDates
    .map((date, index) => ({ date, index }))
    .filter(({ date }) => getOrDefault(dailySlipCounts, date, 0) > dailyLimit);

  if (!badDayIndexes.length) return 0;

  const values = badDayIndexes.map(({ index }) => {
    for (let nextIndex = index + 1; nextIndex < Math.min(index + 8, orderedDates.length); nextIndex += 1) {
      const candidate = orderedDates[nextIndex];
      if (getOrDefault(dailySlipCounts, candidate, 0) <= dailyLimit) return nextIndex - index;
    }
    return 7;
  });

  return average(values);
}

function calculateResistedAfterSlipRate(badDays: string[], resisted: HabitEvent[]): number {
  if (!badDays.length) return 1;
  let recovered = 0;
  badDays.forEach((dateValue) => {
    const start = new Date(`${dateValue}T00:00:00Z`).getTime();
    const end = start + 48 * 60 * 60 * 1000;
    const hasResisted = resisted.some((event) => {
      const timestamp = eventDate(event).getTime();
      return timestamp > start && timestamp <= end;
    });
    if (hasResisted) recovered += 1;
  });
  return recovered / badDays.length;
}

function calculateInverseTrend(currentPerDay: number, previousPerDay: number): number {
  if (currentPerDay === 0 && previousPerDay === 0) return 0;
  if (previousPerDay === 0) return currentPerDay > 0 ? 1 : 0;
  const deltaRatio = (currentPerDay - previousPerDay) / previousPerDay;
  return clamp(0.5 + deltaRatio * 0.5, 0, 1);
}

function calculateBaselineModifier(profile: HabitProfile): number {
  const earlyUseModifier =
    profile.firstUseAfterWakingMinutes <= 60
      ? 1
      : profile.firstUseAfterWakingMinutes <= 180
        ? 0.5
        : 0;

  return round(
    100 *
      (
        0.2 * normalized(profile.baselineDailyCount, 0, 20) +
        0.2 * normalized(profile.selfControlRating, 1, 5) +
        0.2 * normalized(profile.strongCravingFrequency, 0, 5) +
        0.2 * normalized(profile.failedCutbackAttempts, 0, 5) +
        0.2 * earlyUseModifier
      ),
  );
}

export function aggregateMetrics(
  habit: Habit,
  events: HabitEvent[],
  diaryEntries: DiaryEntry[],
  period: PeriodKey,
  now = new Date(),
): AggregateMetrics {
  const days = periodDays(period);
  const start = dateMinusDays(now, days - 1);
  const previousStart = dateMinusDays(start, days);
  const previousEnd = new Date(start.getTime() - 1);

  const currentEvents = events.filter((event) => isInWindow(event.timestamp, start, now));
  const previousEvents = events.filter((event) => isInWindow(event.timestamp, previousStart, previousEnd));
  const currentDiaryEntries = diaryEntries.filter((entry) => isInWindow(entry.timestamp, start, now));

  const slips = currentEvents.filter((event): event is SlipRecordedEvent => event.eventType === "slip_recorded");
  const cravings = currentEvents.filter((event) => event.eventType === "craving_logged");
  const resisted = currentEvents.filter((event) => event.eventType === "resisted_logged");
  const previousSlips = previousEvents.filter((event) => event.eventType === "slip_recorded");

  const orderedDates = buildDateRange(start, days);
  const dailySlipCounts = new Map<string, number>();
  slips.forEach((event) => {
    dailySlipCounts.set(event.localDate, getOrDefault(dailySlipCounts, event.localDate, 0) + 1);
  });

  const daysAboveLimit = orderedDates.filter((dateValue) => getOrDefault(dailySlipCounts, dateValue, 0) > habit.dailyLimit);
  const maxSlipsInDay = orderedDates.reduce((max, dateValue) => Math.max(max, getOrDefault(dailySlipCounts, dateValue, 0)), 0);

  const urgeEvents = [...cravings, ...resisted];
  const allCravingLevels = [...cravings, ...resisted, ...slips].map((event) => ("cravingLevel" in event ? event.cravingLevel : 0));
  const avgCravingLevel = average(allCravingLevels);
  const highCravingShare = allCravingLevels.length ? allCravingLevels.filter((value) => value >= 4).length / allCravingLevels.length : 0;
  const cravingToSlipRate = urgeEvents.length ? slips.length / (urgeEvents.length + slips.length) : slips.length ? 1 : 0;

  const triggerBreakdown = buildTriggerBreakdown([...slips, ...cravings.map((event) => ({ triggerTags: event.triggerTags }))]);
  const mainTrigger = triggerBreakdown[0]?.tag ?? "unknown";
  const topTriggerShare = triggerBreakdown[0]?.share ?? 0;

  const hourCounts = new Map<number, number>();
  slips.forEach((event) => {
    const bucket = localHourBucket(event.localHour);
    hourCounts.set(bucket, getOrDefault(hourCounts, bucket, 0) + 1);
  });
  const topHourCount = topEntries(hourCounts, 2).reduce((sum, [, count]) => sum + count, 0);
  const peakHourConcentration = slips.length ? topHourCount / slips.length : 0;

  const patternCounts = new Map<string, number>();
  slips.forEach((event) => {
    const primaryTrigger = event.triggerTags[0] ?? "other";
    const context = [
      event.context.atWork ? "work" : "",
      event.context.afterFood ? "food" : "",
      event.context.withPeople ? "social" : "",
      event.context.alone ? "alone" : "",
    ]
      .filter(Boolean)
      .join("_");
    const key = `${localHourBucket(event.localHour)}:${primaryTrigger}:${context || "neutral"}`;
    patternCounts.set(key, getOrDefault(patternCounts, key, 0) + 1);
  });
  const routinePatternScore = slips.length ? (topEntries(patternCounts, 1)[0]?.[1] ?? 0) / slips.length : 0;

  const stressTriggerCount = slips.reduce((sum, event) => sum + (event.triggerTags.includes("stress") ? 1 : 0), 0);
  const negativeTriggerShare = slips.length
    ? slips.filter((event) => event.triggerTags.some((tag) => NEGATIVE_TRIGGER_TAGS.has(tag))).length / slips.length
    : 0;

  const slipClusters = countSlipClusters(slips);
  const recoveryDaysAfterBadDay = calculateRecoveryDays(orderedDates, dailySlipCounts, habit.dailyLimit);
  const resistedAfterSlipRate = calculateResistedAfterSlipRate(daysAboveLimit, resisted);

  const currentPerDay = slips.length / days;
  const previousPerDay = previousSlips.length / days;
  const inversePositiveTrend = calculateInverseTrend(currentPerDay, previousPerDay);

  const topHourBucket = topEntries(hourCounts, 1)[0]?.[0] ?? 0;
  const riskWindowStart = HEATMAP_HOURS[topHourBucket];
  const riskWindowEnd = Math.min(riskWindowStart + 3, 24);
  const riskWindow = `${String(riskWindowStart).padStart(2, "0")}:00-${String(riskWindowEnd).padStart(2, "0")}:00`;

  return {
    slipsPerDayAvg: round(slips.length / days),
    slipsPerWeekAvg: round((slips.length / days) * 7),
    maxSlipsInDay,
    daysAboveLimitPercent: round(daysAboveLimit.length / days),
    avgCravingLevel: round(avgCravingLevel),
    highCravingShare: round(highCravingShare),
    cravingEventsPerDay: round((cravings.length + resisted.length) / days),
    cravingToSlipRate: round(cravingToSlipRate),
    peakHourConcentration: round(peakHourConcentration),
    topTriggerShare: round(topTriggerShare),
    routinePatternScore: round(routinePatternScore),
    stressTriggerShare: round(slips.length ? stressTriggerCount / slips.length : 0),
    negativeEmotionShare: round(negativeTriggerShare),
    emotionKeywordScore: round(calculateEmotionKeywordScore(currentDiaryEntries)),
    limitBreakRate: round(daysAboveLimit.length / days),
    consecutiveSlipClusters: slipClusters,
    recoveryDaysAfterBadDay: round(recoveryDaysAfterBadDay),
    resistedAfterSlipRate: round(resistedAfterSlipRate),
    inversePositiveTrend: round(inversePositiveTrend),
    slipCount: slips.length,
    resistedCount: resisted.length,
    topTrigger: mainTrigger,
    riskWindow,
    heatmap: buildHeatmap(slips),
    triggerBreakdown,
    dayOfWeekStats: buildDayOfWeekStats(slips),
  };
}

export function calculateSubscores(metrics: AggregateMetrics): Subscores {
  const cravingScore = 100 * (0.4 * normalized(metrics.avgCravingLevel, 1, 5) + 0.35 * metrics.highCravingShare + 0.25 * normalized(metrics.cravingEventsPerDay, 0, 8));
  const automaticityScore = 100 * (0.35 * metrics.peakHourConcentration + 0.35 * metrics.topTriggerShare + 0.3 * metrics.routinePatternScore);
  const lossOfControlScore = 100 * (0.4 * metrics.limitBreakRate + 0.35 * metrics.cravingToSlipRate + 0.25 * normalized(metrics.consecutiveSlipClusters, 0, 10));
  const emotionalRelianceScore = 100 * (0.4 * metrics.negativeEmotionShare + 0.35 * metrics.stressTriggerShare + 0.25 * metrics.emotionKeywordScore);
  const recoveryScore = 100 * (0.45 * normalized(metrics.recoveryDaysAfterBadDay, 0, 7) + 0.3 * (1 - metrics.resistedAfterSlipRate) + 0.25 * metrics.inversePositiveTrend);

  return {
    cravingScore: round(cravingScore),
    automaticityScore: round(automaticityScore),
    lossOfControlScore: round(lossOfControlScore),
    emotionalRelianceScore: round(emotionalRelianceScore),
    recoveryScore: round(recoveryScore),
  };
}

export function calculateDependencyIndex(subscores: Subscores): number {
  return round(
    0.3 * subscores.cravingScore +
      0.2 * subscores.automaticityScore +
      0.2 * subscores.lossOfControlScore +
      0.2 * subscores.emotionalRelianceScore +
      0.1 * subscores.recoveryScore,
  );
}

export function deriveRiskLevel(index: number): RiskLevel {
  if (index >= 75) return "very_high";
  if (index >= 50) return "high";
  if (index >= 25) return "moderate";
  return "low";
}

function triggerToHeadline(trigger: TriggerTag | "unknown"): string {
  if (trigger === "stress") return "Stress is the strongest driver right now.";
  if (trigger === "boredom") return "Boredom is feeding the habit loop.";
  if (trigger === "company") return "Social context is your biggest risk factor.";
  if (trigger === "after_food") return "Post-meal ritual is the sharpest trigger.";
  if (trigger === "fatigue") return "Fatigue is lowering self-control during the day.";
  return "The app already sees a repeatable behavior pattern.";
}

function recommendationForTrigger(trigger: TriggerTag | "unknown", riskWindow: string): string {
  if (trigger === "stress") return `Block a 10-minute decompression break before ${riskWindow}.`;
  if (trigger === "boredom") return `Prepare a replacement ritual before ${riskWindow}: water, walk, or gum.`;
  if (trigger === "company") return `Plan a social alternative script for ${riskWindow}.`;
  if (trigger === "after_food") return `Put a new post-meal action after lunch before ${riskWindow}.`;
  return `Set a reminder before ${riskWindow} and log the urge before acting on it.`;
}

export function buildAnalyticsSnapshot(
  habit: Habit,
  profile: HabitProfile,
  events: HabitEvent[],
  diaryEntries: DiaryEntry[],
  period: PeriodKey,
  now = new Date(),
): AnalyticsSnapshot {
  const metrics = aggregateMetrics(habit, events, diaryEntries, period, now);
  const subscores = calculateSubscores(metrics);
  const dependencyIndex = calculateDependencyIndex(subscores);
  const baselineModifier = calculateBaselineModifier(profile);
  const daysSinceCreation = Math.max(1, Math.floor((now.getTime() - new Date(habit.createdAt).getTime()) / 86400000));

  const finalIndex = daysSinceCreation <= 14 ? 0.65 * dependencyIndex + 0.35 * baselineModifier : 0.9 * dependencyIndex + 0.1 * baselineModifier;
  const roundedFinalIndex = round(finalIndex);

  return {
    period,
    generatedAt: now.toISOString(),
    baselineModifier,
    dependencyIndex: roundedFinalIndex,
    riskLevel: deriveRiskLevel(roundedFinalIndex),
    mainTrigger: metrics.topTrigger,
    riskWindow: metrics.riskWindow,
    headline: triggerToHeadline(metrics.topTrigger),
    recommendation: recommendationForTrigger(metrics.topTrigger, metrics.riskWindow),
    metrics,
    subscores,
  };
}

function toDisplayRiskLevel(level: RiskLevel): string {
  if (level === "very_high") return "very high";
  if (level === "high") return "high";
  if (level === "moderate") return "moderate";
  return "low";
}

export function buildInsightViewModel(snapshot: AnalyticsSnapshot): InsightViewModel {
  return {
    period: snapshot.period,
    summary: {
      dependencyIndex: snapshot.dependencyIndex,
      riskLevel: snapshot.riskLevel,
      mainTrigger: snapshot.mainTrigger,
      riskWindow: snapshot.riskWindow,
      headline: `Behavior load is ${toDisplayRiskLevel(snapshot.riskLevel)}. ${snapshot.headline}`,
      recommendation: snapshot.recommendation,
    },
    heatmap: {
      hours: HEATMAP_HOUR_LABELS,
      days: WEEKDAY_KEYS,
      values: snapshot.metrics.heatmap,
    },
    triggers: snapshot.metrics.triggerBreakdown,
    stats: [
      { label: "Total slips", value: String(snapshot.metrics.slipCount), trend: snapshot.metrics.inversePositiveTrend > 0.5 ? "worse" : "better" },
      { label: "Avg per day", value: String(snapshot.metrics.slipsPerDayAvg), trend: `${snapshot.metrics.slipsPerWeekAvg} / week` },
      { label: "Best support", value: String(snapshot.metrics.resistedCount), trend: "resisted moments" },
    ],
    dayPattern: snapshot.metrics.dayOfWeekStats,
  };
}
