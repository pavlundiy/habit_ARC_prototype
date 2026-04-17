import type {
  AdviceBundle,
  AdviceEntry,
  AdviceHabit,
  AdviceMatchInput,
  AdviceMatchResult,
  AdviceTimeSegment,
  RiskLevel,
  TriggerTag,
} from "./types";

const adviceLibrary: AdviceEntry[] = [
  {
    id: "smoking_breath_pause",
    title: "Короткая пауза без сигареты",
    shortLabel: "Пауза и дыхание",
    kind: "interrupt",
    habits: ["smoking"],
    triggerTags: ["stress", "fatigue", "craving"],
    riskLevels: ["moderate", "high", "very_high"],
    timeSegments: ["afternoon", "evening"],
    body: "Остановись на 2-3 минуты, сделай несколько длинных выдохов и только потом принимай решение. Часто пик тяги проходит быстрее, чем кажется.",
    rationale: "Работает как короткий разрыв автоматического сценария и снижает импульсивность в пике.",
    sourceType: "guideline_informed",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.72,
    tags: ["craving_peak", "breathing", "pause"],
  },
  {
    id: "smoking_hand_replacement",
    title: "Замени движение рук",
    shortLabel: "Занять руки",
    kind: "replacement",
    habits: ["smoking"],
    triggerTags: ["ritual", "boredom"],
    timeSegments: ["any"],
    body: "Возьми воду, ручку, жвачку или любой небольшой предмет в руки. Это помогает разорвать не только тягу, но и моторную привычку.",
    rationale: "Подходит, когда важна не только сигарета, а сам ритуал движения.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.66,
    tags: ["ritual", "motor_pattern"],
  },
  {
    id: "alcohol_delay_and_swap",
    title: "Отложить решение и заранее выбрать замену",
    shortLabel: "Отложить и заменить",
    kind: "planning",
    habits: ["alcohol"],
    triggerTags: ["company", "stress", "ritual"],
    riskLevels: ["moderate", "high", "very_high"],
    timeSegments: ["evening", "night"],
    body: "Смести решение хотя бы на 20 минут и сразу определи, что будет вместо алкоголя: вода с газом, чай, безалкогольный напиток.",
    rationale: "Уменьшает вероятность импульсивного выбора и заранее убирает пустое место в сценарии.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.7,
    tags: ["delay", "substitution", "social"],
  },
  {
    id: "sweets_post_meal_switch",
    title: "Сразу закрыть сценарий после еды",
    shortLabel: "Переключение после еды",
    kind: "replacement",
    habits: ["sweets"],
    triggerTags: ["after_food"],
    timeSegments: ["afternoon", "evening"],
    body: "После еды сразу встань из-за стола, почисти зубы или сделай несладкий чай. Важно не оставаться в том же ритуале ещё несколько минут.",
    rationale: "Полезно, когда тяга к сладкому запускается не голодом, а привычной связкой после еды.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.74,
    tags: ["after_food", "ritual", "switch"],
  },
  {
    id: "sweets_energy_check",
    title: "Проверить энергию до решения",
    shortLabel: "Проверка энергии",
    kind: "reflection",
    habits: ["sweets"],
    triggerTags: ["stress", "fatigue", "boredom"],
    timeSegments: ["afternoon", "evening"],
    body: "Спроси себя: это тяга к сладкому или сейчас просто провал по энергии, голод или усталость? Иногда сначала нужен перекус, вода или пауза, а не сладкое.",
    rationale: "Помогает отделить эмоциональный импульс от телесной потребности.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.69,
    tags: ["energy", "hunger_check", "reflection"],
  },
  {
    id: "social_exit_timer",
    title: "Задать правило выхода до входа",
    shortLabel: "Таймер выхода",
    kind: "planning",
    habits: ["social"],
    triggerTags: ["boredom", "fatigue", "ritual"],
    timeSegments: ["afternoon", "evening", "night"],
    body: "Перед входом в соцсети заранее реши, через сколько выйдешь, и поставь таймер. Лучше правило до входа, чем борьба с собой уже внутри ленты.",
    rationale: "Снижает автопрокрутку и возвращает чувство границы.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.76,
    tags: ["timer", "boundary", "feed"],
  },
  {
    id: "social_phone_distance",
    title: "Убрать телефон из быстрого доступа",
    shortLabel: "Убрать телефон",
    kind: "interrupt",
    habits: ["social"],
    triggerTags: ["fatigue", "night_pull", "ritual", "stress"],
    timeSegments: ["evening", "night"],
    body: "Если начинается автоматический заход в ленту, отложи телефон подальше хотя бы на пару минут. Физическая дистанция часто работает лучше, чем внутренний спор.",
    rationale: "Полезно, когда привычка включается слишком быстро и без осознанного решения.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.68,
    tags: ["distance", "night", "interrupt"],
  },
  {
    id: "overeating_hunger_check",
    title: "Проверить: это голод или напряжение",
    shortLabel: "Голод или стресс",
    kind: "reflection",
    habits: ["overeating"],
    triggerTags: ["stress", "fatigue", "after_food", "boredom"],
    timeSegments: ["afternoon", "evening", "night"],
    body: "Перед едой или добавкой задай себе короткий вопрос: я голоден телом или сейчас хочу снять напряжение, усталость или пустоту?",
    rationale: "Помогает заметить эмоциональное переедание раньше, чем оно становится автоматическим.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.73,
    tags: ["body_signal", "emotion_check"],
  },
  {
    id: "overeating_slowdown",
    title: "Сделать две осознанные паузы",
    shortLabel: "Замедлить темп",
    kind: "interrupt",
    habits: ["overeating"],
    triggerTags: ["craving", "stress", "after_food"],
    timeSegments: ["afternoon", "evening"],
    body: "Во время еды или перед добавкой сделай две короткие паузы. Даже небольшое замедление уже меняет автоматический темп сценария.",
    rationale: "Подходит, когда остановиться трудно уже после начала эпизода.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.67,
    tags: ["slowdown", "interrupt"],
  },
  {
    id: "universal_write_trigger",
    title: "Коротко записать, что запустило эпизод",
    shortLabel: "Записать триггер",
    kind: "reflection",
    habits: ["any"],
    triggerTags: ["stress", "boredom", "company", "after_food", "fatigue", "ritual", "other"],
    timeSegments: ["any"],
    body: "Сделай одну короткую запись: что произошло, что ты почувствовал и что было прямо перед этим. Это полезнее, чем просто считать эпизоды.",
    rationale: "Запись помогает увидеть повторяющийся паттерн и даёт материал для аналитики.",
    sourceType: "editorial",
    sourceLabel: "Product guidance",
    verificationStatus: "reviewed",
    confidence: 0.82,
    tags: ["diary", "pattern", "self_observation"],
  },
  {
    id: "universal_reduce_access",
    title: "Сделать вредный сценарий менее доступным",
    shortLabel: "Снизить доступ",
    kind: "planning",
    habits: ["any"],
    triggerTags: ["ritual", "company", "after_food", "boredom", "other"],
    timeSegments: ["any"],
    body: "Если триггер известен заранее, лучше упростить здоровую альтернативу и усложнить вредную: убрать предмет, сократить доступ, изменить маршрут или место.",
    rationale: "Работает как изменение среды, а не только как борьба силой воли.",
    sourceType: "behavioral_principle",
    sourceLabel: "Seed content, needs clinical review",
    verificationStatus: "needs_review",
    confidence: 0.78,
    tags: ["environment", "access", "planning"],
  },
  {
    id: "universal_restart_after_slip",
    title: "Не превращать один срыв в целый плохой день",
    shortLabel: "Мягкий рестарт",
    kind: "recovery",
    habits: ["any"],
    triggerTags: ["other"],
    riskLevels: ["moderate", "high", "very_high"],
    timeSegments: ["any"],
    body: "После неудачного момента полезнее спросить себя про следующий шаг, чем ругать себя за весь день. Один эпизод не обязан превращаться в серию.",
    rationale: "Поддерживает восстановление после срыва и снижает риск каскада.",
    sourceType: "editorial",
    sourceLabel: "Product guidance",
    verificationStatus: "reviewed",
    confidence: 0.86,
    tags: ["recovery", "self_compassion", "restart"],
  },
];

function normalizeTriggers(triggerTags?: TriggerTag[]): TriggerTag[] {
  return Array.isArray(triggerTags) ? triggerTags : [];
}

function matchHabit(habits: AdviceHabit[], habitId: AdviceHabit): number {
  if (habits.includes(habitId)) return 40;
  if (habits.includes("any")) return 12;
  return 0;
}

function matchTriggers(adviceTriggers: TriggerTag[], inputTriggers: TriggerTag[]): { score: number; matches: TriggerTag[] } {
  if (!inputTriggers.length) {
    return { score: adviceTriggers.length ? 4 : 0, matches: [] };
  }

  const matches = inputTriggers.filter((tag) => adviceTriggers.includes(tag));
  return {
    score: Math.min(matches.length * 18, 36),
    matches,
  };
}

function matchRisk(riskLevels: RiskLevel[] | undefined, riskLevel: RiskLevel | undefined): number {
  if (!riskLevel || !riskLevels || !riskLevels.length) return 0;
  return riskLevels.includes(riskLevel) ? 10 : 0;
}

function matchTime(timeSegments: AdviceTimeSegment[] | undefined, timeSegment: AdviceTimeSegment | undefined): number {
  if (!timeSegments || !timeSegments.length || !timeSegment) return 0;
  return timeSegments.includes("any") || timeSegments.includes(timeSegment) ? 8 : 0;
}

function verificationPenalty(entry: AdviceEntry, includeUnreviewed: boolean): number {
  if (includeUnreviewed) return 0;
  return entry.verificationStatus === "needs_review" ? -1000 : 0;
}

export function scoreAdvice(entry: AdviceEntry, input: AdviceMatchInput): AdviceMatchResult {
  const triggerTags = normalizeTriggers(input.triggerTags);
  const habitScore = matchHabit(entry.habits, input.habitId);
  const triggerMatch = matchTriggers(entry.triggerTags, triggerTags);
  const score =
    habitScore +
    triggerMatch.score +
    matchRisk(entry.riskLevels, input.riskLevel) +
    matchTime(entry.timeSegments, input.timeSegment) +
    Math.round(entry.confidence * 10) +
    verificationPenalty(entry, Boolean(input.includeUnreviewed));

  return {
    advice: entry,
    score,
    matchedTriggers: triggerMatch.matches,
  };
}

export function matchAdvice(input: AdviceMatchInput, limit = 6): AdviceMatchResult[] {
  return adviceLibrary
    .map((entry) => scoreAdvice(entry, input))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildAdviceBundle(input: AdviceMatchInput): AdviceBundle {
  const matches = matchAdvice(input, 8);
  const primary =
    matches.find((item) => item.advice.kind === "interrupt" || item.advice.kind === "replacement" || item.advice.kind === "planning") ||
    matches[0] ||
    null;
  const reflection =
    matches.find((item) => item.advice.kind === "reflection" || item.advice.kind === "recovery") ||
    null;
  const support = matches.filter((item) => item !== primary && item !== reflection).slice(0, 3);

  return {
    primary,
    support,
    reflection,
  };
}

export { adviceLibrary };
