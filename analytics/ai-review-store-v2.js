(function () {
  var STORAGE_KEY = "habit_ai_reviews_v2";
  var LEGACY_STORAGE_KEY = "habit_ai_reviews_v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildEmptyState() {
    return {
      byHabit: {},
      plansByHabit: {}
    };
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        parsed.byHabit = parsed.byHabit || {};
        parsed.plansByHabit = parsed.plansByHabit || {};
        return parsed;
      }

      var legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        var legacyParsed = JSON.parse(legacyRaw);
        return {
          byHabit: legacyParsed.byHabit || {},
          plansByHabit: {}
        };
      }
    } catch (error) {
      return buildEmptyState();
    }

    return buildEmptyState();
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 10);
  }

  function normalizeText(text) {
    return String(text || "").replace(/\r/g, "").trim();
  }

  function normalizePlanItems(items) {
    return (items || []).map(function (item) {
      if (typeof item === "string") {
        return {
          id: uid("plan_item"),
          text: normalizeText(item),
          completed: false,
          completedAt: null
        };
      }

      return {
        id: item.id || uid("plan_item"),
        text: normalizeText(item.text),
        completed: Boolean(item.completed),
        completedAt: item.completedAt || null
      };
    }).filter(function (item) {
      return item.text;
    }).slice(0, 5);
  }

  function splitLines(text) {
    return normalizeText(text)
      .split("\n")
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function normalizeLine(line) {
    return line
      .replace(/^(\d+\.\s+|[-*•]\s+)/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractBulletItems(lines) {
    return lines
      .filter(function (line) {
        return /^(\d+\.\s+|[-*•]\s+)/.test(line);
      })
      .map(normalizeLine)
      .filter(Boolean);
  }

  function extractParagraphs(lines) {
    return lines
      .filter(function (line) {
        return !/^(\d+\.\s+|[-*•]\s+)/.test(line) && line.length > 40;
      })
      .map(function (line) {
        return line.replace(/\s+/g, " ").trim();
      });
  }

  function sentencesFromParagraphs(paragraphs) {
    return paragraphs
      .join(" ")
      .split(/(?<=[.!?])\s+/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function tryParseJson(text) {
    try {
      var parsed = JSON.parse(normalizeText(text));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function parseStructuredReview(json) {
    if (!json || typeof json !== "object") return null;
    if (!json.main_insight || !json.pattern || !json.advice) return null;

    var actionItems = [
      json.advice,
      json.support_anchor ? "?????: " + json.support_anchor : "",
      json.trigger_top ? "Главный триггер: " + json.trigger_top : "",
      json.best_day ? "Лучший день: " + json.best_day : "",
      json.worst_time ? "Риск-окно: " + json.worst_time : ""
    ].filter(Boolean);

    var highlights = [
      json.pattern,
      json.trigger_top ? "Чаще всего это связано с: " + json.trigger_top : "",
      json.best_day ? "Лучший день недели: " + json.best_day : "",
      json.worst_time ? "Самый сложный слот: " + json.worst_time : ""
    ].filter(Boolean);

    return {
      summary: normalizeText(json.main_insight + " " + json.pattern + (json.physical_pattern ? " " + json.physical_pattern : "")),
      actionItems: actionItems,
      highlights: highlights,
      rawLines: Object.keys(json).map(function (key) {
        return key + ": " + json[key];
      })
    };
  }

  function parseAiResponse(text) {
    var structured = parseStructuredReview(tryParseJson(text));
    if (structured) {
      return structured;
    }

    var lines = splitLines(text);
    var bullets = extractBulletItems(lines);
    var paragraphs = extractParagraphs(lines);
    var sentences = sentencesFromParagraphs(paragraphs);
    var actionItems = bullets.slice(0, 5);

    if (!actionItems.length) {
      actionItems = sentences.slice(0, 5);
    }

    return {
      summary: paragraphs.slice(0, 2).join(" ").trim() || sentences.slice(0, 2).join(" ").trim() || lines.slice(0, 2).join(" ").trim(),
      actionItems: actionItems,
      highlights: bullets.slice(0, 5),
      rawLines: lines
    };
  }

  function ensureReviewList(state, habitId) {
    state.byHabit = state.byHabit || {};
    state.byHabit[habitId] = state.byHabit[habitId] || [];
    return state.byHabit[habitId];
  }

  function ensurePlanSlot(state, habitId) {
    state.plansByHabit = state.plansByHabit || {};
    if (!(habitId in state.plansByHabit)) {
      state.plansByHabit[habitId] = null;
    }
    return state.plansByHabit;
  }

  function buildPlanPayload(payload) {
    return {
      id: uid("plan"),
      createdAt: new Date().toISOString(),
      sourceReviewId: payload.sourceReviewId || null,
      sourceCreatedAt: payload.sourceCreatedAt || null,
      summary: normalizeText(payload.summary),
      items: normalizePlanItems(payload.items)
    };
  }

  function saveReview(habitId, payload) {
    var state = readState();
    var list = ensureReviewList(state, habitId);
    var responseText = normalizeText(payload.responseText);
    var parsed = parseAiResponse(responseText);
    var item = {
      id: uid("review"),
      habitId: habitId,
      createdAt: new Date().toISOString(),
      promptText: normalizeText(payload.promptText),
      responseText: responseText,
      summary: parsed.summary,
      actionItems: parsed.actionItems,
      highlights: parsed.highlights
    };

    list.unshift(item);
    writeState(state);
    return clone(item);
  }

  function getReviews(habitId) {
    var state = readState();
    return clone(ensureReviewList(state, habitId));
  }

  function getLatestReview(habitId) {
    var reviews = getReviews(habitId);
    return reviews.length ? reviews[0] : null;
  }

  function saveWeeklyPlan(habitId, payload) {
    var state = readState();
    var plans = ensurePlanSlot(state, habitId);
    var plan = buildPlanPayload(payload);
    plans[habitId] = plan;
    writeState(state);
    return clone(plan);
  }

  function buildPlanFromReview(habitId, reviewId) {
    var reviews = getReviews(habitId);
    var review = reviews.find(function (item) {
      return item.id === reviewId;
    });

    if (!review) {
      return null;
    }

    return saveWeeklyPlan(habitId, {
      sourceReviewId: review.id,
      sourceCreatedAt: review.createdAt,
      summary: review.summary,
      items: review.actionItems && review.actionItems.length ? review.actionItems : review.highlights
    });
  }

  function getWeeklyPlan(habitId) {
    var state = readState();
    state.plansByHabit = state.plansByHabit || {};
    if (!state.plansByHabit[habitId]) {
      return null;
    }

    var plan = clone(state.plansByHabit[habitId]);
    plan.items = normalizePlanItems(plan.items);
    return plan;
  }

  function clearWeeklyPlan(habitId) {
    var state = readState();
    state.plansByHabit = state.plansByHabit || {};
    state.plansByHabit[habitId] = null;
    writeState(state);
  }

  function toggleWeeklyPlanItem(habitId, itemId) {
    var state = readState();
    var plans = ensurePlanSlot(state, habitId);
    var plan = plans[habitId];
    if (!plan || !plan.items) {
      return null;
    }

    plan.items = normalizePlanItems(plan.items).map(function (item) {
      if (item.id !== itemId) {
        return item;
      }

      return {
        id: item.id,
        text: item.text,
        completed: !item.completed,
        completedAt: item.completed ? null : new Date().toISOString()
      };
    });

    writeState(state);
    return clone(plan);
  }

  function getPlanProgress(plan) {
    if (!plan || !plan.items || !plan.items.length) {
      return {
        total: 0,
        completed: 0,
        ratio: 0
      };
    }

    var completed = plan.items.filter(function (item) {
      return item.completed;
    }).length;

    return {
      total: plan.items.length,
      completed: completed,
      ratio: completed / plan.items.length
    };
  }

  function getPlanImpact(plan, dependencyIndex) {
    var progress = getPlanProgress(plan);
    var supportGain = Math.round(progress.ratio * 20);
    var adjustedIndex = Math.max(0, Math.round(dependencyIndex - supportGain));
    var projectedRisk = adjustedIndex >= 75 ? "very_high" : adjustedIndex >= 50 ? "high" : adjustedIndex >= 25 ? "moderate" : "low";

    return {
      progress: progress,
      supportGain: supportGain,
      adjustedIndex: adjustedIndex,
      projectedRisk: projectedRisk
    };
  }

  window.HabitAiReviewStore = {
    parseAiResponse: parseAiResponse,
    saveReview: saveReview,
    getReviews: getReviews,
    getLatestReview: getLatestReview,
    saveWeeklyPlan: saveWeeklyPlan,
    buildPlanFromReview: buildPlanFromReview,
    getWeeklyPlan: getWeeklyPlan,
    clearWeeklyPlan: clearWeeklyPlan,
    toggleWeeklyPlanItem: toggleWeeklyPlanItem,
    getPlanProgress: getPlanProgress,
    getPlanImpact: getPlanImpact
  };
})();
