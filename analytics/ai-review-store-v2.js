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

  function sanitizeAiDisplayText(text) {
    var value = normalizeText(text);
    if (!value) return "";
    return value
      .replace(/^\?{3,}\s*:\s*/i, "Что уже работает: ")
      .replace(/^Р“Р»Р°РІРЅС‹Р№\s+С‚СЂРёРіРіРµСЂ:\s*/i, "Главный триггер: ")
      .replace(/^Р›СѓС‡С€РёР№\s+РґРµРЅСЊ:\s*/i, "Более устойчивый день: ")
      .replace(/^Р РёСЃРє-РѕРєРЅРѕ:\s*/i, "Риск-окно: ")
      .replace(/^Р§Р°С‰Рµ\s+РІСЃРµРіРѕ\s+СЌС‚Рѕ\s+СЃРІСЏР·Р°РЅРѕ\s+СЃ:\s*/i, "Чаще всего это связано с: ")
      .replace(/^Р›СѓС‡С€РёР№\s+РґРµРЅСЊ\s+РЅРµРґРµР»Рё:\s*/i, "Более устойчивый день недели: ")
      .replace(/^РЎР°РјС‹Р№\s+СЃР»РѕР¶РЅС‹Р№\s+СЃР»РѕС‚:\s*/i, "Самое уязвимое окно: ");
  }

  function sanitizeAiReviewPayload(payload) {
    var next = Object.assign({}, payload || {});
    next.summary = sanitizeAiDisplayText(next.summary);
    next.actionItems = (next.actionItems || []).map(sanitizeAiDisplayText).filter(Boolean);
    next.highlights = (next.highlights || []).map(sanitizeAiDisplayText).filter(Boolean);
    next.rawLines = (next.rawLines || []).map(sanitizeAiDisplayText).filter(Boolean);
    if (Array.isArray(next.sections)) {
      next.sections = next.sections.map(function (section) {
        return Object.assign({}, section, {
          title: sanitizeAiDisplayText(section && section.title),
          sourceTitle: sanitizeAiDisplayText(section && section.sourceTitle),
          items: (section && section.items || []).map(sanitizeAiDisplayText).filter(Boolean)
        });
      });
    }
    if (next.breakdown) {
      next.breakdown = {
        patterns: (next.breakdown.patterns || []).map(sanitizeAiDisplayText).filter(Boolean),
        triggers: (next.breakdown.triggers || []).map(sanitizeAiDisplayText).filter(Boolean),
        states: (next.breakdown.states || []).map(sanitizeAiDisplayText).filter(Boolean),
        supports: (next.breakdown.supports || []).map(sanitizeAiDisplayText).filter(Boolean),
        actions: (next.breakdown.actions || []).map(sanitizeAiDisplayText).filter(Boolean)
      };
    }
    return next;
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

  function splitRawLines(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map(function (line) { return line.trim(); });
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

  function normalizeSectionKey(title) {
    var normalized = normalizeText(title).toLowerCase();
    if (/паттерн|поведени/.test(normalized)) return "patterns";
    if (/триггер|сценари/.test(normalized)) return "triggers";
    if (/мысл|состояни|предшеств/.test(normalized)) return "states";
    if (/опора|работает/.test(normalized)) return "supports";
    if (/действ|шаг|недел/.test(normalized)) return "actions";
    return "other";
  }

  function sectionLabel(key) {
    var labels = {
      patterns: "Паттерны",
      triggers: "Триггеры и сценарии",
      states: "Что перед эпизодом",
      supports: "Что уже работает",
      actions: "Шаги на неделю",
      other: "Из разбора"
    };
    return labels[key] || labels.other;
  }

  function groupSectionLines(lines) {
    var groups = [];
    var current = [];

    lines.forEach(function (line) {
      if (!line) {
        if (current.length) {
          groups.push(current.join(" ").trim());
          current = [];
        }
        return;
      }

      current.push(normalizeLine(line));
    });

    if (current.length) {
      groups.push(current.join(" ").trim());
    }

    return groups.filter(Boolean);
  }

  function cleanSectionItems(sectionKey, items) {
    var list = (items || []).map(function (item) {
      return normalizeText(item);
    }).filter(Boolean);

    if (!list.length) {
      return [];
    }

    if (sectionKey === "states") {
      list = list.filter(function (item) {
        return !/^по данным видно/i.test(item) && !/повторяющихся внутренних состояний/i.test(item);
      });
    }

    if (sectionKey === "actions") {
      list = list.filter(function (item) {
        return !/^все шаги/i.test(item) && !/цель не .*ломать привычку/i.test(item);
      });
    }

    return list;
  }

  function buildFallbackHighlights(breakdown) {
    var result = [];
    ["patterns", "triggers", "supports"].forEach(function (key) {
      if (breakdown[key] && breakdown[key].length) {
        result.push(breakdown[key][0]);
      }
    });
    return result.slice(0, 5);
  }

  function parseSectionedResponse(text) {
    var rawLines = splitRawLines(text);
    var sections = [];
    var current = null;

    rawLines.forEach(function (line) {
      var match = line.match(/^(\d+)\.\s+(.+)$/);
      if (match) {
        current = {
          title: normalizeText(match[2]),
          key: normalizeSectionKey(match[2]),
          lines: []
        };
        sections.push(current);
        return;
      }

      if (current) {
        current.lines.push(line);
      }
    });

    if (!sections.length) {
      return null;
    }

    var breakdown = {
      patterns: [],
      triggers: [],
      states: [],
      supports: [],
      actions: []
    };

    var normalizedSections = sections.map(function (section) {
      var items = cleanSectionItems(section.key, groupSectionLines(section.lines));
      if (section.key !== "other" && items.length) {
        breakdown[section.key] = items.slice(0, section.key === "actions" ? 5 : 4);
      }
      return {
        key: section.key,
        title: sectionLabel(section.key),
        sourceTitle: section.title,
        items: items
      };
    }).filter(function (section) {
      return section.items && section.items.length;
    });

    return {
      sections: normalizedSections,
      breakdown: breakdown,
      summary:
        (breakdown.patterns[0] || "") +
        (breakdown.triggers[0] ? " " + breakdown.triggers[0] : "") +
        (breakdown.supports[0] ? " " + breakdown.supports[0] : ""),
      highlights: buildFallbackHighlights(breakdown),
      actionItems: breakdown.actions.slice(0, 5)
    };
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
      return sanitizeAiReviewPayload(structured);
    }

    var sectioned = parseSectionedResponse(text);
    if (sectioned) {
      return sanitizeAiReviewPayload({
        summary: normalizeText(sectioned.summary),
        actionItems: sectioned.actionItems,
        highlights: sectioned.highlights,
        rawLines: splitLines(text),
        sections: sectioned.sections,
        breakdown: sectioned.breakdown
      });
    }

    var lines = splitLines(text);
    var bullets = extractBulletItems(lines);
    var paragraphs = extractParagraphs(lines);
    var sentences = sentencesFromParagraphs(paragraphs);
    var actionItems = bullets.slice(0, 5);

    if (!actionItems.length) {
      actionItems = sentences.slice(0, 5);
    }

    return sanitizeAiReviewPayload({
      summary: paragraphs.slice(0, 2).join(" ").trim() || sentences.slice(0, 2).join(" ").trim() || lines.slice(0, 2).join(" ").trim(),
      actionItems: actionItems,
      highlights: bullets.slice(0, 5),
      rawLines: lines,
      sections: [],
      breakdown: {
        patterns: [],
        triggers: [],
        states: [],
        supports: [],
        actions: actionItems.slice(0, 5)
      }
    });
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
      highlights: parsed.highlights,
      sections: parsed.sections || [],
      breakdown: parsed.breakdown || {
        patterns: [],
        triggers: [],
        states: [],
        supports: [],
        actions: parsed.actionItems || []
      }
    };

    list.unshift(item);
    writeState(state);
    return clone(item);
  }

  function getReviews(habitId) {
    var state = readState();
    return clone(ensureReviewList(state, habitId)).map(function (review) {
      if (!review || !review.responseText) {
        return review;
      }

      var reparsed = parseAiResponse(review.responseText);
      return Object.assign({}, review, {
        summary: reparsed.summary || review.summary,
        actionItems: reparsed.actionItems && reparsed.actionItems.length ? reparsed.actionItems : (review.actionItems || []),
        highlights: reparsed.highlights && reparsed.highlights.length ? reparsed.highlights : (review.highlights || []),
        sections: reparsed.sections || [],
        breakdown: reparsed.breakdown || {
          patterns: [],
          triggers: [],
          states: [],
          supports: [],
          actions: reparsed.actionItems || []
        }
      });
    });
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
      items: review.breakdown && review.breakdown.actions && review.breakdown.actions.length
        ? review.breakdown.actions
        : review.actionItems && review.actionItems.length
          ? review.actionItems
          : review.highlights
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
