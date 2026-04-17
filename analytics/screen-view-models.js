(function () {
  function analytics(period) {
    if (window.HabitAnalytics && typeof window.HabitAnalytics.getInsightViewModel === "function") {
      return window.HabitAnalytics.getInsightViewModel(period);
    }
    return {};
  }

  function getSetupModel(state) {
    if (window.HabitUiFlow && window.HabitUiFlow.getSetupModel) {
      return window.HabitUiFlow.getSetupModel(state);
    }
    return { steps: [], completed: 0, total: 3, progress: 0, nextStep: null };
  }

  function getFirstWeekModel(state) {
    if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekModel) {
      return window.HabitUiFlow.getFirstWeekModel(state);
    }
    return { active: false, milestones: [], completed: 0, total: 4, progress: 0, nextMilestone: null };
  }

  function getFirstWeekSupport(state) {
    if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekSupport) {
      return window.HabitUiFlow.getFirstWeekSupport(state);
    }
    return { celebration: null, review: null };
  }

  function getCurrentHabitConfig(state) {
    if (window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getCurrentHabitConfig) {
      return window.HabitStore.helpers.getCurrentHabitConfig(state);
    }
    return (state.currentHabit && state.currentHabit.config) || state.habitConfig || { minutesPerEpisode: 0, currencySymbol: "₽" };
  }

  function buildPhysicalSignalsModel(state) {
    var label = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.bodySignalLabel
      ? window.HabitStore.helpers.bodySignalLabel
      : function (tag) { return tag; };
    var counts = {};
    (state.slips || []).forEach(function (item) {
      (item.bodySignals || []).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    (state.diaryEntries || []).forEach(function (entry) {
      (entry.bodySignals || []).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    var top = Object.keys(counts).sort(function (left, right) {
      return counts[right] - counts[left];
    }).slice(0, 3).map(function (tag) {
      return {
        key: tag,
        label: label(tag),
        count: counts[tag]
      };
    });
    return {
      top: top,
      topLabel: top[0] ? top[0].label : "",
      totalCount: Object.keys(counts).reduce(function (sum, key) { return sum + counts[key]; }, 0)
    };
  }

  function getNarrativePack(context) {
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.buildPack) {
      return window.HabitNarrativeEngine.buildPack(context);
    }
    return null;
  }

  function getSupportModeLabel(mode) {
    if (mode === "grounding") return "сегодня бережнее";
    if (mode === "uplift") return "сегодня можно смелее";
    if (mode === "gentle") return "по шагам";
    return "";
  }

  function getCurrentRitualType(date) {
    var target = date || new Date();
    return target.getHours() < 16 ? "morning" : "evening";
  }

  function shiftDate(date, days) {
    var target = new Date(date.getTime());
    target.setDate(target.getDate() + days);
    return target;
  }

  function findRitualEntry(entries, localDate, type) {
    return entries.find(function (entry) {
      return entry.localDate === localDate && entry.type === type;
    }) || null;
  }

  function findRitualClosure(entries, localDate) {
    return entries.find(function (entry) {
      return entry.localDate === localDate;
    }) || null;
  }

  function normalizeEchoText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getEchoTokens(text) {
    return normalizeEchoText(text)
      .split(" ")
      .filter(function (token) { return token.length >= 3; })
      .map(function (token) { return token.slice(0, 6); });
  }

  function scoreRitualSimilarity(a, b) {
    var first = normalizeEchoText(a);
    var second = normalizeEchoText(b);
    if (!first || !second) return 0;
    if (first === second) return 1;

    var firstTokens = getEchoTokens(first);
    var secondTokens = getEchoTokens(second);
    if (!firstTokens.length || !secondTokens.length) return 0;

    var secondMap = {};
    secondTokens.forEach(function (token) { secondMap[token] = true; });
    var shared = 0;
    firstTokens.forEach(function (token) {
      if (secondMap[token]) shared += 1;
    });
    var union = {};
    firstTokens.concat(secondTokens).forEach(function (token) { union[token] = true; });
    var unionCount = Object.keys(union).length || 1;
    var score = shared / unionCount;

    if (first.indexOf(second) !== -1 || second.indexOf(first) !== -1) {
      score += 0.22;
    }

    return Math.min(1, score);
  }

  function buildRitualEchoModel(state, ritualModel) {
    var now = new Date();
    var todayKey = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey(now)
      : now.toISOString().slice(0, 10);
    var ritualEntries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
    var slips = Array.isArray(state.slips) ? state.slips : [];
    var resisted = Array.isArray(state.resisted) ? state.resisted : [];

    var slipsByDate = {};
    slips.forEach(function (item) {
      if (!item || !item.localDate) return;
      slipsByDate[item.localDate] = (slipsByDate[item.localDate] || 0) + 1;
    });

    var resistedByDate = {};
    resisted.forEach(function (item) {
      if (!item || !item.localDate) return;
      resistedByDate[item.localDate] = (resistedByDate[item.localDate] || 0) + 1;
    });

    var currentText = ritualModel && ritualModel.mode === "entry" && hasUsefulRitualContext(ritualModel.value)
      ? ritualModel.value
      : "";

    var grouped = {};
    ritualEntries.forEach(function (entry) {
      if (!entry || entry.type !== "morning" || !entry.localDate || !hasUsefulRitualContext(entry.text)) return;
      if (entry.localDate === todayKey) return;
      var key = normalizeEchoText(entry.text);
      if (!key) return;
      var slipCount = slipsByDate[entry.localDate] || 0;
      var resistedCount = resistedByDate[entry.localDate] || 0;
      var worked = resistedCount > 0 || slipCount === 0;
      var prev = grouped[key];
      var candidate = {
        key: key,
        text: entry.text,
        localDate: entry.localDate,
        worked: worked,
        slipCount: slipCount,
        resistedCount: resistedCount
      };
      if (!prev) {
        grouped[key] = candidate;
        return;
      }
      var prevScore = (prev.worked ? 2 : 0) + prev.resistedCount - prev.slipCount;
      var nextScore = (candidate.worked ? 2 : 0) + candidate.resistedCount - candidate.slipCount;
      if (nextScore > prevScore || String(candidate.localDate) > String(prev.localDate)) {
        grouped[key] = candidate;
      }
    });

    var echoes = Object.keys(grouped).map(function (key) { return grouped[key]; });
    if (!echoes.length) {
      return {
        visible: true,
          arcs: [
            { tone: "base", resonating: false, x: -28, y: -42, width: 236, height: 176, rotation: -10, opacity: 0.28 },
            { tone: "base", resonating: false, x: 54, y: -2, width: 190, height: 146, rotation: 12, opacity: 0.2 }
          ],
        label: "Эхо-память",
        helper: "Тонкие дуги на фоне — следы прошлых ориентиров.",
        note: "",
        resonating: false
      };
    }

    echoes.sort(function (a, b) {
      if (a.worked !== b.worked) return Number(b.worked) - Number(a.worked);
      if (a.resistedCount !== b.resistedCount) return b.resistedCount - a.resistedCount;
      return String(b.localDate).localeCompare(String(a.localDate));
    });

    var candidates = echoes.slice(0, 2);
    var bestKey = "";
    var bestMatch = null;
    var bestScore = 0;
    if (currentText) {
      candidates.forEach(function (candidate) {
        var score = scoreRitualSimilarity(currentText, candidate.text);
        if (score > bestScore) {
          bestScore = score;
          bestKey = candidate.key;
          bestMatch = candidate;
        }
      });
    }

    var arcs = candidates.map(function (candidate, index) {
      return {
        tone: candidate.worked ? "worked" : "soft",
        resonating: !!(bestKey && bestScore >= 0.42 && candidate.key === bestKey),
        x: index === 0 ? -34 : 42,
        y: index === 0 ? -46 : -8,
        width: index === 0 ? 248 : 202,
        height: index === 0 ? 184 : 154,
        rotation: index === 0 ? -10 : 12,
        opacity: index === 0 ? 0.3 : 0.22
      };
    });

    var helper = "Тонкие дуги на фоне — следы прошлых ориентиров.";
    var note = "";
    if (bestMatch && bestScore >= 0.42) {
      note = bestMatch.worked
        ? "Похожий ориентир уже помогал тебе раньше."
        : "Такой ориентир у тебя уже возвращался раньше.";
      helper = note;
    }

    return {
      visible: arcs.length > 0,
      arcs: arcs,
      label: "Эхо-память",
      helper: helper,
      note: note,
      resonating: !!note
    };
  }

  function buildCarryoverFeedbackMap(guidanceTone, supportMode) {
    var feedback = {
      yes: "\u041e\u0442\u043b\u0438\u0447\u043d\u043e. \u0417\u043d\u0430\u0447\u0438\u0442, \u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440 \u0441\u0440\u0430\u0431\u043e\u0442\u0430\u043b. \u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u044d\u0442\u043e \u0437\u0430\u043f\u043e\u043c\u043d\u0438\u0442 \u0438 \u0441\u043c\u043e\u0436\u0435\u0442 \u0441\u043d\u043e\u0432\u0430 \u043f\u043e\u0434\u0441\u0432\u0435\u0442\u0438\u0442\u044c \u043f\u043e\u0445\u043e\u0436\u0443\u044e \u043e\u043f\u043e\u0440\u0443.",
      partial: "\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e \u2014 \u044d\u0442\u043e \u0443\u0436\u0435 \u043d\u0435 \u043c\u0430\u043b\u043e. \u0414\u0443\u0433\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430. \u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c, \u043c\u043e\u0436\u043d\u043e \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043e\u0434\u043d\u0443 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0437\u0430\u043c\u0435\u0442\u043a\u0443.",
      present: "\u0422\u044b \u0437\u0434\u0435\u0441\u044c \u2014 \u0438 \u044d\u0442\u043e \u0433\u043b\u0430\u0432\u043d\u043e\u0435. \u0412\u0447\u0435\u0440\u0430 \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c. \u0412\u0435\u0447\u0435\u0440 \u0437\u0430\u043a\u0440\u044b\u0442, \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u2014 \u043d\u043e\u0432\u044b\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440, \u0431\u0435\u0437 \u0433\u0440\u0443\u0437\u0430."
    };
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.toneActionMessage) {
      return {
        yes: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", feedback.yes, supportMode),
        partial: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", feedback.partial, supportMode),
        present: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "slip", feedback.present, supportMode)
      };
    }
    return feedback;
  }

  function buildCarryoverToastMap(guidanceTone, supportMode) {
    var messages = {
      yes: "\u0412\u0447\u0435\u0440\u0430\u0448\u043d\u044f\u044f \u043d\u0438\u0442\u044c \u0437\u0430\u043a\u0440\u044b\u0442\u0430. \u0422\u0435\u043f\u0435\u0440\u044c \u043c\u043e\u0436\u043d\u043e \u0441\u043f\u043e\u043a\u043e\u0439\u043d\u043e \u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0441\u0435\u0433\u043e\u0434\u043d\u044f.",
      partial: "\u0412\u0447\u0435\u0440\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u043e \u0447\u0435\u0441\u0442\u043d\u043e. \u0422\u0435\u043f\u0435\u0440\u044c \u043c\u043e\u0436\u043d\u043e \u0432\u043e\u0439\u0442\u0438 \u0432 \u043d\u043e\u0432\u044b\u0439 \u0434\u0435\u043d\u044c \u0431\u0435\u0437 \u0434\u043e\u0433\u043e\u043d\u044f\u043d\u0438\u044f.",
      present: "\u0412\u0447\u0435\u0440\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u043e \u0431\u0435\u0437 \u0433\u0440\u0443\u0437\u0430. \u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043c\u043e\u0436\u043d\u043e \u043f\u0440\u043e\u0441\u0442\u043e \u043d\u0430\u0447\u0430\u0442\u044c \u0437\u0430\u043d\u043e\u0432\u043e."
    };
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.toneActionMessage) {
      return {
        yes: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", messages.yes, supportMode),
        partial: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", messages.partial, supportMode),
        present: window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", messages.present, supportMode)
      };
    }
    return messages;
  }

  function buildRitualModel(state, narrative) {
    var now = new Date();
    var type = getCurrentRitualType(now);
    var todayKey = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey(now)
      : now.toISOString().slice(0, 10);
    var yesterday = shiftDate(now, -1);
    var yesterdayKey = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey(yesterday)
      : yesterday.toISOString().slice(0, 10);
    var entries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
    var closures = Array.isArray(state.ritualClosures) ? state.ritualClosures : [];
    var existing = findRitualEntry(entries, todayKey, type);
    var morningEntry = findRitualEntry(entries, todayKey, "morning");
    var eveningEntry = findRitualEntry(entries, todayKey, "evening");
    var yesterdayMorningEntry = findRitualEntry(entries, yesterdayKey, "morning");
    var yesterdayEveningEntry = findRitualEntry(entries, yesterdayKey, "evening");
    var yesterdayClosure = findRitualClosure(closures, yesterdayKey);
    var guidanceTone = state && state.profile && state.profile.guidanceTone;
    var supportMode = narrative && narrative.meta && narrative.meta.supportMode;
    if (type === "morning" && yesterdayMorningEntry && yesterdayMorningEntry.text && !yesterdayEveningEntry && !yesterdayClosure) {
      var carryoverModel = {
        mode: "carryover",
        type: type,
        kicker: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u2014 \u0432\u0447\u0435\u0440\u0430",
        title: "\u0412\u0447\u0435\u0440\u0430 \u043e\u0441\u0442\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044b\u043c",
        copy: "\u041e\u0434\u0438\u043d \u0432\u043e\u043f\u0440\u043e\u0441 \u2014 \u0438 \u0432\u0447\u0435\u0440\u0430 \u0437\u0430\u043a\u0440\u043e\u0435\u0442\u0441\u044f. \u041f\u043e\u0442\u043e\u043c \u043c\u043e\u0436\u043d\u043e \u0441\u043f\u043e\u043a\u043e\u0439\u043d\u043e \u043d\u0430\u0447\u0430\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f.",
        contextLabel: "\u041e\u0442\u043a\u0440\u044b\u0442\u0430\u044f \u043d\u0438\u0442\u044c",
        contextText: shortenText(yesterdayMorningEntry.text, 110),
        note: "\u0414\u0435\u0440\u0436\u0438\u043c \u0442\u043e\u043b\u044c\u043a\u043e \u0432\u0447\u0435\u0440\u0430\u0448\u043d\u044e\u044e \u043d\u0438\u0442\u044c. \u0411\u043e\u043b\u044c\u0448\u0435 \u043d\u0438\u0447\u0435\u0433\u043e \u0434\u043e\u0433\u043e\u043d\u044f\u0442\u044c \u043d\u0435 \u043d\u0443\u0436\u043d\u043e.",
        value: "",
        hasEntry: false,
        actionLabel: "\u0422\u0435\u043f\u0435\u0440\u044c \u2014 \u0441\u0435\u0433\u043e\u0434\u043d\u044f",
        carryoverDate: yesterdayKey,
        carryoverQuestion: "\u041a\u0430\u043a \u0432\u0447\u0435\u0440\u0430 \u043f\u0440\u043e\u0448\u043b\u043e \u0441 \u044d\u0442\u0438\u043c?",
        carryoverChoices: [
          { id: "yes", label: "\u0414\u0430, \u0443\u0434\u0435\u0440\u0436\u0430\u043b" },
          { id: "partial", label: "\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e" },
          { id: "present", label: "\u041d\u0435\u0442, \u044f \u0437\u0434\u0435\u0441\u044c" }
        ],
        carryoverFeedback: buildCarryoverFeedbackMap(guidanceTone, supportMode),
        carryoverToast: buildCarryoverToastMap(guidanceTone, supportMode),
        carryoverNotePlaceholders: {
          partial: "\u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c, \u043e\u0434\u043d\u043e\u0439 \u0444\u0440\u0430\u0437\u043e\u0439: \u0447\u0442\u043e \u043f\u043e\u043c\u043e\u0433\u043b\u043e \u0438\u043b\u0438 \u043f\u043e\u043c\u0435\u0448\u0430\u043b\u043e?",
          present: "\u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c, \u043e\u0434\u043d\u043e\u0439 \u0444\u0440\u0430\u0437\u043e\u0439: \u0447\u0442\u043e \u0432\u0447\u0435\u0440\u0430 \u0431\u044b\u043b\u043e \u0441\u0430\u043c\u044b\u043c \u0442\u0440\u0443\u0434\u043d\u044b\u043c?"
        }
      };
      carryoverModel.echo = buildRitualEchoModel(state, carryoverModel);
      return carryoverModel;
    }
    var title = type === "morning"
      ? "\u0427\u0442\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0432\u0430\u0436\u043d\u043e \u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044c?"
      : "\u0427\u0442\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0431\u044b\u043b\u043e \u0441\u0430\u043c\u044b\u043c \u0441\u043b\u043e\u0436\u043d\u044b\u043c \u0438\u043b\u0438 \u0441\u0430\u043c\u044b\u043c \u0432\u0430\u0436\u043d\u044b\u043c?";
    var copy = type === "morning"
      ? "\u041e\u0434\u043d\u0430 \u043a\u043e\u0440\u043e\u0442\u043a\u0430\u044f \u043c\u044b\u0441\u043b\u044c \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u043d\u0435 \u0437\u0430\u0445\u043e\u0434\u0438\u0442\u044c \u0432 \u0434\u0435\u043d\u044c \u043d\u0430 \u0430\u0432\u0442\u043e\u043f\u0438\u043b\u043e\u0442\u0435."
      : "\u041e\u0434\u043d\u0430 \u0447\u0435\u0441\u0442\u043d\u0430\u044f \u0444\u0440\u0430\u0437\u0430 \u0432\u0435\u0447\u0435\u0440\u043e\u043c \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u0438\u0442\u043c \u0434\u043d\u044f.";
    var contextLabel = "";
    var contextText = "";
    if (type === "evening" && morningEntry && hasUsefulRitualContext(morningEntry.text)) {
      copy = "\u0412\u0435\u0447\u0435\u0440\u043d\u044f\u044f \u043c\u044b\u0441\u043b\u044c \u0437\u0430\u043c\u044b\u043a\u0430\u0435\u0442 \u0434\u0435\u043d\u044c \u0438 \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u0443\u0432\u0438\u0434\u0435\u0442\u044c, \u0447\u0442\u043e \u0441\u0440\u0430\u0431\u043e\u0442\u0430\u043b\u043e \u043d\u0430 \u0441\u0430\u043c\u043e\u043c \u0434\u0435\u043b\u0435.";
      contextLabel = "\u0423\u0442\u0440\u043e\u043c \u0442\u044b \u0432\u044b\u0431\u0440\u0430\u043b";
      contextText = shortenText(morningEntry.text, 110);
    } else if (type === "morning" && yesterdayEveningEntry && hasUsefulRitualContext(yesterdayEveningEntry.text)) {
      copy = "\u0423\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043c\u044b\u0441\u043b\u044c \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u0432\u043e\u0439\u0442\u0438 \u0432 \u0434\u0435\u043d\u044c \u0447\u0443\u0442\u044c \u043e\u0441\u043e\u0437\u043d\u0430\u043d\u043d\u0435\u0435, \u0430 \u043d\u0435 \u043f\u043e \u0438\u043d\u0435\u0440\u0446\u0438\u0438.";
      contextLabel = "\u0412\u0447\u0435\u0440\u0430 \u0433\u043b\u0430\u0432\u043d\u044b\u043c \u0431\u044b\u043b\u043e";
      contextText = shortenText(yesterdayEveningEntry.text, 110);
    } else if (type === "morning" && eveningEntry && hasUsefulRitualContext(eveningEntry.text)) {
      contextLabel = "\u041d\u0430 \u044d\u0442\u043e\u0442 \u0432\u0435\u0447\u0435\u0440 \u0443\u0436\u0435 \u0435\u0441\u0442\u044c \u043c\u044b\u0441\u043b\u044c";
      contextText = shortenText(eveningEntry.text, 110);
    }
    var placeholder = type === "morning"
      ? "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u043f\u0440\u043e\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 14:00 \u0441\u043f\u043e\u043a\u043e\u0439\u043d\u0435\u0435 \u0438 \u043d\u0435 \u0441\u043f\u043e\u0440\u0438\u0442\u044c \u0441 \u0441\u043e\u0431\u043e\u0439."
      : "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u043f\u043e\u0441\u043b\u0435 \u0432\u0441\u0442\u0440\u0435\u0447 \u043c\u0435\u043d\u044f \u0441\u0438\u043b\u044c\u043d\u0435\u0435 \u0432\u0441\u0435\u0433\u043e \u0432\u044b\u0431\u0438\u0432\u0430\u0435\u0442 \u043d\u0430\u043f\u0440\u044f\u0436\u0435\u043d\u0438\u0435.";
    var savedNote = existing
      ? (type === "morning"
        ? "\u041c\u044b\u0441\u043b\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0443\u0436\u0435 \u0435\u0441\u0442\u044c. \u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c, \u0435\u0451 \u043c\u043e\u0436\u043d\u043e \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u044c."
        : "\u0412\u0435\u0447\u0435\u0440\u043d\u044f\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430 \u0443\u0436\u0435 \u0435\u0441\u0442\u044c. \u0415\u0441\u043b\u0438 \u0437\u0430\u0445\u043e\u0447\u0435\u0448\u044c, \u0435\u0451 \u043c\u043e\u0436\u043d\u043e \u0443\u0442\u043e\u0447\u043d\u0438\u0442\u044c.")
      : (type === "morning"
        ? "\u041e\u0434\u043d\u043e\u0439 \u0444\u0440\u0430\u0437\u044b \u0443\u0436\u0435 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e."
        : "\u0414\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043e\u0434\u043d\u043e\u0439 \u0447\u0435\u0441\u0442\u043d\u043e\u0439 \u0444\u0440\u0430\u0437\u044b.");
    var saveToast = type === "morning"
      ? "\u0423\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043c\u044b\u0441\u043b\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u0422\u0435\u043f\u0435\u0440\u044c \u0443 \u0434\u043d\u044f \u0435\u0441\u0442\u044c \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0438\u0440."
      : "\u0412\u0435\u0447\u0435\u0440\u043d\u044f\u044f \u043c\u044b\u0441\u043b\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430. \u0422\u0430\u043a \u0440\u0438\u0442\u043c \u0434\u043d\u044f \u0441\u0442\u0430\u043d\u0435\u0442 \u043f\u043e\u043d\u044f\u0442\u043d\u0435\u0435 \u0443\u0436\u0435 \u0437\u0430\u0432\u0442\u0440\u0430.";
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.toneActionMessage) {
      saveToast = window.HabitNarrativeEngine.toneActionMessage(guidanceTone, "success", saveToast, supportMode);
    }

    var ritualModel = {
      mode: "entry",
      type: type,
      kicker: type === "morning"
        ? "\u0423\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u0440\u0438\u0442\u0443\u0430\u043b"
        : "\u0412\u0435\u0447\u0435\u0440\u043d\u0438\u0439 \u0440\u0438\u0442\u0443\u0430\u043b",
      title: title,
      copy: copy,
      contextLabel: contextLabel,
      contextText: contextText,
      placeholder: placeholder,
      note: savedNote,
      value: existing ? existing.text : "",
      hasEntry: !!existing,
      actionLabel: existing
        ? "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043c\u044b\u0441\u043b\u044c"
        : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043c\u044b\u0441\u043b\u044c",
      toast: saveToast
    };
    ritualModel.echo = buildRitualEchoModel(state, ritualModel);
    return ritualModel;
  }

  function getToneAwareTrackerCopy(state, copy) {
    var next = Object.assign({}, copy || {});
    var tone = state && state.profile && state.profile.guidanceTone;
    var supportMode = "steady";
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.getSupportMode) {
      supportMode = window.HabitNarrativeEngine.getSupportMode({
        state: state,
        analytics7: analytics("7d"),
        firstWeekSupport: getFirstWeekSupport(state)
      });
    }
    if (window.HabitNarrativeEngine && window.HabitNarrativeEngine.toneActionMessage) {
      next.slipToast = window.HabitNarrativeEngine.toneActionMessage(tone, "slip", next.slipToast, supportMode);
      next.successToast = window.HabitNarrativeEngine.toneActionMessage(tone, "success", next.successToast, supportMode);
    }
    return next;
  }

  function formatMoney(value, symbol) {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2
    }).format(Number(value) || 0) + " " + (symbol || "₽");
  }

  function formatMinutes(value) {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 1
    }).format(Number(value) || 0) + " мин";
  }

  function formatHours(value) {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 1
    }).format(Number(value) || 0) + " ч";
  }

  function riskLabel(riskLevel) {
    var map = {
      low: "низкая нагрузка",
      moderate: "умеренная нагрузка",
      high: "высокая нагрузка",
      very_high: "высокая нагрузка"
    };
    return map[riskLevel] || "умеренная нагрузка";
  }

  function compactTrendLabel(direction) {
    if (direction === "up") return "фон тяжелее";
    if (direction === "down") return "фон мягче";
    if (direction === "stable") return "фон ровнее";
    return "данных мало";
  }

  function compactHealthLabel(direction) {
    if (direction === "up") return "есть позитивный сдвиг";
    if (direction === "down") return "часть маркеров просела";
    if (direction === "stable") return "почти без изменений";
    return "без динамики";
  }

  function shortenText(text, limit) {
    var value = String(text || "").trim();
    if (!value) return "";
    if (value.length <= limit) return value;
    return value.slice(0, limit - 1).trim() + "…";
  }

  function getPeriodLength(period) {
    if (period === "7d") return 7;
    if (period === "90d") return 90;
    return 30;
  }

  function getPeriodDateKeys(period) {
    var now = new Date();
    var length = getPeriodLength(period);
    var keys = [];
    var formatter = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey
      : function (date) { return date.toISOString().slice(0, 10); };
    for (var offset = 0; offset < length; offset += 1) {
      keys.push(formatter(shiftDate(now, -offset)));
    }
    return keys;
  }

  function buildOrientationImpactModel(state, period) {
    var periodKeys = getPeriodDateKeys(period);
    var periodMap = {};
    periodKeys.forEach(function (key) { periodMap[key] = true; });
    var ritualEntries = (state.ritualEntries || []).filter(function (entry) {
      return entry.type === "morning" && periodMap[entry.localDate] && hasUsefulRitualContext(entry.text);
    });
    if (!ritualEntries.length) {
      return null;
    }

    var slipsByDate = {};
    (state.slips || []).forEach(function (item) {
      if (!periodMap[item.localDate]) return;
      slipsByDate[item.localDate] = (slipsByDate[item.localDate] || 0) + 1;
    });

    var withSet = {};
    ritualEntries.forEach(function (entry) {
      withSet[entry.localDate] = true;
    });

    var observedKeys = periodKeys.filter(function (key) {
      return withSet[key] || slipsByDate[key];
    });
    if (!observedKeys.length) {
      observedKeys = periodKeys.slice();
    }

    var withCount = 0;
    var withoutCount = 0;
    var withSlips = 0;
    var withoutSlips = 0;
    observedKeys.forEach(function (key) {
      var count = slipsByDate[key] || 0;
      if (withSet[key]) {
        withCount += 1;
        withSlips += count;
      } else {
        withoutCount += 1;
        withoutSlips += count;
      }
    });

    var avgWith = withCount ? withSlips / withCount : 0;
    var avgWithout = withoutCount ? withoutSlips / withoutCount : 0;
    var delta = avgWithout - avgWith;
    var headline = "";
    var narrative = "";
    if (withCount >= 2 && withoutCount >= 2 && delta > 0.2) {
      headline = "Дни с ориентиром — на " + delta.toFixed(1) + " срыва меньше";
      narrative = "Когда утром есть ориентир, день выходит заметно ровнее. Это уже не гипотеза, а повторяющийся паттерн твоих дней.";
    } else if (withCount >= 2) {
      headline = "Утренний ориентир делает день ровнее";
      narrative = "Даже когда день не идеален, утренний ориентир чаще помогает не разгоняться на автомате.";
    } else {
      headline = "Ориентир уже начинает влиять на день";
      narrative = "Пока данных ещё немного, но даже сейчас видно: утренний фокус помогает держать день собраннее.";
    }

    return {
      headline: headline,
      narrative: narrative,
      meta: observedKeys.length + " дней · " + withCount + " с ориентиром, " + withoutCount + " без",
      delta: delta,
      withCount: withCount,
      withoutCount: withoutCount
    };
  }

  function buildWorkedSupportsModel(state, period) {
    var periodKeys = getPeriodDateKeys(period);
    var periodMap = {};
    periodKeys.forEach(function (key) { periodMap[key] = true; });
    var slipsByDate = {};
    (state.slips || []).forEach(function (item) {
      if (!periodMap[item.localDate]) return;
      slipsByDate[item.localDate] = (slipsByDate[item.localDate] || 0) + 1;
    });

    var grouped = {};
    (state.ritualEntries || []).forEach(function (entry) {
      if (entry.type !== "morning" || !periodMap[entry.localDate] || !hasUsefulRitualContext(entry.text)) return;
      var key = String(entry.text || "").trim();
      if (!grouped[key]) {
        grouped[key] = {
          text: key,
          total: 0,
          success: 0,
          partial: 0
        };
      }
      grouped[key].total += 1;
      if ((slipsByDate[entry.localDate] || 0) === 0) {
        grouped[key].success += 1;
      } else {
        grouped[key].partial += 1;
      }
    });

    function getCopingToolLabel(tool) {
      var labels = {
        walk: "выйти на короткую прогулку",
        sparkling_water: "переключиться на газированную воду",
        tea: "заменить порыв чаем",
        timer: "поставить короткий таймер",
        water_pause: "сделать паузу со стаканом воды",
        pause: "сделать короткую паузу"
      };
      return labels[tool] || "использовать свой рабочий ход";
    }

    (state.resisted || []).forEach(function (entry) {
      if (!periodMap[entry.localDate] || !entry.copingTool) return;
      var key = "coping:" + String(entry.copingTool || "").trim();
      if (!grouped[key]) {
        grouped[key] = {
          text: getCopingToolLabel(entry.copingTool),
          total: 0,
          success: 0,
          partial: 0,
          source: "resisted"
        };
      }
      grouped[key].total += 1;
      grouped[key].success += 1;
    });

    var items = Object.keys(grouped).map(function (key) {
      var item = grouped[key];
      var tone = item.success >= item.partial ? "worked" : "sometimes";
      return {
        text: shortenText(item.text, 46),
        detail: item.source === "resisted"
          ? "из удержанных моментов"
          : (item.success > 0 ? "из дней, где ориентир сработал" : "из повторяющихся ориентиров"),
        tone: tone,
        toneLabel: tone === "worked" ? "работало" : "иногда",
        countLabel: item.total + "×",
        total: item.total,
        success: item.success
      };
    }).sort(function (left, right) {
      if (right.success !== left.success) return right.success - left.success;
      return right.total - left.total;
    }).slice(0, 3);

    return {
      items: items,
      hasItems: items.length > 0
    };
  }

  function hasUsefulRitualContext(text) {
    var value = String(text || "").trim();
    return value.length >= 12;
  }

  function getGreetingByTime(date) {
    var target = date || new Date();
    var hour = target.getHours();
    if (hour >= 23 || hour < 5) return "Доброй ночи,";
    if (hour < 12) return "Доброе утро,";
    if (hour < 17) return "Добрый день,";
    return "Добрый вечер,";
  }

  function getTodayResistedCount(state) {
    var now = new Date();
    var todayKey = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey(now)
      : now.toISOString().slice(0, 10);
    return (state.resisted || []).filter(function (item) {
      return item.localDate === todayKey;
    }).length;
  }

  function buildMemoryModel(state, weekly) {
    var summary = weekly.summary || {};
    var wellbeing = weekly.wellbeing || {};
    var ritualEntries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
    var resisted = Array.isArray(state.resisted) ? state.resisted : [];
    var orientationImpact = buildOrientationImpactModel(state, "30d");
    var workedSupports = buildWorkedSupportsModel(state, "30d");
    var observedDays = Number(summary.observedDays) || 0;
    var morningCount = ritualEntries.filter(function (entry) {
      return entry.type === "morning" && entry.text;
    }).length;
    var items = [];
    var seen = {};

    function addItem(item) {
      if (!item || !item.text) return;
      var key = String(item.text || "").trim().toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      items.push(item);
    }

    if (orientationImpact && orientationImpact.headline) {
      addItem({
        tone: "positive",
        text: orientationImpact.headline,
        meta: orientationImpact.meta || "по дням с ориентиром и без него"
      });
    }

    if (workedSupports && workedSupports.hasItems) {
      workedSupports.items.slice(0, 2).forEach(function (support) {
        addItem({
          tone: support.tone === "worked" ? "positive" : "accent",
          text: (support.tone === "worked" ? "Тебе уже помогало: " : "Иногда срабатывает: ") + "«" + support.text + "»",
          meta: support.countLabel + " · " + (support.tone === "worked" ? "из удачных дней" : "повторялось в ориентирах")
        });
      });
    }

    if (morningCount >= 3) {
      addItem({
        tone: "positive",
        text: "Дни с утренним ориентиром обычно проходят собраннее.",
        meta: "утренних ориентиров: " + morningCount
      });
    }

    if (summary.riskWindow && observedDays >= 3) {
      addItem({
        tone: "accent",
        text: "Окно " + summary.riskWindow + " повторяется чаще других.",
        meta: "его полезно встречать заранее"
      });
    }

    if (summary.mainTrigger && summary.mainTrigger !== "Другое") {
      addItem({
        tone: "neutral",
        text: "Чаще всего всё собирается вокруг \"" + String(summary.mainTrigger).toLowerCase() + "\".",
        meta: "по событиям и записям недели"
      });
    }

    if (resisted.length > 0) {
      addItem({
        tone: "positive",
        text: "У тебя уже есть удержанные моменты — это живая опора.",
        meta: "отмечено удержаний: " + resisted.length
      });
    }

    if (wellbeing.stateEntryCount >= 2) {
      addItem({
        tone: "neutral",
        text: "Фон дня уже начинает объяснять сложные моменты.",
        meta: "стресс и энергия видны лучше сухих цифр"
      });
    }

    if (!items.length) {
      addItem({
        tone: "positive",
        text: "Даже один честный сигнал уже станет опорой для памяти приложения.",
        meta: "достаточно одной мысли, одного события или одного удержания"
      });
    }

    var previewItem = items[0] || null;

    return {
      title: "Приложение помнит",
      actionLabel: "Открыть дневник",
      preview: previewItem
        ? (previewItem.text + (previewItem.meta ? ". " + previewItem.meta : ""))
        : "",
      items: items.slice(0, 3)
    };
  }

  function parseWindowRange(windowText) {
    var match = String(windowText || "").match(/(\d{1,2}):\d{2}\s*[-–]\s*(\d{1,2}):\d{2}/);
    if (!match) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2])
    };
  }

  function buildLiveEventModel(state, weekly, setup, firstWeekSupport) {
    var now = new Date();
    var hour = now.getHours();
    var summary = weekly.summary || {};
    var wellbeing = weekly.wellbeing || {};
    var todayResisted = getTodayResistedCount(state);
    var entries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
    var todayKey = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey
      ? window.HabitStore.helpers.formatDateKey(now)
      : now.toISOString().slice(0, 10);
    var hasTodayRitual = entries.some(function (entry) { return entry.localDate === todayKey; });
    var windowRange = parseWindowRange(summary.riskWindow);
    var observedDays = Number(summary.observedDays) || 0;

    if (todayResisted > 0) {
      return {
        badge: "сегодня",
        tone: "positive",
        title: "Сегодня уже есть точка опоры",
        body: "Один удержанный момент уже появился в твоём ритме. Сейчас полезнее опереться на него, чем ждать идеального дня."
      };
    }

    if (windowRange && observedDays >= 4) {
      if (hour >= windowRange.start && hour < windowRange.end) {
        return {
          badge: "сейчас",
          tone: "alert",
          title: "Сейчас идёт твоё важное окно",
          body: "Обычно именно в это время привычка собирается быстрее всего. Лучше держаться за один маленький шаг, а не спорить с собой на автопилоте."
        };
      }
      if (hour < windowRange.start && (windowRange.start - hour) <= 3) {
        return {
          badge: "позже",
          tone: "alert",
          title: "Позже сегодня окно будет чувствительнее",
          body: "Около " + summary.riskWindow + " тебе обычно тяжелее. Хорошо заранее оставить себе немного опоры, а не ждать пика."
        };
      }
    }

    if (firstWeekSupport && firstWeekSupport.celebration) {
      return {
        badge: "маленькая победа",
        tone: "positive",
        title: firstWeekSupport.celebration.headline,
        body: shortenText(firstWeekSupport.celebration.text, 124)
      };
    }
    return null;
  }

  function getTrackerCopy(habitId) {
    var copy = {
      recordLabel: "Зафиксировать срыв",
      resistedLabel: "Удержался",
      slipToast: "Событие сохранено. Лента и аналитика уже обновились.",
      successToast: "Момент удержания сохранён. Это тоже важная часть твоего ритма."
    };

    if (habitId === "alcohol") {
      copy.recordLabel = "Зафиксировать эпизод";
      copy.resistedLabel = "Не выпил";
      copy.slipToast = "Эпизод сохранён. Лента и аналитика уже подстроились под него.";
      copy.successToast = "Момент, когда ты не выпил, сохранён как опора на будущее.";
    } else if (habitId === "sweets") {
      copy.recordLabel = "Зафиксировать эпизод";
      copy.slipToast = "Эпизод сохранён. Теперь будет легче заметить, что именно запускает тягу.";
      copy.successToast = "Момент удержания сохранён. Он усилит картину самоконтроля.";
    } else if (habitId === "social") {
      copy.recordLabel = "Сорвался в ленту";
      copy.resistedLabel = "Вышел вовремя";
      copy.slipToast = "Заход в ленту сохранён. Это поможет точнее увидеть сценарий автопрокрутки.";
      copy.successToast = "Момент выхода сохранён. Это тоже движение в нужную сторону.";
    } else if (habitId === "overeating") {
      copy.recordLabel = "Зафиксировать эпизод";
      copy.resistedLabel = "Остановился вовремя";
      copy.slipToast = "Эпизод сохранён. Так будет легче заметить его реальную причину.";
      copy.successToast = "Момент, когда ты остановился вовремя, тоже сохранён в ритме недели.";
    } else if (habitId === "custom") {
      copy.recordLabel = "Зафиксировать эпизод";
      copy.slipToast = "Эпизод сохранён. Он уже попал в ленту и аналитику привычки.";
    }

    return copy;
  }

  function getTrackerStateCopy(habitId, todayCount, limit) {
    var ratio = todayCount / Math.max(limit, 1);
    var stage = todayCount === 0 ? "zero" : ratio >= 1 ? "high" : ratio >= 0.4 ? "mid" : "low";
    var common = {
      zero: { badge: "спокойный день", title: "Сегодня можно держаться за ритм", text: "Даже один честный сигнал уже полезнее, чем попытка всё контролировать идеально." },
      low: { badge: "контроль держится", title: "День пока под контролем", text: "Сценарий ещё не разогнался. Несколько спокойных решений подряд уже меняют ритм дня." },
      mid: { badge: "идёт снижение", title: "Сегодня уже " + todayCount + " эп.", text: "Это ещё управляемый диапазон. Самый полезный шаг сейчас — поймать следующий триггер чуть раньше." },
      high: { badge: "напряжённый день", title: "День получился тяжёлым", text: "Не своди всё к силе воли. Полезнее заметить момент, где привычка включилась автоматически." }
    };
    var perHabit = {
      alcohol: {
        zero: { badge: "спокойный день", title: "Сегодня без алкоголя", text: "Хороший базовый день. Чем спокойнее проходят триггерные окна, тем устойчивее ощущение контроля." },
        low: { badge: "контроль на твоей стороне", title: "Пока без лишних эпизодов", text: "Сценарий ещё не разогнался. Полезно заранее решить, чем заменить следующий импульс." },
        mid: { badge: "день под наблюдением", title: "Сегодня уже " + todayCount + " эп.", text: "День ещё можно вернуть в спокойный режим. Помогает заранее убрать доступ и социальный триггер." },
        high: { badge: "сложный день", title: "Сегодня было много триггеров", text: "Сейчас важнее мягко сократить следующий эпизод и подготовить безопасный сценарий, чем требовать идеальности." }
      },
      sweets: {
        zero: { badge: "ровный день", title: "Сладкое пока не включилось", text: "Если удержать ритм еды и энергии, тянуть будет заметно меньше." },
        low: { badge: "тяга снижается", title: "День идёт стабильно", text: "Ты уже не даёшь привычке идти на автомате. Следующий сильный момент часто приходит после еды или усталости." },
        mid: { badge: "важен следующий выбор", title: "Сегодня уже " + todayCount + " эп.", text: "Это ещё не провал дня. Сейчас полезнее закрыть следующий триггер: голод, стресс или визуальный доступ." },
        high: { badge: "день перегружен", title: "Тяга сегодня была высокой", text: "Полезнее понять, где просела энергия или накопился стресс, и подстраховать именно этот момент." }
      },
      social: {
        zero: { badge: "фокус держится", title: "Лента пока не забрала день", text: "Чем реже телефон попадает в руки без цели, тем слабее автопрокрутка." },
        low: { badge: "экран под контролем", title: "Ты пока управляешь вниманием", text: "Есть запас. Полезно заранее решить, когда можно заходить в ленту и когда выходить." },
        mid: { badge: "важен выход вовремя", title: "Сегодня уже " + todayCount + " захода", text: "День ещё можно выровнять. Следующий лучший шаг — сократить длительность, а не ждать идеального нуля." },
        high: { badge: "день рассыпался", title: "Автопрокрутка сегодня усилилась", text: "Обычно это связано с усталостью, перегрузкой или скукой. Сейчас лучше убрать телефон из быстрого доступа." }
      },
      overeating: {
        zero: { badge: "спокойный ритм", title: "Пока без эпизодов переедания", text: "Ровный день. Когда еда остаётся ответом на голод, а не на напряжение, телу становится легче." },
        low: { badge: "день под контролем", title: "Ты пока держишь ритм", text: "Это уже хорошая база. Следующий полезный шаг — заметить, где еда становится способом снять напряжение." },
        mid: { badge: "важен следующий выбор", title: "Сегодня уже " + todayCount + " эп.", text: "Эпизоды ещё можно остановить. Лучше не спорить с собой, а заранее убрать следующий автоматический сценарий." },
        high: { badge: "день был тяжёлым", title: "Сегодня было много импульсов", text: "Полезнее не ругать себя, а отметить, где включились стресс, усталость или пустота." }
      }
    };
    return (perHabit[habitId] && perHabit[habitId][stage]) || common[stage];
  }

  function getDiaryPlaceholder(habitId, habitName) {
    if (habitId === "smoking") return "Что произошло перед сигаретой? Что было важно в этот момент?";
    if (habitId === "alcohol") return "Что подтолкнуло к алкоголю именно сейчас?";
    if (habitId === "sweets") return "Что стояло за тягой к сладкому?";
    if (habitId === "social") return "Что было перед тем, как ты снова открыл ленту?";
    if (habitId === "overeating") return "Это был голод, усталость или автоматический сценарий?";
    return "Что происходило вокруг привычки \"" + habitName + "\"?";
  }

  function getStatePlaceholder() {
    return "Как ты сейчас? Что сильнее всего влияет на день?";
  }

  function getDiaryLogCopy(habitId) {
    if (habitId === "smoking") {
      return {
        tabLabel: "Записи срывов",
        notePlaceholder: "Что произошло перед сигаретой? Почему именно сейчас?",
        noteButton: "Добавить мысль к этому моменту"
      };
    }
    if (habitId === "social") {
      return {
        tabLabel: "Записи эпизодов",
        notePlaceholder: "Что было перед этим заходом в ленту? Что можно изменить в следующий раз?",
        noteButton: "Добавить мысль к этому моменту"
      };
    }
    return {
      tabLabel: "Записи эпизодов",
      notePlaceholder: "Что происходило в этот момент? Почему именно сейчас?",
      noteButton: "Добавить мысль к этому моменту"
    };
  }

  function getDiaryEmptyText(state, entryFilter) {
    if (entryFilter === "habit") {
      return 'Пока нет записей о привычке. Здесь будут мысли рядом с эпизодами, тягой и удержанием по привычке "' + state.currentHabit.name + '".';
    }
    if (entryFilter === "state") {
      return "Пока нет записей о состоянии. Здесь будут короткие заметки про сон, стресс, энергию и фон дня.";
    }
    return "Пока здесь тихо. Здесь можно вести и заметки о привычке, и короткие записи о состоянии дня — вместе они лучше объясняют паттерн.";
  }

  function getStateTagLabel(tag) {
    var labels = {
      sleep: "сон",
      work: "работа",
      conflict: "конфликт",
      loneliness: "одиночество",
      fatigue: "усталость",
      calm: "спокойно"
    };
    return labels[tag] || tag;
  }

  function buildMainScreenModel(state) {
    var monthly = analytics("30d");
    var weekly = analytics("7d");
    var summary = weekly.summary || {};
    var wellbeing = weekly.wellbeing || {};
    var health = weekly.health || { filledCount: 0, totalCount: 0 };
    var finance = monthly.finance || {};
    var config = getCurrentHabitConfig(state);
    var todayCount = window.HabitStore.getTodaySlipCount(state);
    var limit = state.profile.dailyLimit;
    var todayMinutes = (config.minutesPerEpisode || 0) * todayCount;
    var trackerCopy = getToneAwareTrackerCopy(state, getTrackerCopy(state.currentHabit.id));
    var trackerState = getTrackerStateCopy(state.currentHabit.id, todayCount, limit);
    var setup = getSetupModel(state);
    var firstWeek = getFirstWeekModel(state);
    var firstWeekSupport = getFirstWeekSupport(state);
    var narrative = getNarrativePack({
      state: state,
      analytics7: weekly,
      analytics30: monthly,
      setup: setup,
      firstWeek: firstWeek,
      firstWeekSupport: firstWeekSupport
    }) || {};
    var observedDays = Number(summary.observedDays) || 0;

    var ritual = buildRitualModel(state, narrative);
    var heroSub = "один ориентир на этот день";
    var showHeroProgress = true;
    if (ritual && ritual.mode === "carryover") {
      heroSub = "сначала мягко закроем вчера";
      showHeroProgress = false;
    } else if (ritual && ritual.type === "evening") {
      heroSub = "вечером важен честный возврат";
      showHeroProgress = false;
    } else if (ritual && ritual.type === "morning") {
      heroSub = "один ориентир на этот день";
    }

    return {
      hero: {
        greeting: getGreetingByTime(new Date()),
        userName: state.profile.userName,
        initials: state.profile.initials,
        habitLabel: state.currentHabit.name + " · сегодня",
        count: todayCount,
        sub: heroSub,
        goalPct: Math.min(100, Math.round(todayCount / Math.max(limit, 1) * 100)),
        goalColor: todayCount >= limit ? "#D85A30" : "#1D9E75",
        goalLabel: "сегодня " + todayCount + " / " + limit,
        showProgress: showHeroProgress,
        badge: trackerState.badge || "спокойный день",
        moodTitle: (narrative.today && narrative.today.title) || trackerState.title,
        moodText: (narrative.today && narrative.today.body) || trackerState.text,
        recordLabel: trackerCopy.recordLabel,
        resistedLabel: trackerCopy.resistedLabel,
        slipToast: trackerCopy.slipToast,
        successToast: trackerCopy.successToast
      },
      focus: narrative.today || {
        title: trackerState.title,
        body: trackerState.text,
        nextStep: ""
      },
      focusModeLabel: getSupportModeLabel(narrative.meta && narrative.meta.supportMode),
      ritual: ritual,
      mission: null,
      liveEvent: null,
      memory: buildMemoryModel(state, weekly),
      quickStats: {
        money: formatMoney(finance.todaySpent || 0, finance.currencySymbol || config.currencySymbol || "₽"),
        moneySub: "Неделя: " + formatMoney(finance.weekSpent || 0, finance.currencySymbol || config.currencySymbol || "₽"),
        time: formatMinutes(todayMinutes),
        timeSub: "Месяц: " + formatHours(finance.monthHours || 0),
        health: (health.filledCount || 0) + "/" + (health.totalCount || 7),
        healthSub: health.filledCount ? "сон, давление и тело в фокусе" : "маркеры пока не заполнены",
        summary: formatMoney(finance.todaySpent || 0, finance.currencySymbol || config.currencySymbol || "₽") +
          " · " + formatMinutes(todayMinutes) + " · health " + (health.filledCount || 0) + "/" + (health.totalCount || 7)
      },
      weekSnapshot: {
        sub: (narrative.weekly && narrative.weekly.compact) || (
          observedDays >= 4
            ? "Три сигнала, чтобы быстро понять ритм последних 7 дней."
            : "Неделя ещё собирает основу, но первые сигналы уже видны."
        ),
        badge: observedDays >= 4 ? "есть ритм" : "ранний период",
        behaviorValue: observedDays >= 4
          ? "Ритм " + (summary.dependencyIndex || 0)
          : "Появляется картина",
        behaviorCopy: observedDays >= 4
          ? ((narrative.progress && narrative.progress.body)
            ? shortenText(narrative.progress.body, 84)
            : shortenText("Триггер: " + String(summary.mainTrigger || "Другое").toLowerCase() + ". Окно: " + (summary.riskWindow || "—") + ".", 56))
          : shortenText("Уже видно окно " + (summary.riskWindow || "дня") + " и фактор \"" + String(summary.mainTrigger || "стресс").toLowerCase() + "\".", 64),
        stateValue: wellbeing.stateEntryCount
          ? (observedDays >= 4
            ? "Стресс " + (((wellbeing.averages || {}).stress || 0).toFixed(1)) + "/5"
            : "Фон дня виден")
          : "Фон ещё собирается",
        stateCopy: wellbeing.stateEntryCount
          ? (observedDays >= 4
            ? shortenText(compactTrendLabel(wellbeing.trend && wellbeing.trend.direction) + (wellbeing.contextLabel ? " · чаще " + wellbeing.contextLabel : ""), 56)
            : shortenText("Уже есть несколько честных сигналов о состоянии.", 56))
          : "Пара записей уже сделает день понятнее.",
        healthValue: (health.filledCount || 0)
          ? ((health.filledCount || 0) + "/" + (health.totalCount || 0))
          : "Можно начать",
        healthCopy: observedDays >= 4
          ? shortenText(
            compactHealthLabel(health.trendDirection) + " · " + (health.filledCount ? (health.trendSummary || "") : "можно начать со сна и пульса"),
            56
          )
          : (health.filledCount ? "Есть первые маркеры тела." : "Со сна и пульса уже появится опора.")
      },
      setup: setup,
      firstWeek: firstWeek,
      celebration: firstWeekSupport.celebration || null,
      narrative: narrative,
      layout: {
        showSetupBanner: (state.slips.length + state.resisted.length + state.diaryEntries.length) === 0 && !!setup.nextStep,
        showWeekSnapshot: false,
        showWeekRhythm: false,
        showQuickStats: false,
        showTips: false,
        showRecentLog: false,
        showFirstWeek: false,
        showCelebration: false
      }
    };
  }

  function buildDiaryScreenModel(state, options) {
    var opts = options || {};
    var composeMode = opts.composeMode || "habit";
    var entryFilter = opts.entryFilter || "all";
    var setup = getSetupModel(state);
    var summary = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getDiarySummary
      ? window.HabitStore.helpers.getDiarySummary(state)
      : { totalCount: state.diaryEntries.length, habitCount: 0, stateCount: 0, hasEntries: state.diaryEntries.length > 0 };
    var logCopy = getDiaryLogCopy(state.currentHabit.id);
    var ritualEntries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
    var todayKey = window.HabitStore.helpers.formatDateKey(new Date());
    var currentAnchor = ritualEntries.find(function (entry) {
      return entry && entry.type === "morning" && entry.localDate === todayKey && entry.text;
    }) || ritualEntries.find(function (entry) {
      return entry && entry.type === "morning" && entry.text;
    }) || null;

    return {
      setup: setup,
      compose: {
        userName: state.profile.userName,
        initials: state.profile.initials,
        time: window.HabitStore.helpers.formatTime(new Date()),
        subtitle: "Мысли и состояние рядом с привычкой: " + state.currentHabit.name,
        logTabLabel: logCopy.tabLabel,
        hint: composeMode === "state"
          ? "Можно коротко: как спалось, сколько было сил, что происходило с напряжением или телом."
          : "Пиши своими словами. Одной честной мысли уже достаточно, чтобы потом увидеть паттерн.",
        placeholder: composeMode === "state" ? getStatePlaceholder() : getDiaryPlaceholder(state.currentHabit.id, state.currentHabit.name),
        showHabitTags: composeMode !== "state",
        showStateControls: composeMode === "state",
        modeHabitLabel: "Мысль",
        modeStateLabel: "Состояние дня",
        habitTagsLabel: "Теги по желанию",
        bodySignalsLabel: "Телесные сигналы, если были",
        saveLabel: "Добавить запись",
        anchorVisible: composeMode !== "state" && !!(currentAnchor && currentAnchor.text),
        anchorTitle: "Ориентир сегодня",
        anchorText: currentAnchor && currentAnchor.text ? "«" + currentAnchor.text + "»" : ""
      },
      starter: {
        visible: !summary.hasEntries
      },
      summary: {
        text: "О привычке: " + (summary.habitCount || 0) + " · Состояние: " + (summary.stateCount || 0) + " · Всего: " + (summary.totalCount || 0)
      },
      entries: {
        emptyText: getDiaryEmptyText(state, entryFilter)
      },
      logCopy: logCopy,
      labels: {
        stateTag: getStateTagLabel
      }
    };
  }

  function buildProfileScreenModel(state, options) {
    var opts = options || {};
    var analytics30 = opts.analytics30 || analytics("30d");
    var analytics7 = opts.analytics7 || analytics("7d");
    var summary = analytics30.summary || {};
    var finance = analytics30.finance || {};
    var health = analytics30.health || { markers: {}, filledCount: 0, totalCount: 0 };
    var wellbeing = analytics7.wellbeing || {};
    var weeklySummary = analytics7.summary || {};
    var setup = getSetupModel(state);
    var firstWeek = getFirstWeekModel(state);
    var firstWeekSupport = getFirstWeekSupport(state);
    var narrative = getNarrativePack({
      state: state,
      analytics7: analytics7,
      analytics30: analytics30,
      setup: setup,
      firstWeek: firstWeek,
      firstWeekSupport: firstWeekSupport
    }) || {};
    var review = window.HabitAiReviewStore && window.HabitAiReviewStore.getLatestReview
      ? window.HabitAiReviewStore.getLatestReview(state.currentHabit.id)
      : null;
    var toneMeta = narrative.meta || { id: state.profile.guidanceTone || "supportive", label: "Поддержка", summary: "мягко и без давления" };
    var todayKey = window.HabitStore.helpers.formatDateKey(new Date());
    var todaySlips = state.slips.filter(function (item) { return item.localDate === todayKey; }).length;
    var todayResisted = state.resisted.filter(function (item) { return item.localDate === todayKey; }).length;
    var config = getCurrentHabitConfig(state);
    var markers = health.markers || {};
    var bpReady = markers.bloodPressureSystolic != null && markers.bloodPressureDiastolic != null;

    return {
      hero: {
        initials: state.profile.initials,
        userName: state.profile.userName,
        habitLabel: state.currentHabit.name + " · поведенческий индекс",
        index: summary.dependencyIndex || 0,
        indexMeta: riskLabel(summary.riskLevel)
      },
      today: {
        slips: todaySlips,
        resisted: todayResisted,
        mainTrigger: summary.mainTrigger,
        riskWindow: summary.riskWindow,
        message: (narrative.profile && narrative.profile.body) || summary.narrative
      },
      setup: setup,
      firstWeek: firstWeek,
      firstWeekReview: firstWeekSupport.review || null,
      weeklySnapshot: {
        sub: Number(weeklySummary.observedDays || 0) >= 4
          ? "Самое важное за последние 7 дней одним взглядом."
          : "Неделя ещё собирает основу, но первые сигналы уже можно замечать.",
        badge: Number(weeklySummary.observedDays || 0) >= 4 ? "есть ритм" : "ранний период",
        behaviorValue: "Индекс " + (weeklySummary.dependencyIndex || 0) + " · " + riskLabel(weeklySummary.riskLevel),
        behaviorCopy: "Главный триггер: " + String(weeklySummary.mainTrigger || "Другое").toLowerCase() + ". Окно внимания: " + (weeklySummary.riskWindow || "—") + ".",
        stateValue: wellbeing.stateEntryCount
          ? "Стресс " + (((wellbeing.averages || {}).stress || 0).toFixed(1)) + "/5 · энергия " + (((wellbeing.averages || {}).energy || 0).toFixed(1)) + "/5"
          : "Данных пока мало",
        stateCopy: wellbeing.stateEntryCount
          ? "Записей состояния: " + wellbeing.stateEntryCount + " · " + compactTrendLabel(wellbeing.trend && wellbeing.trend.direction) + (wellbeing.contextLabel ? " · чаще фон связан с \"" + wellbeing.contextLabel + "\"." : ".")
          : "Когда появятся записи состояния, здесь станет видно фон недели и его ритм.",
        healthValue: (analytics7.health && analytics7.health.filledCount || 0) + " из " + (analytics7.health && analytics7.health.totalCount || 0) + " маркеров",
        healthCopy: compactHealthLabel(analytics7.health && analytics7.health.trendDirection) + " · " + ((analytics7.health && analytics7.health.trendSummary) || "Пока нет прошлого замера для сравнения.")
      },
      financeHealth: {
        monthSpent: formatMoney(finance.monthSpent || 0, finance.currencySymbol || config.currencySymbol || "₽"),
        monthProjection: "Прогноз на месяц: " + formatMoney(finance.monthProjection || 0, finance.currencySymbol || config.currencySymbol || "₽"),
        monthHours: formatHours(finance.monthHours || 0),
        episodeMeta: formatMoney(finance.costPerEpisode || 0, finance.currencySymbol || config.currencySymbol || "₽") + " и " + (finance.minutesPerEpisode || 0) + " мин на эпизод",
        sleep: markers.sleepHours != null ? String(markers.sleepHours) + " ч" : "не заполнено",
        restingHr: markers.restingHeartRate != null ? String(markers.restingHeartRate) + " уд/мин" : "не заполнено",
        bp: bpReady ? String(markers.bloodPressureSystolic) + "/" + String(markers.bloodPressureDiastolic) : "не заполнено",
        body: (markers.weightKg != null || markers.waistCm != null)
          ? [markers.weightKg != null ? String(markers.weightKg) + " кг" : null, markers.waistCm != null ? String(markers.waistCm) + " см" : null].filter(Boolean).join(" · ")
          : "не заполнено",
        note: health.filledCount
          ? "Заполнено " + health.filledCount + " из " + health.totalCount + " health markers. Аналитика их не диагностирует, а только хранит как личный контекст."
          : "Пока health markers пустые. Можно начать хотя бы со сна, пульса в покое и давления."
      },
      details: {
        guidanceSummary: toneMeta.label + " · " + toneMeta.summary,
        guidancePreview: (narrative.today && narrative.today.body) || summary.narrative,
        financeSummary:
          "30 дней: " + formatMoney(finance.monthSpent || 0, finance.currencySymbol || "₽") +
          " · маркеров: " + (health.filledCount || 0) + "/" + (health.totalCount || 0),
        assessmentSummary: state.currentHabit.assessmentComplete
          ? "Заполнен: " + state.currentHabit.assessmentSummary
          : "4 коротких вопроса для стартовой точности",
        aiReviewSummary: review
          ? "Последний разбор: " + window.HabitStore.helpers.todayLabel(new Date(review.createdAt)) + " · действий: " + ((review.actionItems && review.actionItems.length) || 0)
          : "Последнего разбора пока нет",
        aiReview: review
      }
    };
  }

  function buildInsightsScreenModel(state, period) {
    var model = analytics(period || "30d");
    var setup = getSetupModel(state);
    var firstWeek = getFirstWeekModel(state);
    var firstWeekSupport = getFirstWeekSupport(state);
    var monthly = analytics("30d");
    var narrative = getNarrativePack({
      state: state,
      analytics7: period === "7d" ? model : analytics("7d"),
      analytics30: period === "30d" ? model : monthly,
      setup: setup,
      firstWeek: firstWeek,
      firstWeekSupport: firstWeekSupport
    }) || {};
    var hasBehaviorData = (state.slips.length + state.resisted.length + state.diaryEntries.length) > 0;
    var summary = model.summary || {};
    var wellbeing = model.wellbeing || {};
    var financialLoad = model.financialLoad || { trend: {} };
    var health = model.health || { filledCount: 0, totalCount: 7, markers: {} };
    var physical = buildPhysicalSignalsModel(state);
    var orientationImpact = buildOrientationImpactModel(state, period || "30d");
    var workedSupports = buildWorkedSupportsModel(state, period || "30d");
    var markers = health.markers || {};
    var bp = markers.bloodPressureSystolic != null && markers.bloodPressureDiastolic != null
      ? String(markers.bloodPressureSystolic) + "/" + String(markers.bloodPressureDiastolic)
      : "не заполнено";
    var topSubscore = (summary.subscores && [
      { label: "Тяга", value: summary.subscores.cravingScore || 0 },
      { label: "Автоматизм", value: summary.subscores.automaticityScore || 0 },
      { label: "Контроль", value: summary.subscores.lossOfControlScore || 0 },
      { label: "Эмоции", value: summary.subscores.emotionalRelianceScore || 0 },
      { label: "Восстановление", value: summary.subscores.recoveryScore || 0 }
    ].sort(function (a, b) { return b.value - a.value; })[0]) || { label: "Тяга", value: 0 };
    var financeTrend = financialLoad.trend || { direction: "stable", delta: 0 };
    var financeTrendText = financeTrend.direction === "up"
      ? "растёт"
      : financeTrend.direction === "down"
        ? "снижается"
        : "стабильна";

    return {
      raw: model,
      summaryView: {
        headline: (orientationImpact && orientationImpact.headline) || (narrative.insight && narrative.insight.headline) || summary.headline,
        badge: summary.badge,
        narrative: (orientationImpact && orientationImpact.narrative) || (narrative.insight && narrative.insight.narrative) || summary.narrative,
        forecastText: summary.forecastText,
        confidenceText: summary.confidenceText,
        recommendation: (narrative.insight && narrative.insight.recommendation) || (workedSupports && workedSupports.items && workedSupports.items[0]
          ? "На этот период лучше всего опереться на: " + workedSupports.items[0].text + "."
          : ""),
        meta: orientationImpact && orientationImpact.meta ? orientationImpact.meta : ("За " + model.daysLabel.toLowerCase())
      },
      hasBehaviorData: hasBehaviorData,
      subtitle: "Что стоит за привычкой: " + state.currentHabit.name,
      setup: {
        model: setup,
        meta: "Готово " + setup.completed + " из " + setup.total + " шагов",
        title: !hasBehaviorData
          ? "нсайтам нужны первые сигналы"
          : setup.nextStep && setup.nextStep.id === "assessment"
            ? "Теперь уточни стартовую нагрузку"
            : "Добавь личный контекст",
        copy: !hasBehaviorData
          ? "Когда появятся первые записи и события, приложение сможет показать окна риска, триггеры и рабочие закономерности."
          : setup.nextStep && setup.nextStep.id === "assessment"
            ? "Первые сигналы уже есть. Следом опрос поможет сделать выводы точнее и спокойнее."
            : "Финансы, время и health markers дадут инсайтам больше веса и связи с реальной жизнью.",
        buttonLabel: !hasBehaviorData
          ? "Сделать первый шаг"
          : setup.nextStep && setup.nextStep.id === "assessment"
            ? "Открыть опрос"
            : "Открыть настройку"
      },
      firstWeek: {
        model: firstWeek,
        support: firstWeekSupport,
        visible: hasBehaviorData && !!firstWeek.active
      },
      detailSummaries: {
        index: topSubscore.label + " сейчас сильнее всего влияет на индекс: " + Math.round(topSubscore.value) + "/100.",
        finance: "Нагрузка " + (financialLoad.label || "низкая") + " и " + financeTrendText + "; маркеров заполнено " + (health.filledCount || 0) + "/" + (health.totalCount || 7) + ".",
        period: "Окно риска: " + (summary.riskWindow || "—") + ". Главный триггер: " + String(summary.mainTrigger || "Другое").toLowerCase() + "." + (physical.topLabel ? " По телу чаще всего повторяется: " + physical.topLabel.toLowerCase() + "." : "")
      },
      workedSupports: workedSupports,
      meta: {
        financialLoadText:
          (financialLoad.headline || "Финансовая нагрузка низкая") +
          ". Главный драйвер: " + (financialLoad.driver || "частота эпизодов") +
          ". " + ((financialLoad.trend && financialLoad.trend.text) || "Почти без изменений к прошлому периоду.") +
          " " + (financialLoad.narrative || ""),
        periodSpent: formatMoney((model.finance && (model.finance.monthSpent || model.finance.weekSpent)) || 0, model.finance && model.finance.currencySymbol || "₽"),
        periodSpentCopy:
          "Прогноз на месяц: " + formatMoney((model.finance && model.finance.monthProjection) || 0, model.finance && model.finance.currencySymbol || "₽") +
          ". Время: " + ((model.finance && model.finance.monthHours) || 0) + " ч.",
        healthText:
          "Сон: " + (markers.sleepHours != null ? markers.sleepHours + " ч" : "не заполнено") +
          ". Давление: " + bp + ". " +
          (health.trendSummary || "Пока нет прошлого замера для сравнения."),
        physicalValue: physical.top.length ? physical.top.map(function (item) { return item.label; }).join(" · ") : "Пока не отмечены",
        physicalText: physical.top.length
          ? "Чаще всего повторяются: " + physical.top.map(function (item) { return item.label.toLowerCase() + " (" + item.count + ")"; }).join(", ") + "."
          : "Когда появятся телесные сигналы вроде головной боли или слабости, здесь начнёт собираться телесный паттерн привычки."
      }
    };
  }

  window.HabitScreenModels = {
    buildMainScreenModel: buildMainScreenModel,
    buildDiaryScreenModel: buildDiaryScreenModel,
    buildProfileScreenModel: buildProfileScreenModel,
    buildInsightsScreenModel: buildInsightsScreenModel
  };
})();


