(function () {
  var STORAGE_KEY = "habit_ai_reviews_v1";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { byHabit: {} };
    } catch (error) {
      return { byHabit: {} };
    }
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

  function splitLines(text) {
    return normalizeText(text)
      .split("\n")
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function extractBulletItems(lines) {
    return lines
      .filter(function (line) {
        return /^(\d+\.\s+|-\s+|•\s+)/.test(line);
      })
      .map(function (line) {
        return line.replace(/^(\d+\.\s+|-\s+|•\s+)/, "").trim();
      })
      .filter(Boolean);
  }

  function extractParagraphs(lines) {
    return lines.filter(function (line) {
      return !/^(\d+\.\s+|-\s+|•\s+)/.test(line) && line.length > 30;
    });
  }

  function parseAiResponse(text) {
    var lines = splitLines(text);
    var bullets = extractBulletItems(lines);
    var paragraphs = extractParagraphs(lines);
    var actionItems = bullets.slice(0, 5);

    if (!actionItems.length) {
      actionItems = paragraphs
        .filter(function (line) {
          return /нужно|попробуй|стоит|сделай|подготовь|замени|поставь|снизь/i.test(line);
        })
        .slice(0, 5);
    }

    return {
      summary: paragraphs.slice(0, 2).join(" ").trim() || lines.slice(0, 2).join(" ").trim(),
      actionItems: actionItems,
      highlights: bullets.slice(0, 5),
      rawLines: lines
    };
  }

  function ensureHabit(state, habitId) {
    state.byHabit = state.byHabit || {};
    state.byHabit[habitId] = state.byHabit[habitId] || [];
    return state.byHabit[habitId];
  }

  function saveReview(habitId, payload) {
    var state = readState();
    var list = ensureHabit(state, habitId);
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
    var list = ensureHabit(state, habitId);
    return clone(list);
  }

  function getLatestReview(habitId) {
    var reviews = getReviews(habitId);
    return reviews.length ? reviews[0] : null;
  }

  window.HabitAiReviewStore = {
    parseAiResponse: parseAiResponse,
    saveReview: saveReview,
    getReviews: getReviews,
    getLatestReview: getLatestReview
  };
})();
