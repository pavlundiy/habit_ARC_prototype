(function () {
  var CURRENT_STATE_VERSION = 5;
  var STORAGE_KEY = "habit_mvp_shared_state_v3";
  var LEGACY_STORAGE_KEYS = ["habit_demo_shared_state_v1"];
  var CHANNEL_NAME = "habit-demo-sync";
  var channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
  var listeners = [];
  var HABIT_CONFIG_DEFAULTS = {
    smoking: { costPerEpisode: 22, minutesPerEpisode: 7, currencySymbol: "₽" },
    alcohol: { costPerEpisode: 350, minutesPerEpisode: 120, currencySymbol: "₽" },
    sweets: { costPerEpisode: 180, minutesPerEpisode: 18, currencySymbol: "₽" },
    social: { costPerEpisode: 0, minutesPerEpisode: 25, currencySymbol: "₽" },
    overeating: { costPerEpisode: 260, minutesPerEpisode: 35, currencySymbol: "₽" },
    custom: { costPerEpisode: 100, minutesPerEpisode: 15, currencySymbol: "₽" }
  };
  var HABIT_PRESETS = {
    smoking: { id: "smoking", name: "Курение", dailyLimit: 5, unitLabel: "срывов", tipMode: "smoking" },
    alcohol: { id: "alcohol", name: "Алкоголь", dailyLimit: 2, unitLabel: "эпизодов", tipMode: "alcohol" },
    sweets: { id: "sweets", name: "Сладкое", dailyLimit: 3, unitLabel: "эпизодов", tipMode: "sweets" },
    social: { id: "social", name: "Соцсети", dailyLimit: 4, unitLabel: "эпизодов", tipMode: "social" },
    overeating: { id: "overeating", name: "Переедание", dailyLimit: 2, unitLabel: "эпизодов", tipMode: "overeating" },
    custom: { id: "custom", name: "Своя привычка", dailyLimit: 3, unitLabel: "эпизодов", tipMode: "custom" }
  };
  var GUIDANCE_TONES = {
    supportive: { id: "supportive", label: "Поддержка", summary: "мягко и без давления" },
    calm: { id: "calm", label: "Спокойно", summary: "ровно и без лишнего шума" },
    direct: { id: "direct", label: "По делу", summary: "коротко и предельно конкретно" },
    energetic: { id: "energetic", label: "Энергично", summary: "больше импульса и движения" },
    light: { id: "light", label: "Легче", summary: "чуть живее и с мягкой лёгкостью" }
  };

  var ASSESSMENT_OPTIONS = [
    { value: 0, label: "Почти нет" },
    { value: 1, label: "Иногда" },
    { value: 2, label: "Заметно" },
    { value: 3, label: "Часто" },
    { value: 4, label: "Очень сильно" }
  ];
  var ASSESSMENT_QUESTION_SETS = {
    smoking: [
      { id: "morning_pull", title: "Насколько сильно тянет к привычке утром?" },
      { id: "stress_link", title: "Насколько тяга связана со стрессом и напряжением?" },
      { id: "automaticity", title: "Как часто это происходит на автомате?" },
      { id: "failed_attempts", title: "Насколько трудно сократить, когда ты уже решил?" }
    ],
    alcohol: [
      { id: "social_pull", title: "Насколько привычка зависит от компании и обстановки?" },
      { id: "stress_link", title: "Насколько стресс усиливает желание выпить?" },
      { id: "loss_control", title: "Насколько трудно остановиться после начала?" },
      { id: "failed_attempts", title: "Сколько напряжения вызывают попытки сократить?" }
    ],
    sweets: [
      { id: "food_cues", title: "Насколько сильно тянет на сладкое после еды?" },
      { id: "stress_link", title: "Насколько стресс и усталость усиливают этот импульс?" },
      { id: "automaticity", title: "Как часто это происходит без осознанного решения?" },
      { id: "failed_attempts", title: "Насколько трудно вернуться к плану после эпизода?" }
    ],
    social: [
      { id: "free_time_pull", title: "Насколько сильно тянет открыть ленту в свободную минуту?" },
      { id: "night_pull", title: "Насколько привычка усиливается вечером или ночью?" },
      { id: "automaticity", title: "Как часто открываешь приложение на автомате?" },
      { id: "loss_control", title: "Насколько трудно выйти, когда уже начал листать?" }
    ],
    overeating: [
      { id: "body_signal", title: "Насколько часто это не голод, а эмоциональное напряжение?" },
      { id: "after_stress", title: "Насколько стресс или усталость повышают риск переедания?" },
      { id: "automaticity", title: "Как часто это происходит по привычному сценарию?" },
      { id: "failed_attempts", title: "Насколько трудно остановиться или вернуться к плану?" }
    ],
    custom: [
      { id: "frequency_pull", title: "Насколько часто ты чувствуешь тягу к этой привычке?" },
      { id: "stress_link", title: "Насколько сильно стресс и эмоции влияют на неё?" },
      { id: "automaticity", title: "Как часто это происходит на автомате?" },
      { id: "loss_control", title: "Насколько трудно остановиться или сократить?" }
    ]
  };

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function safeParseState(raw) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      var parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function looksLikeHabitState(value) {
    if (!isPlainObject(value)) return false;
    return !!(
      isPlainObject(value.profile) ||
      isPlainObject(value.habitTracks) ||
      Array.isArray(value.slips) ||
      Array.isArray(value.diaryEntries) ||
      isPlainObject(value.meta)
    );
  }

  function assertRestorableState(value) {
    if (!looksLikeHabitState(value)) {
      throw new Error("Invalid habit state payload");
    }
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function formatTime(date) {
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function shiftDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  function dateAt(date, hours, minutes) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  }

  function todayLabel(target) {
    var now = new Date();
    var currentKey = formatDateKey(now);
    var yesterdayKey = formatDateKey(shiftDays(now, -1));
    var targetKey = formatDateKey(target);
    if (targetKey === currentKey) return "сегодня, " + formatTime(target);
    if (targetKey === yesterdayKey) return "вчера, " + formatTime(target);
    return pad(target.getDate()) + "." + pad(target.getMonth() + 1) + ", " + formatTime(target);
  }

  function triggerLabel(tag) {
    var labels = {
      stress: "Стресс",
      boredom: "Скука",
      company: "Компания",
      after_food: "После еды",
      fatigue: "Усталость",
      ritual: "Ритуал",
      other: "Без комментария"
    };
    return labels[tag] || "Без комментария";
  }

  function triggerColor(tag) {
    var colors = {
      stress: "#D85A30",
      boredom: "#EF9F27",
      company: "#7F77DD",
      after_food: "#5DCAA5",
      fatigue: "#B4B2A9",
      ritual: "#0C447C",
      other: "#B4B2A9"
    };
    return colors[tag] || "#B4B2A9";
  }

  function bodySignalLabel(tag) {
    var labels = {
      headache: "Головная боль",
      nausea: "Тошнота",
      palpitations: "Сердцебиение",
      dizziness: "Слабость",
      heaviness: "Тяжесть",
      breath: "Тяжело дышать"
    };
    return labels[tag] || "Телесный сигнал";
  }

  function buildSeedState() {
    var now = new Date();
    var today = startOfDay(now);
    var dayPatterns = {
      0: [],
      1: [13, 15, 18],
      2: [9, 13, 14, 15],
      3: [9, 13, 15],
      4: [13, 15],
      5: [13, 15],
      6: [18]
    };
    var dayTriggers = {
      9: "boredom",
      13: "after_food",
      14: "stress",
      15: "stress",
      18: "company"
    };

    var slips = [];
    for (var delta = -29; delta <= 0; delta += 1) {
      var day = shiftDays(today, delta);
      var weekday = day.getDay();
      var times = dayPatterns[weekday] || [];
      for (var index = 0; index < times.length; index += 1) {
        var hour = times[index];
        var minute = hour === 13 ? 32 : hour === 15 ? 12 : hour === 9 ? 10 : 25;
        var stamp = dateAt(day, hour, minute);
        var tag = dayTriggers[hour] || "stress";
        if (delta === 0) {
          if (hour === 13) {
            hour = 14;
            minute = 32;
            stamp = dateAt(day, hour, minute);
            tag = "stress";
          }
          if (hour === 15 && times.length > 3) continue;
        }
        slips.push({
          id: uid("slip"),
          timestamp: stamp.toISOString(),
          localDate: formatDateKey(stamp),
          localHour: stamp.getHours(),
          triggerTag: tag,
          triggerTags: tag === "after_food" ? ["stress", "after_food"] : [tag],
          cravingLevel: tag === "stress" ? 4 : tag === "company" ? 3 : 2,
          note:
            tag === "stress"
              ? "После напряженного момента"
              : tag === "after_food"
                ? "Сразу после обеда"
                : tag === "company"
                  ? "На автомате в компании"
                  : "Привычный сценарий",
          sourceScreen: "main",
          slipNote: ""
        });
      }
    }

    var todayMorning = slips.filter(function (item) {
      return item.localDate === formatDateKey(today) && item.localHour <= 10;
    });
    if (!todayMorning.length) {
      var fallbackMorning = dateAt(today, 9, 10);
      slips.push({
        id: uid("slip"),
        timestamp: fallbackMorning.toISOString(),
        localDate: formatDateKey(fallbackMorning),
        localHour: fallbackMorning.getHours(),
        triggerTag: "boredom",
        triggerTags: ["boredom", "ritual"],
        cravingLevel: 2,
        note: "Утренний автоматизм",
        sourceScreen: "main",
        slipNote: ""
      });
    }

    slips.sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    var todaySlips = slips.filter(function (item) {
      return item.localDate === formatDateKey(today);
    });
    if (todaySlips[0]) {
      todaySlips[0].slipNote = "Утром это больше привычка рук, чем реальная потребность.";
    }
    if (todaySlips[todaySlips.length - 1]) {
      todaySlips[todaySlips.length - 1].slipNote = "После совещаний всегда хочется сделать паузу и выйти.";
    }

    var diaryEntries = [
      {
        id: uid("entry"),
        timestamp: dateAt(today, 14, 35).toISOString(),
        entryType: "slip_note",
        entryScope: "habit",
        relatedSlipId: todaySlips[todaySlips.length - 1] ? todaySlips[todaySlips.length - 1].id : null,
        tag: "stress",
        text: "После совещания снова захотелось выйти и закурить. Кажется, сигарета для меня стала паузой, а не удовольствием."
      },
      {
        id: uid("entry"),
        timestamp: dateAt(today, 9, 12).toISOString(),
        entryType: "slip_note",
        entryScope: "habit",
        relatedSlipId: todaySlips[0] ? todaySlips[0].id : null,
        tag: "boredom",
        text: "Утром руки сами ищут знакомый ритуал. Если сразу встать и пройтись, тяга становится слабее."
      }
    ];

    return {
      version: CURRENT_STATE_VERSION,
      profile: {
        userName: "Иван",
        initials: "ИВ",
        habitName: "Курение",
        dailyLimit: 5,
        guidanceTone: "supportive",
        starterGoalId: "",
        starterGoalLabel: ""
      },
      slips: slips,
      resisted: [
        {
          id: uid("resist"),
          timestamp: dateAt(shiftDays(today, -1), 13, 15).toISOString(),
          localDate: formatDateKey(shiftDays(today, -1)),
          localHour: 13,
          triggerTags: ["stress", "after_food"],
          cravingLevel: 4,
          copingTool: "walk"
        }
      ],
      diaryEntries: diaryEntries
    };
  }

  function buildEmptyState() {
    var now = new Date().toISOString();
    return {
      version: CURRENT_STATE_VERSION,
      meta: {
        createdAt: now,
        updatedAt: now,
        installMode: "fresh",
        stateVersion: CURRENT_STATE_VERSION
      },
      profile: {
        userName: "Иван",
        initials: "ИВ",
        habitName: "Курение",
        dailyLimit: HABIT_PRESETS.smoking.dailyLimit,
        activeHabitId: "smoking",
        customHabitName: "",
        guidanceTone: "supportive"
      },
      habitTracks: {
        smoking: {
          slips: [],
          resisted: [],
          diaryEntries: [],
          ritualEntries: [],
          ritualClosures: []
        }
      },
      habitAssessments: {
        smoking: null
      },
      habitConfigs: {
        smoking: getDefaultHabitConfig("smoking")
      }
    };
  }

  function inferHabitId(habitName) {
    var name = String(habitName || "").toLowerCase();
    if (name.indexOf("алко") >= 0) return "alcohol";
    if (name.indexOf("слад") >= 0) return "sweets";
    if (name.indexOf("соц") >= 0) return "social";
    if (name.indexOf("переед") >= 0) return "overeating";
    if (name.indexOf("кур") >= 0) return "smoking";
    return "custom";
  }

  function getHabitPreset(habitId) {
    return HABIT_PRESETS[habitId] || HABIT_PRESETS.custom;
  }

  function normalizeGuidanceTone(value) {
    return GUIDANCE_TONES[value] ? value : "supportive";
  }

  function getGuidanceToneConfig(value) {
    return clone(GUIDANCE_TONES[normalizeGuidanceTone(value)]);
  }

  function getGuidanceToneOptions() {
    return Object.keys(GUIDANCE_TONES).map(function (key) {
      return clone(GUIDANCE_TONES[key]);
    });
  }

  function buildHabitList() {
    return Object.keys(HABIT_PRESETS).map(function (key) {
      return clone(HABIT_PRESETS[key]);
    });
  }

  function getAssessmentQuestions(habitId) {
    var items = ASSESSMENT_QUESTION_SETS[habitId] || ASSESSMENT_QUESTION_SETS.custom;
    return items.map(function (item) {
      return {
        id: item.id,
        title: item.title,
        options: clone(ASSESSMENT_OPTIONS)
      };
    });
  }

  function scoreAssessmentAnswers(answers, habitId) {
    var questions = ASSESSMENT_QUESTION_SETS[habitId] || ASSESSMENT_QUESTION_SETS.custom;
    if (!questions.length) return 0;
    var total = 0;
    for (var i = 0; i < questions.length; i += 1) {
      var question = questions[i];
      total += Number(answers && answers[question.id]) || 0;
    }
    return Math.round(total / (questions.length * 4) * 100);
  }

  function getAssessmentSummary(score) {
    if (score >= 75) return "сильная стартовая нагрузка";
    if (score >= 50) return "заметная стартовая нагрузка";
    if (score >= 25) return "умеренная стартовая нагрузка";
    return "мягкая стартовая нагрузка";
  }

  function ensureTrack(state, habitId) {
    state.habitTracks = state.habitTracks || {};
    if (!state.habitTracks[habitId]) {
      state.habitTracks[habitId] = {
        slips: [],
        resisted: [],
        diaryEntries: [],
        ritualEntries: [],
        ritualClosures: []
      };
    }
    return state.habitTracks[habitId];
  }

  function resolveHabitName(profile) {
    var preset = getHabitPreset(profile.activeHabitId);
    if (profile.activeHabitId === "custom" && profile.customHabitName) {
      return profile.customHabitName;
    }
    return preset.name;
  }

  function getDefaultHabitConfig(habitId) {
    var base = clone(HABIT_CONFIG_DEFAULTS[habitId] || HABIT_CONFIG_DEFAULTS.custom);
    base.healthMarkers = {
      sleepHours: null,
      restingHeartRate: null,
      bloodPressureSystolic: null,
      bloodPressureDiastolic: null,
      weightKg: null,
      waistCm: null,
      hba1c: null
    };
    return base;
  }

  function ensureHabitConfig(state, habitId) {
    state.habitConfigs = state.habitConfigs || {};
    if (!state.habitConfigs[habitId]) {
      state.habitConfigs[habitId] = getDefaultHabitConfig(habitId);
    }

    var config = state.habitConfigs[habitId];
    var defaults = getDefaultHabitConfig(habitId);

    if (typeof config.costPerEpisode !== "number" || isNaN(config.costPerEpisode)) {
      config.costPerEpisode = defaults.costPerEpisode;
    }
    if (typeof config.minutesPerEpisode !== "number" || isNaN(config.minutesPerEpisode)) {
      config.minutesPerEpisode = defaults.minutesPerEpisode;
    }
    if (!config.currencySymbol) {
      config.currencySymbol = defaults.currencySymbol;
    }
    config.healthMarkers = config.healthMarkers || {};
    config.healthHistory = Array.isArray(config.healthHistory) ? config.healthHistory : [];
    Object.keys(defaults.healthMarkers).forEach(function (key) {
      if (typeof config.healthMarkers[key] === "undefined") {
        config.healthMarkers[key] = defaults.healthMarkers[key];
      }
    });

    return config;
  }

  function sanitizeMetricNumber(value, decimals) {
    if (value === null || value === undefined || value === "") return null;
    var numeric = Number(value);
    if (!isFinite(numeric)) return null;
    if (typeof decimals === "number") {
      var factor = Math.pow(10, decimals);
      return Math.round(numeric * factor) / factor;
    }
    return Math.round(numeric * 10) / 10;
  }

  function stampMeta(state, mode) {
    state.meta = isPlainObject(state.meta) ? state.meta : {};
    state.meta.createdAt = state.meta.createdAt || new Date().toISOString();
    state.meta.updatedAt = new Date().toISOString();
    state.meta.installMode = state.meta.installMode || mode || "migrated";
    state.meta.stateVersion = CURRENT_STATE_VERSION;
    state.version = CURRENT_STATE_VERSION;
    return state;
  }

  function normalizeState(state) {
    if (!looksLikeHabitState(state)) {
      state = buildEmptyState();
    } else {
      state = clone(state);
    }
    var originalVersion = Number(state.version || (state.meta && state.meta.stateVersion) || 0) || 0;
    state.version = CURRENT_STATE_VERSION;
    state.meta = isPlainObject(state.meta) ? state.meta : {};
    state.meta.stateVersion = CURRENT_STATE_VERSION;
    if (originalVersion && originalVersion !== CURRENT_STATE_VERSION) {
      state.meta.lastMigratedFromVersion = originalVersion;
      state.meta.lastMigratedAt = new Date().toISOString();
    }
    state.profile = isPlainObject(state.profile) ? state.profile : {};
    state.profile.userName = state.profile.userName || "Иван";
    state.profile.initials = state.profile.initials || "ИВ";
    if (state.profile.userName === "РРІР°РЅ") state.profile.userName = "Иван";
    if (state.profile.initials === "РР’") state.profile.initials = "ИВ";
    state.profile.activeHabitId = state.profile.activeHabitId || inferHabitId(state.profile.habitName);
    state.profile.customHabitName = state.profile.customHabitName || "";
    state.profile.guidanceTone = normalizeGuidanceTone(state.profile.guidanceTone);
    state.profile.starterGoalId = String(state.profile.starterGoalId || "").trim();
    state.profile.starterGoalLabel = String(state.profile.starterGoalLabel || "").trim();
    state.habitAssessments = state.habitAssessments || {};
    state.habitConfigs = state.habitConfigs || {};

    if (!state.habitTracks) {
      state.habitTracks = {};
      state.habitTracks[state.profile.activeHabitId] = {
        slips: Array.isArray(state.slips) ? state.slips : [],
        resisted: Array.isArray(state.resisted) ? state.resisted : [],
        diaryEntries: Array.isArray(state.diaryEntries) ? state.diaryEntries : [],
        ritualEntries: Array.isArray(state.ritualEntries) ? state.ritualEntries : [],
        ritualClosures: Array.isArray(state.ritualClosures) ? state.ritualClosures : []
      };
    }

    Object.keys(state.habitTracks).forEach(function (habitId) {
      var track = ensureTrack(state, habitId);
      track.slips = Array.isArray(track.slips) ? track.slips : [];
      track.resisted = Array.isArray(track.resisted) ? track.resisted : [];
      track.ritualEntries = (Array.isArray(track.ritualEntries) ? track.ritualEntries : []).map(function (entry) {
        entry = entry || {};
        var timestamp = entry.timestamp || new Date().toISOString();
        var stampDate = new Date(timestamp);
        return {
          id: entry.id || uid("ritual"),
          type: entry.type === "evening" ? "evening" : "morning",
          text: String(entry.text || "").trim(),
          timestamp: timestamp,
          localDate: entry.localDate || formatDateKey(stampDate)
        };
      }).filter(function (entry) {
        return entry.text;
      });
      track.ritualClosures = (Array.isArray(track.ritualClosures) ? track.ritualClosures : []).map(function (entry) {
        entry = entry || {};
        var timestamp = entry.timestamp || new Date().toISOString();
        var stampDate = new Date(timestamp);
        return {
          id: entry.id || uid("ritual_close"),
          status: entry.status === "yes" || entry.status === "partial" || entry.status === "present"
            ? entry.status
            : "present",
          note: String(entry.note || "").trim(),
          timestamp: timestamp,
          localDate: entry.localDate || formatDateKey(stampDate)
        };
      });
      track.diaryEntries = (Array.isArray(track.diaryEntries) ? track.diaryEntries : []).map(function (entry) {
        entry = entry || {};
        entry.entryScope = entry.entryScope === "state" || entry.entryType === "state_note" ? "state" : "habit";
        entry.entryType = entry.entryType || (entry.entryScope === "state" ? "state_note" : "free_note");
        entry.tag = entry.tag || null;
        entry.triggerTags = Array.isArray(entry.triggerTags)
          ? entry.triggerTags.filter(Boolean).slice(0, 4)
          : (entry.tag ? [entry.tag] : []);
        entry.bodySignals = Array.isArray(entry.bodySignals)
          ? entry.bodySignals.filter(Boolean).slice(0, 4)
          : [];
        entry.contextTags = Array.isArray(entry.contextTags) ? entry.contextTags.filter(Boolean) : [];
        entry.moodScore = entry.entryScope === "state" ? sanitizeMetricNumber(entry.moodScore, 0) : null;
        entry.energyScore = entry.entryScope === "state" ? sanitizeMetricNumber(entry.energyScore, 0) : null;
        entry.stressScore = entry.entryScope === "state" ? sanitizeMetricNumber(entry.stressScore, 0) : null;
        entry.ritualAnchorText = String(entry.ritualAnchorText || "").trim();
        entry.ritualAnchorDate = String(entry.ritualAnchorDate || "").trim();
        if (entry.moodScore != null) entry.moodScore = Math.max(1, Math.min(5, entry.moodScore));
        if (entry.energyScore != null) entry.energyScore = Math.max(1, Math.min(5, entry.energyScore));
        if (entry.stressScore != null) entry.stressScore = Math.max(1, Math.min(5, entry.stressScore));
        return entry;
      });
      if (typeof state.habitAssessments[habitId] === "undefined") {
        state.habitAssessments[habitId] = null;
      }
      ensureHabitConfig(state, habitId);
    });

    ensureTrack(state, state.profile.activeHabitId);
    ensureHabitConfig(state, state.profile.activeHabitId);
    if (typeof state.habitAssessments[state.profile.activeHabitId] === "undefined") {
      state.habitAssessments[state.profile.activeHabitId] = null;
    }
    state.profile.habitName = resolveHabitName(state.profile);
    state.profile.dailyLimit = Number(state.profile.dailyLimit) || getHabitPreset(state.profile.activeHabitId).dailyLimit;

    delete state.slips;
    delete state.resisted;
    delete state.diaryEntries;
    delete state.ritualEntries;
    delete state.ritualClosures;

    return state;
  }

  function buildPublicState(state) {
    var normalized = normalizeState(state);
    var preset = getHabitPreset(normalized.profile.activeHabitId);
    var track = ensureTrack(normalized, normalized.profile.activeHabitId);
    var assessment = normalized.habitAssessments[normalized.profile.activeHabitId];
    var config = ensureHabitConfig(normalized, normalized.profile.activeHabitId);

    normalized.profile.habitName = resolveHabitName(normalized.profile);
    normalized.profile.dailyLimit = Number(normalized.profile.dailyLimit) || preset.dailyLimit;
    normalized.currentHabit = {
      id: normalized.profile.activeHabitId,
      name: normalized.profile.habitName,
      unitLabel: preset.unitLabel,
      tipMode: preset.tipMode,
      dailyLimit: normalized.profile.dailyLimit,
      assessmentComplete: !!assessment,
      assessmentScore: assessment ? assessment.score : null,
      assessmentSummary: assessment ? getAssessmentSummary(assessment.score) : "опрос не заполнен"
    };
    normalized.habits = buildHabitList();
    normalized.assessment = assessment ? clone(assessment) : null;
    normalized.slips = clone(track.slips);
    normalized.resisted = clone(track.resisted);
    normalized.ritualEntries = clone(track.ritualEntries || []);
    normalized.ritualClosures = clone(track.ritualClosures || []);
    normalized.diaryEntries = clone(track.diaryEntries);
    normalized.habitDiaryEntries = clone(track.diaryEntries.filter(function (entry) {
      return entry.entryScope !== "state";
    }));
    normalized.stateEntries = clone(track.diaryEntries.filter(function (entry) {
      return entry.entryScope === "state";
    }));
    normalized.meta = clone(normalized.meta || {});

    return normalized;
  }

  function readLegacyState() {
    for (var index = 0; index < LEGACY_STORAGE_KEYS.length; index += 1) {
      try {
        var legacyKey = LEGACY_STORAGE_KEYS[index];
        var raw = localStorage.getItem(legacyKey);
        if (!raw) continue;
        var parsed = safeParseState(raw);
        if (!parsed) continue;
        parsed.meta = parsed.meta || {};
        parsed.meta.installMode = "migrated_demo";
        return parsed;
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return readLegacyState();
      return safeParseState(raw) || readLegacyState();
    } catch (error) {
      return readLegacyState();
    }
  }

  function writeState(state, silent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stampMeta(normalizeState(state))));
    LEGACY_STORAGE_KEYS.forEach(function (key) {
      if (key !== STORAGE_KEY) {
        localStorage.removeItem(key);
      }
    });
    if (!silent) publish();
  }

  function getState() {
    var raw = readState();
    var normalized = normalizeState(raw);
    if (!raw || raw.version !== CURRENT_STATE_VERSION || !raw.habitTracks || !raw.profile || !raw.profile.activeHabitId) {
      writeState(normalized, true);
    }
    return buildPublicState(normalized);
  }

  function setState(mutator) {
    var state = normalizeState(readState());
    var nextState = mutator(state) || state;
    writeState(nextState, false);
    return buildPublicState(nextState);
  }

  function publish() {
    var snapshot = getState();
    if (channel) channel.postMessage({ type: "state-updated" });
    listeners.forEach(function (listener) {
      listener(snapshot);
    });
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function () {
      listeners = listeners.filter(function (item) {
        return item !== listener;
      });
    };
  }

  if (channel) {
    channel.onmessage = function () {
      var snapshot = getState();
      listeners.forEach(function (listener) {
        listener(snapshot);
      });
    };
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY) return;
    var snapshot = getState();
    listeners.forEach(function (listener) {
      listener(snapshot);
    });
  });

  function recordSlip(payload) {
    payload = payload || {};
    return setState(function (state) {
      var now = payload.timestamp ? new Date(payload.timestamp) : new Date();
      var track = ensureTrack(state, state.profile.activeHabitId);
      track.slips.push({
        id: uid("slip"),
        timestamp: now.toISOString(),
        localDate: formatDateKey(now),
        localHour: now.getHours(),
        triggerTag: payload.triggerTag || "stress",
        triggerTags: payload.triggerTags || [payload.triggerTag || "stress"],
        bodySignals: Array.isArray(payload.bodySignals) ? payload.bodySignals.filter(Boolean).slice(0, 4) : [],
        cravingLevel: payload.cravingLevel || 4,
        note: payload.note || "Зафиксировано на главном экране",
        sourceScreen: payload.sourceScreen || "main",
        slipNote: ""
      });
      return state;
    });
  }

  function recordResisted(payload) {
    payload = payload || {};
    return setState(function (state) {
      var now = payload.timestamp ? new Date(payload.timestamp) : new Date();
      var track = ensureTrack(state, state.profile.activeHabitId);
      track.resisted.push({
        id: uid("resist"),
        timestamp: now.toISOString(),
        localDate: formatDateKey(now),
        localHour: now.getHours(),
        triggerTags: payload.triggerTags || ["stress"],
        cravingLevel: payload.cravingLevel || 3,
        copingTool: payload.copingTool || "walk"
      });
      return state;
    });
  }

  function addDiaryEntry(payload) {
    return setState(function (state) {
      var now = payload.timestamp ? new Date(payload.timestamp) : new Date();
      var track = ensureTrack(state, state.profile.activeHabitId);
      track.diaryEntries.unshift({
        id: uid("entry"),
        timestamp: now.toISOString(),
        entryType: payload.entryType || "free_note",
        entryScope: payload.entryScope === "state" ? "state" : "habit",
        relatedSlipId: payload.relatedSlipId || null,
        tag: payload.tag || null,
        triggerTags: Array.isArray(payload.triggerTags)
          ? payload.triggerTags.filter(Boolean).slice(0, 4)
          : (payload.tag ? [payload.tag] : []),
        bodySignals: Array.isArray(payload.bodySignals)
          ? payload.bodySignals.filter(Boolean).slice(0, 4)
          : [],
        text: payload.text,
        contextTags: Array.isArray(payload.contextTags) ? payload.contextTags.filter(Boolean).slice(0, 4) : [],
        ritualAnchorText: String(payload.ritualAnchorText || "").trim(),
        ritualAnchorDate: String(payload.ritualAnchorDate || "").trim(),
        moodScore: payload.entryScope === "state" ? Math.max(1, Math.min(5, sanitizeMetricNumber(payload.moodScore, 0) || 3)) : null,
        energyScore: payload.entryScope === "state" ? Math.max(1, Math.min(5, sanitizeMetricNumber(payload.energyScore, 0) || 3)) : null,
        stressScore: payload.entryScope === "state" ? Math.max(1, Math.min(5, sanitizeMetricNumber(payload.stressScore, 0) || 3)) : null
      });
      return state;
    });
  }

  function saveRitualEntry(payload) {
    payload = payload || {};
    return setState(function (state) {
      var now = payload.timestamp ? new Date(payload.timestamp) : new Date();
      var track = ensureTrack(state, state.profile.activeHabitId);
      track.ritualEntries = Array.isArray(track.ritualEntries) ? track.ritualEntries : [];
      var type = payload.type === "evening" ? "evening" : "morning";
      var text = String(payload.text || "").trim();
      if (!text) return state;
      var localDate = formatDateKey(now);
      var existing = track.ritualEntries.find(function (entry) {
        return entry.localDate === localDate && entry.type === type;
      });
      if (existing) {
        existing.text = text;
        existing.timestamp = now.toISOString();
      } else {
        track.ritualEntries.unshift({
          id: uid("ritual"),
          type: type,
          text: text,
          timestamp: now.toISOString(),
          localDate: localDate
        });
      }
      return state;
    });
  }

  function saveRitualClosure(payload) {
    payload = payload || {};
    return setState(function (state) {
      var now = payload.timestamp ? new Date(payload.timestamp) : new Date();
      var track = ensureTrack(state, state.profile.activeHabitId);
      track.ritualClosures = Array.isArray(track.ritualClosures) ? track.ritualClosures : [];
      var status = payload.status === "yes" || payload.status === "partial" || payload.status === "present"
        ? payload.status
        : null;
      var localDate = String(payload.localDate || "").trim();
      if (!status || !localDate) return state;
      var note = String(payload.note || "").trim();
      var existing = track.ritualClosures.find(function (entry) {
        return entry.localDate === localDate;
      });
      if (existing) {
        existing.status = status;
        existing.note = note;
        existing.timestamp = now.toISOString();
      } else {
        track.ritualClosures.unshift({
          id: uid("ritual_close"),
          status: status,
          note: note,
          timestamp: now.toISOString(),
          localDate: localDate
        });
      }
      return state;
    });
  }

  function addSlipNote(slipId, text) {
    return setState(function (state) {
      var track = ensureTrack(state, state.profile.activeHabitId);
      var target = track.slips.find(function (item) {
        return item.id === slipId;
      });
      if (target) target.slipNote = text;
      track.diaryEntries.unshift({
        id: uid("entry"),
        timestamp: new Date().toISOString(),
        entryType: "slip_note",
        entryScope: "habit",
        relatedSlipId: slipId,
        tag: target ? target.triggerTag : "other",
        triggerTags: target && Array.isArray(target.triggerTags) && target.triggerTags.length
          ? target.triggerTags.slice(0, 4)
          : [target ? target.triggerTag : "other"],
        text: text,
        contextTags: [],
        moodScore: null,
        energyScore: null,
        stressScore: null
      });
      return state;
    });
  }

  function getTodaySlipCount(state) {
    var snapshot = state || getState();
    var todayKey = formatDateKey(new Date());
    return snapshot.slips.filter(function (item) {
      return item.localDate === todayKey;
    }).length;
  }

  function getRecentSlips(limit) {
    var snapshot = getState();
    return clone(snapshot.slips)
      .sort(function (a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
      })
      .slice(0, limit || 20);
  }

  function getRecentDiaryEntries(limit) {
    var snapshot = getState();
    return clone(snapshot.diaryEntries)
      .sort(function (a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
      })
      .slice(0, limit || 20);
  }

  function getSetupProgress(snapshot) {
    var state = snapshot || getState();
    var config = (state.currentHabit && state.currentHabit.config) || state.habitConfig || getDefaultHabitConfig(state.currentHabit.id);
    var defaults = getDefaultHabitConfig(state.currentHabit.id);
    var health = (config && config.healthMarkers) || {};
    var healthFilled = Object.keys(health).some(function (key) {
      return health[key] !== null && health[key] !== undefined && health[key] !== "";
    });
    var hasContext = healthFilled ||
      config.costPerEpisode !== defaults.costPerEpisode ||
      config.minutesPerEpisode !== defaults.minutesPerEpisode ||
      config.currencySymbol !== defaults.currencySymbol;

    var steps = [
      {
        id: "first_event",
        title: "Сделай первую запись",
        sub: "Зафиксируй срыв, удержание или первую мысль, чтобы приложение увидело твой реальный ритм.",
        done: (state.slips.length + state.resisted.length + state.diaryEntries.length + state.ritualEntries.length) > 0
      },
      {
        id: "assessment",
        title: "Пройди стартовый опрос",
        sub: "Четыре коротких вопроса помогут точнее настроить аналитику под тебя.",
        done: !!state.currentHabit.assessmentComplete
      },
      {
        id: "context",
        title: "Добавь личный контекст",
        sub: "Цена эпизода, время или health markers сделают картину привычки более живой.",
        done: hasContext
      }
    ];

    var completed = steps.filter(function (item) { return item.done; }).length;
    return {
      steps: steps,
      completed: completed,
      total: steps.length,
      progress: Math.round(completed / steps.length * 100),
      nextStep: steps.find(function (item) { return !item.done; }) || null
    };
  }

  function getFirstWeekJourney(snapshot) {
    var state = snapshot || getState();
    var activityCount = state.slips.length + state.resisted.length + state.diaryEntries.length;
    if (!activityCount) {
      return {
        active: false,
        progress: 0,
        completed: 0,
        total: 4,
        dayNumber: 0,
        daysLeft: 7,
        milestones: [],
        nextMilestone: null,
        headline: "",
        narrative: "",
        stageLabel: ""
      };
    }

    var timestamps = [];
    state.slips.forEach(function (item) { timestamps.push(new Date(item.timestamp)); });
    state.resisted.forEach(function (item) { timestamps.push(new Date(item.timestamp)); });
    state.diaryEntries.forEach(function (item) { timestamps.push(new Date(item.timestamp)); });
    timestamps.sort(function (left, right) { return left - right; });

    var startedAt = timestamps[0] || new Date(state.meta && state.meta.createdAt ? state.meta.createdAt : new Date());
    var now = new Date();
    var dayNumber = Math.max(1, Math.floor((startOfDay(now) - startOfDay(startedAt)) / (24 * 60 * 60 * 1000)) + 1);
    var distinctDaysMap = {};

    state.slips.forEach(function (item) { distinctDaysMap[item.localDate] = true; });
    state.resisted.forEach(function (item) { distinctDaysMap[item.localDate] = true; });
    state.diaryEntries.forEach(function (item) {
      distinctDaysMap[formatDateKey(new Date(item.timestamp))] = true;
    });

    var activityDays = Object.keys(distinctDaysMap).length;
    var hasReflection = state.diaryEntries.length > 0 || state.slips.some(function (item) {
      return !!String(item.slipNote || "").trim();
    });
    var milestones = [
      {
        id: "first_signal",
        title: "Первый честный сигнал",
        shortTitle: "Первый сигнал",
        sub: "Привычка уже перестала быть абстракцией: у тебя есть первый живой момент в приложении.",
        done: activityCount > 0
      },
      {
        id: "first_reflection",
        title: "Первая мысль рядом с событием",
        shortTitle: "Первая мысль",
        sub: "Когда рядом с событием появляется текст, приложение начинает видеть не только факт, но и причину.",
        done: hasReflection
      },
      {
        id: "return_day_two",
        title: "Возврат на другой день",
        shortTitle: "Возврат на другой день",
        sub: "Самый ценный сигнал первой недели: ты вернулся не один раз, а уже начал показывать реальный ритм.",
        done: activityDays >= 2
      },
      {
        id: "support_moment",
        title: "Хотя бы одно удержание",
        shortTitle: "Одно удержание",
        sub: "Даже один удержанный момент показывает, что у тебя есть не только автоматизм, но и пространство для выбора.",
        done: state.resisted.length > 0
      }
    ];
    var completed = milestones.filter(function (item) { return item.done; }).length;
    var progress = Math.round(completed / milestones.length * 100);
    var nextMilestone = milestones.find(function (item) { return !item.done; }) || null;
    var headline = "Первая неделя только начинается";
    var narrative = "Сейчас важнее честность и повторяемость, чем идеальные дни.";
    var stageLabel = "первые сигналы";

    if (completed >= 4) {
      headline = "Первая неделя уже собирает опору";
      narrative = "У тебя есть и события, и возвращение, и хотя бы один момент удержания. На такой базе инсайты становятся заметно живее.";
      stageLabel = "неделя оживает";
    } else if (completed === 3) {
      headline = "Ритм уже начинает проявляться";
      narrative = "Приложение видит не один случайный эпизод, а повторяющийся сценарий. Ещё немного, и первая неделя даст устойчивую картину.";
      stageLabel = "ритм проявляется";
    } else if (completed === 2) {
      headline = "Уже появляется контекст";
      narrative = "У тебя есть первые сигналы и первые пояснения к ним. Это лучший момент не оценивать себя, а просто продолжать замечать.";
      stageLabel = "контекст собирается";
    }

    return {
      active: dayNumber <= 7,
      progress: progress,
      completed: completed,
      total: milestones.length,
      dayNumber: Math.min(dayNumber, 7),
      daysLeft: Math.max(0, 7 - dayNumber),
      activityDays: activityDays,
      activityCount: activityCount,
      milestones: milestones,
      nextMilestone: nextMilestone,
      headline: headline,
      narrative: narrative,
      stageLabel: stageLabel
    };
  }

  function getFirstWeekSupport(snapshot) {
    var state = snapshot || getState();
    var journey = getFirstWeekJourney(state);
    if (!journey.active && !journey.completed) {
      return {
        celebration: null,
        review: null
      };
    }

    var timestamps = [];
    state.slips.forEach(function (item) { timestamps.push({ type: "slip", timestamp: new Date(item.timestamp), localDate: item.localDate }); });
    state.resisted.forEach(function (item) { timestamps.push({ type: "resisted", timestamp: new Date(item.timestamp), localDate: item.localDate }); });
    state.diaryEntries.forEach(function (item) {
      timestamps.push({ type: "diary", timestamp: new Date(item.timestamp), localDate: formatDateKey(new Date(item.timestamp)) });
    });
    timestamps.sort(function (left, right) { return left.timestamp - right.timestamp; });

    var uniqueDays = [];
    var dayMap = {};
    timestamps.forEach(function (item) {
      if (item.localDate && !dayMap[item.localDate]) {
        dayMap[item.localDate] = true;
        uniqueDays.push(item);
      }
    });

    var celebrationCandidates = [];
    if (timestamps[0]) {
      celebrationCandidates.push({
        id: "first_signal",
        title: "Первый честный сигнал уже есть",
        text: "Это хороший старт: привычка перестала быть общей тревогой и стала наблюдаемым моментом.",
        timestamp: timestamps[0].timestamp
      });
    }
    if (state.diaryEntries.length) {
      var firstReflection = state.diaryEntries
        .map(function (item) { return new Date(item.timestamp); })
        .sort(function (left, right) { return left - right; })[0];
      celebrationCandidates.push({
        id: "first_reflection",
        title: "Появилась первая личная мысль",
        text: "Самая сильная часть первых дней: ты начал замечать не только событие, но и то, что за ним стоит.",
        timestamp: firstReflection
      });
    }
    if (uniqueDays[1]) {
      celebrationCandidates.push({
        id: "return_day_two",
        title: "Ты вернулся на другой день",
        text: "Это уже не случайная запись. У приложения появляется реальный ритм, а у тебя - опора на повторяемость.",
        timestamp: uniqueDays[1].timestamp
      });
    }
    if (state.resisted.length) {
      var firstResisted = state.resisted
        .map(function (item) { return new Date(item.timestamp); })
        .sort(function (left, right) { return left - right; })[0];
      celebrationCandidates.push({
        id: "support_moment",
        title: "Есть первый момент удержания",
        text: "Даже один такой момент важен: он показывает, что в сценарии уже есть пространство для выбора.",
        timestamp: firstResisted
      });
    }

    var now = new Date();
    var celebration = celebrationCandidates
      .filter(function (item) {
        return (now - item.timestamp) <= 48 * 60 * 60 * 1000;
      })
      .sort(function (left, right) {
        return right.timestamp - left.timestamp;
      })[0] || null;

    var reviewHeadline = "Неделя только собирает основу";
    var reviewText = "Сейчас важнее не идеальные дни, а несколько честных сигналов в разных состояниях.";
    if (state.resisted.length > 0) {
      reviewHeadline = "Уже есть не только автоматизм, но и выбор";
      reviewText = "В первой неделе особенно ценно, что появились удержанные моменты. Это хороший признак для будущего плана.";
    } else if (state.diaryEntries.length > 0) {
      reviewHeadline = "Неделя уже даёт не только цифры, но и смысл";
      reviewText = "Записи рядом с событиями помогают быстрее увидеть паттерн: где привычка про ритуал, а где про напряжение.";
    } else if (journey.activityDays >= 2) {
      reviewHeadline = "Начинает проявляться ритм";
      reviewText = "Уже видно, что это не один случайный день. Ещё немного данных, и выводы станут заметно увереннее.";
    }

    return {
      celebration: celebration,
      review: {
        headline: reviewHeadline,
        text: reviewText,
        signals: journey.activityCount,
        days: journey.activityDays,
        resisted: state.resisted.length,
        notes: state.diaryEntries.length
      }
    };
  }

  function getCurrentHabitConfig(snapshot) {
    var state = snapshot || getState();
    var habitId = state && state.currentHabit && state.currentHabit.id
      ? state.currentHabit.id
      : (state && state.profile && state.profile.activeHabitId) || "smoking";
    return clone((state.currentHabit && state.currentHabit.config) || state.habitConfig || getDefaultHabitConfig(habitId));
  }

  function getCurrentTrackSummary(snapshot) {
    var state = snapshot || getState();
    return {
      slips: clone(state.slips || []),
      resisted: clone(state.resisted || []),
      diaryEntries: clone(state.diaryEntries || []),
      habitDiaryEntries: clone(state.habitDiaryEntries || []),
      stateEntries: clone(state.stateEntries || [])
    };
  }

  function getDiarySummary(snapshot) {
    var track = getCurrentTrackSummary(snapshot);
    var resistedCount = Array.isArray(track.resisted) ? track.resisted.length : 0;
    var habitCount = track.habitDiaryEntries.length + resistedCount;
    var totalCount = track.diaryEntries.length + resistedCount;
    return {
      totalCount: totalCount,
      habitCount: habitCount,
      stateCount: track.stateEntries.length,
      hasEntries: totalCount > 0
    };
  }

  function getStatusMessage(key, payload) {
    payload = payload || {};
    var habitName = payload.habitName || "активная привычка";
    var messages = {
      finance_saved: "Финансы и health markers сохранены для активной привычки.",
      export_json_saved: "JSON выгружен. Внутри дневник, события и аналитика по активной привычке.",
      export_report_saved: "Отчёт выгружен. Его удобно читать самому или отправить специалисту.",
      backup_saved: "Полная резервная копия приложения сохранена. Её можно восстановить позже на этом же устройстве.",
      restore_invalid_backup: "Этот файл не похож на резервную копию приложения. Выбери JSON, который был выгружен из Habit Tracker.",
      restore_failed: "Не удалось восстановить резервную копию. Попробуй выбрать файл ещё раз.",
      restore_parse_failed: "Не удалось восстановить файл. Проверь, что это JSON-резервная копия приложения.",
      restore_read_failed: "Не удалось прочитать файл. Попробуй выбрать резервную копию ещё раз.",
      restore_success: "Резервная копия восстановлена. Экран уже обновлён под новые данные.",
      ai_prompt_ready: "Пакет для ИИ собран. Перед отправкой можно просмотреть и скопировать текст.",
      ai_prompt_copied: "Текст для ИИ скопирован. Теперь его можно вставить в любой чат.",
      ai_prompt_copy_failed: "Не удалось скопировать автоматически. Можно скачать .txt или скопировать текст вручную.",
      ai_prompt_saved: "Текст для ИИ сохранён в .txt. Его можно загрузить или вставить позже.",
      reset_habit_done: "Активная привычка \"" + habitName + "\" очищена. Можно начать трек заново.",
      ai_response_saved: "Ответ ИИ сохранён. Теперь краткий разбор и действия доступны в профиле."
    };
    return messages[key] || "";
  }

  function getStatusTone(key) {
    var tones = {
      finance_saved: "success",
      export_json_saved: "success",
      export_report_saved: "success",
      backup_saved: "success",
      restore_success: "success",
      ai_prompt_ready: "neutral",
      ai_prompt_copied: "success",
      ai_prompt_copy_failed: "error",
      ai_prompt_saved: "success",
      reset_habit_done: "success",
      ai_response_saved: "success",
      restore_invalid_backup: "error",
      restore_failed: "error",
      restore_parse_failed: "error",
      restore_read_failed: "error"
    };
    return tones[key] || "neutral";
  }

  function exportRawState() {
    var normalized = normalizeState(readState());
    return stampMeta(normalized, normalized.meta && normalized.meta.installMode);
  }

  function replaceState(nextState) {
    assertRestorableState(nextState);
    var normalized = normalizeState(nextState);
    writeState(normalized, false);
    return buildPublicState(normalized);
  }

  function tryReplaceState(nextState) {
    try {
      return {
        ok: true,
        snapshot: replaceState(nextState),
        errorCode: null
      };
    } catch (error) {
      var errorCode = error && /Invalid habit state payload/.test(String(error.message || error))
        ? "invalid_backup"
        : "restore_failed";
      return {
        ok: false,
        snapshot: null,
        errorCode: errorCode
      };
    }
  }

  function resetActiveHabitData() {
    return setState(function (state) {
      var habitId = state.profile.activeHabitId;
        state.habitTracks[habitId] = {
          slips: [],
          resisted: [],
          diaryEntries: [],
          ritualEntries: [],
          ritualClosures: []
        };
      state.habitAssessments[habitId] = null;
      state.habitConfigs[habitId] = getDefaultHabitConfig(habitId);
      return state;
    });
  }

  function seedDemoData() {
    var seeded = normalizeState(buildSeedState());
    seeded.meta = seeded.meta || {};
    seeded.meta.installMode = "seeded_demo";
    writeState(seeded, false);
    return buildPublicState(seeded);
  }

  function setInstallMode(mode) {
    return setState(function (state) {
      state.meta = state.meta || {};
      state.meta.installMode = mode || "active";
      return state;
    });
  }

  function setGuidanceTone(tone) {
    return setState(function (state) {
      state.profile = state.profile || {};
      state.profile.guidanceTone = normalizeGuidanceTone(tone);
      return state;
    });
  }

  function setStarterGoal(payload) {
    payload = payload || {};
    return setState(function (state) {
      state.profile = state.profile || {};
      state.profile.starterGoalId = String(payload.id || "").trim();
      state.profile.starterGoalLabel = String(payload.label || "").trim();
      return state;
    });
  }

  function completeOnboarding(payload) {
    payload = payload || {};
    return setState(function (state) {
      state.meta = state.meta || {};
      state.meta.installMode = payload.installMode || "active";
      state.meta.onboardingCompletedAt = payload.completedAt || new Date().toISOString();
      state.meta.onboardingVersion = 1;
      return state;
    });
  }

  function selectHabit(habitId, customName) {
    return setState(function (state) {
      var nextHabitId = HABIT_PRESETS[habitId] ? habitId : "custom";
      var preset = getHabitPreset(nextHabitId);
      state.profile.activeHabitId = nextHabitId;
      state.profile.customHabitName = nextHabitId === "custom" ? String(customName || "").trim() : "";
      state.profile.habitName = nextHabitId === "custom" && state.profile.customHabitName
        ? state.profile.customHabitName
        : preset.name;
      state.profile.dailyLimit = preset.dailyLimit;
      ensureTrack(state, nextHabitId);
      return state;
    });
  }

  function saveAssessment(payload) {
    payload = payload || {};
    return setState(function (state) {
      var habitId = payload.habitId || state.profile.activeHabitId;
      var answers = clone(payload.answers || {});
      state.habitAssessments[habitId] = {
        habitId: habitId,
        answers: answers,
        score: scoreAssessmentAnswers(answers, habitId),
        completedAt: new Date().toISOString()
      };
      return state;
    });
  }

  window.HabitStore = {
    getState: getState,
    subscribe: subscribe,
    recordSlip: recordSlip,
    recordResisted: recordResisted,
      saveRitualEntry: saveRitualEntry,
      saveRitualClosure: saveRitualClosure,
    addDiaryEntry: addDiaryEntry,
    addSlipNote: addSlipNote,
    selectHabit: selectHabit,
    saveAssessment: saveAssessment,
    getTodaySlipCount: getTodaySlipCount,
    getRecentSlips: getRecentSlips,
    getRecentDiaryEntries: getRecentDiaryEntries,
    exportRawState: exportRawState,
    replaceState: replaceState,
    tryReplaceState: tryReplaceState,
    resetActiveHabitData: resetActiveHabitData,
    seedDemoData: seedDemoData,
    setInstallMode: setInstallMode,
    setGuidanceTone: setGuidanceTone,
    setStarterGoal: setStarterGoal,
    completeOnboarding: completeOnboarding,
    helpers: {
      formatDateKey: formatDateKey,
      formatTime: formatTime,
      todayLabel: todayLabel,
      triggerLabel: triggerLabel,
      bodySignalLabel: bodySignalLabel,
      triggerColor: triggerColor,
      getHabitPreset: getHabitPreset,
      getAssessmentQuestions: getAssessmentQuestions,
      getSetupProgress: getSetupProgress,
      getFirstWeekJourney: getFirstWeekJourney,
      getFirstWeekSupport: getFirstWeekSupport,
      getCurrentHabitConfig: getCurrentHabitConfig,
      getCurrentTrackSummary: getCurrentTrackSummary,
      getDiarySummary: getDiarySummary,
      getGuidanceToneOptions: getGuidanceToneOptions,
      getGuidanceToneConfig: getGuidanceToneConfig,
      getStatusMessage: getStatusMessage,
      getStatusTone: getStatusTone
    }
  };

  var baseGetState = window.HabitStore.getState;
  window.HabitStore.getState = function () {
    var raw = normalizeState(readState());
    ensureHabitConfig(raw, raw.profile.activeHabitId);
    var snapshot = baseGetState();
    var config = clone(raw.habitConfigs[raw.profile.activeHabitId] || getDefaultHabitConfig(raw.profile.activeHabitId));
    snapshot.currentHabit.config = config;
    snapshot.habitConfig = config;
    return snapshot;
  };

  window.HabitStore.saveHabitConfig = function (payload) {
    payload = payload || {};
    return setState(function (state) {
      var habitId = payload.habitId || state.profile.activeHabitId;
      var config = ensureHabitConfig(state, habitId);
      if (typeof payload.costPerEpisode !== "undefined") {
        config.costPerEpisode = Math.max(0, sanitizeMetricNumber(payload.costPerEpisode, 2) || 0);
      }
      if (typeof payload.minutesPerEpisode !== "undefined") {
        config.minutesPerEpisode = Math.max(0, sanitizeMetricNumber(payload.minutesPerEpisode, 1) || 0);
      }
      if (typeof payload.currencySymbol === "string" && payload.currencySymbol.trim()) {
        config.currencySymbol = payload.currencySymbol.trim().slice(0, 4);
      }
      return state;
    });
  };

  window.HabitStore.saveHealthMarkers = function (payload) {
    payload = payload || {};
    return setState(function (state) {
      var habitId = payload.habitId || state.profile.activeHabitId;
      var config = ensureHabitConfig(state, habitId);
      var markers = payload.markers || {};
      var nextMarkers = clone(config.healthMarkers);
      Object.keys(config.healthMarkers).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(markers, key)) {
          nextMarkers[key] = sanitizeMetricNumber(markers[key], key === "hba1c" || key === "sleepHours" ? 1 : 0);
        }
      });
      config.healthMarkers = nextMarkers;
      config.healthHistory = Array.isArray(config.healthHistory) ? config.healthHistory : [];
      config.healthHistory.push({
        savedAt: new Date().toISOString(),
        markers: clone(nextMarkers)
      });
      if (config.healthHistory.length > 24) {
        config.healthHistory = config.healthHistory.slice(-24);
      }
      return state;
    });
  };

  window.HabitStore.helpers.getDefaultHabitConfig = getDefaultHabitConfig;
})();
