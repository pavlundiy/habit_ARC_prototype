export type HabitType = "smoking" | "alcohol" | "sugar" | "social_media" | "custom";

export type TriggerTag =
  | "stress"
  | "boredom"
  | "company"
  | "after_food"
  | "fatigue"
  | "loneliness"
  | "anxiety"
  | "ritual"
  | "craving"
  | "other";

export type CopingTool = "breathing" | "walk" | "water" | "gum" | "call" | "delay" | "other";

export type EventType = "slip_recorded" | "craving_logged" | "resisted_logged" | "goal_updated";

export type PeriodKey = "7d" | "30d" | "90d";

export type RiskLevel = "low" | "moderate" | "high" | "very_high";

export interface HabitContext {
  alone?: boolean;
  withPeople?: boolean;
  afterFood?: boolean;
  atWork?: boolean;
  atHome?: boolean;
}

export interface Habit {
  id: string;
  userId: string;
  type: HabitType;
  title: string;
  dailyLimit: number;
  weeklyTarget?: number;
  createdAt: string;
}

export interface HabitProfile {
  habitId: string;
  baselineDailyCount: number;
  yearsWithHabit: number;
  firstUseAfterWakingMinutes: number;
  strongCravingFrequency: number;
  failedCutbackAttempts: number;
  mainReasons: TriggerTag[];
  selfControlRating: number;
}

export interface BaseEvent {
  id: string;
  userId: string;
  habitId: string;
  eventType: EventType;
  timestamp: string;
  localDate: string;
  localHour: number;
}

export interface SlipRecordedEvent extends BaseEvent {
  eventType: "slip_recorded";
  triggerTags: TriggerTag[];
  cravingLevel: number;
  context: HabitContext;
  note?: string;
  sourceScreen: "main" | "diary" | "quick_action";
}

export interface CravingLoggedEvent extends BaseEvent {
  eventType: "craving_logged";
  triggerTags: TriggerTag[];
  cravingLevel: number;
  resolvedWithoutSlip: boolean;
  delayMinutes: number;
  copingToolUsed?: CopingTool;
}

export interface ResistedLoggedEvent extends BaseEvent {
  eventType: "resisted_logged";
  triggerTags: TriggerTag[];
  cravingLevel: number;
  copingToolUsed?: CopingTool;
}

export interface GoalUpdatedEvent extends BaseEvent {
  eventType: "goal_updated";
  dailyLimit: number;
  weeklyTarget?: number;
}

export type HabitEvent =
  | SlipRecordedEvent
  | CravingLoggedEvent
  | ResistedLoggedEvent
  | GoalUpdatedEvent;

export interface DiaryEntry {
  id: string;
  userId: string;
  habitId: string;
  timestamp: string;
  entryType: "free_note" | "slip_note";
  relatedSlipId?: string;
  text: string;
  tag?: TriggerTag;
}

export interface TriggerBreakdown {
  tag: TriggerTag;
  count: number;
  share: number;
}

export interface DayOfWeekStat {
  day: string;
  slips: number;
}

export interface AggregateMetrics {
  slipsPerDayAvg: number;
  slipsPerWeekAvg: number;
  maxSlipsInDay: number;
  daysAboveLimitPercent: number;
  avgCravingLevel: number;
  highCravingShare: number;
  cravingEventsPerDay: number;
  cravingToSlipRate: number;
  peakHourConcentration: number;
  topTriggerShare: number;
  routinePatternScore: number;
  stressTriggerShare: number;
  negativeEmotionShare: number;
  emotionKeywordScore: number;
  limitBreakRate: number;
  consecutiveSlipClusters: number;
  recoveryDaysAfterBadDay: number;
  resistedAfterSlipRate: number;
  inversePositiveTrend: number;
  slipCount: number;
  resistedCount: number;
  topTrigger: TriggerTag | "unknown";
  riskWindow: string;
  heatmap: number[][];
  triggerBreakdown: TriggerBreakdown[];
  dayOfWeekStats: DayOfWeekStat[];
}

export interface Subscores {
  cravingScore: number;
  automaticityScore: number;
  lossOfControlScore: number;
  emotionalRelianceScore: number;
  recoveryScore: number;
}

export interface AnalyticsSnapshot {
  period: PeriodKey;
  generatedAt: string;
  baselineModifier: number;
  dependencyIndex: number;
  riskLevel: RiskLevel;
  mainTrigger: TriggerTag | "unknown";
  riskWindow: string;
  headline: string;
  recommendation: string;
  metrics: AggregateMetrics;
  subscores: Subscores;
}

export interface StatTile {
  label: string;
  value: string;
  trend?: string;
}

export interface InsightViewModel {
  period: PeriodKey;
  summary: {
    dependencyIndex: number;
    riskLevel: RiskLevel;
    mainTrigger: string;
    riskWindow: string;
    headline: string;
    recommendation: string;
  };
  heatmap: {
    hours: string[];
    days: string[];
    values: number[][];
  };
  triggers: TriggerBreakdown[];
  stats: StatTile[];
  dayPattern: DayOfWeekStat[];
}

export type AdviceHabit = "smoking" | "alcohol" | "sweets" | "social" | "overeating" | "custom" | "any";

export type AdviceKind = "interrupt" | "replacement" | "reflection" | "planning" | "recovery";

export type AdviceEvidenceLevel =
  | "editorial"
  | "behavioral_principle"
  | "guideline_informed"
  | "research_supported";

export type AdviceVerificationStatus = "needs_review" | "reviewed" | "verified";

export type AdviceTimeSegment = "morning" | "afternoon" | "evening" | "night" | "any";

export interface AdviceEntry {
  id: string;
  title: string;
  shortLabel: string;
  kind: AdviceKind;
  habits: AdviceHabit[];
  triggerTags: TriggerTag[];
  riskLevels?: RiskLevel[];
  timeSegments?: AdviceTimeSegment[];
  body: string;
  rationale: string;
  sourceType: AdviceEvidenceLevel;
  sourceLabel: string;
  verificationStatus: AdviceVerificationStatus;
  confidence: number;
  tags: string[];
}

export interface AdviceMatchInput {
  habitId: AdviceHabit;
  triggerTags?: TriggerTag[];
  riskLevel?: RiskLevel;
  timeSegment?: AdviceTimeSegment;
  includeUnreviewed?: boolean;
}

export interface AdviceMatchResult {
  advice: AdviceEntry;
  score: number;
  matchedTriggers: TriggerTag[];
}

export interface AdviceBundle {
  primary: AdviceMatchResult | null;
  support: AdviceMatchResult[];
  reflection: AdviceMatchResult | null;
}
