(function () {
  var SETTINGS_KEY = "habit_gemini_demo_settings_v1";
  var DEFAULT_MODEL = "gemini-flash-latest";
  var DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";
  var DEFAULT_WARNING = "Данные будут отправлены во внешний сервис Google Gemini только после явного подтверждения.";

  var SYSTEM_PROMPT = [
    "Ты — тёплый и поддерживающий психолог-аналитик в приложении для отслеживания вредных привычек.",
    "Твоя задача: анализировать данные пользователя и находить паттерны.",
    "Говори на русском, кратко, без осуждения.",
    "Всегда заканчивай конкретным советом на ближайшие 7 дней.",
    "Не ставь диагноз и не изображай терапевта.",
    "Если данных мало, честно скажи об этом и всё равно дай мягкий следующий шаг."
  ].join(" ");

  function readSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { apiKey: "", model: DEFAULT_MODEL, rememberKey: true };
      var parsed = JSON.parse(raw);
      return {
        apiKey: String(parsed.apiKey || ""),
        model: String(parsed.model || DEFAULT_MODEL),
        rememberKey: parsed.rememberKey !== false
      };
    } catch (error) {
      return { apiKey: "", model: DEFAULT_MODEL, rememberKey: true };
    }
  }

  function writeSettings(nextSettings) {
    var payload = {
      apiKey: String(nextSettings.apiKey || ""),
      model: String(nextSettings.model || DEFAULT_MODEL),
      rememberKey: nextSettings.rememberKey !== false
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    return payload;
  }

  function clearSettings() {
    localStorage.removeItem(SETTINGS_KEY);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeDayPattern(analytics) {
    var pattern = analytics && analytics.dayPattern ? analytics.dayPattern : {};
    return {
      title: normalizeText(pattern.title),
      text: normalizeText(pattern.text),
      highlight: normalizeText(pattern.highlight)
    };
  }

  function buildTriggerSummary(bundle) {
    var analytics30 = bundle.analytics && bundle.analytics["30d"] ? bundle.analytics["30d"] : {};
    var triggers = analytics30.triggers || [];
    if (!triggers.length) return "- данных по триггерам пока мало";
    return triggers.slice(0, 6).map(function (item) {
      var share = typeof item.share === "number" ? Math.round(item.share * 100) : null;
      return "- " + item.label + ": " + item.count + (share != null ? " (" + share + "%)" : "");
    }).join("\n");
  }

  function looksLikeNoise(text) {
    var value = normalizeText(text);
    if (!value) return true;
    if (value.length <= 1) return true;
    if (value.length <= 3 && /^[0-9]+$/.test(value)) return true;
    if (value.length <= 4 && /^[а-яА-Яa-zA-Z]+$/.test(value)) return true;
    if (/^[0-9а-яА-Яa-zA-Z]+$/.test(value) && value.length <= 5) return true;
    return false;
  }

  function cleanDiaryEntries(bundle) {
    return (bundle.diaryEntries || []).filter(function (entry) {
      return !looksLikeNoise(entry.text) || (Array.isArray(entry.bodySignals) && entry.bodySignals.length > 0);
    });
  }

  function buildDiarySummary(bundle) {
    var entries = cleanDiaryEntries(bundle).slice(0, 12).map(function (entry) {
      var prefix = entry.tag ? "(" + entry.tag + ") " : "";
      var body = Array.isArray(entry.bodySignals) && entry.bodySignals.length
        ? " · телесные сигналы: " + entry.bodySignals.join(", ")
        : "";
      return "- [" + entry.timeLabel + "] " + prefix + entry.text + body;
    });
    return entries.length ? entries.join("\n") : "- записей пока мало";
  }

  function buildPhysicalSummary(bundle) {
    var counts = {};
    (bundle.events && bundle.events.slips ? bundle.events.slips : []).forEach(function (item) {
      (item.bodySignals || []).forEach(function (signal) {
        counts[signal] = (counts[signal] || 0) + 1;
      });
    });
    (bundle.diaryEntries || []).forEach(function (entry) {
      (entry.bodySignals || []).forEach(function (signal) {
        counts[signal] = (counts[signal] || 0) + 1;
      });
    });
    var pairs = Object.keys(counts).sort(function (left, right) {
      return counts[right] - counts[left];
    }).slice(0, 6).map(function (key) {
      return key + " — " + counts[key];
    });
    return pairs.length ? pairs.join(", ") : "явных телесных сигналов пока мало";
  }

  function buildHourlySummary(bundle) {
    var buckets = {};
    (bundle.events && bundle.events.slips ? bundle.events.slips : []).forEach(function (item) {
      var key = item.localHour != null ? String(item.localHour).padStart(2, "0") + ":00" : String(item.timeBucket || "неизвестно");
      buckets[key] = (buckets[key] || 0) + 1;
    });
    var pairs = Object.keys(buckets).sort().map(function (key) {
      return key + " — " + buckets[key];
    });
    return pairs.length ? pairs.join(", ") : "данных по часам пока мало";
  }

  function buildDailySummary(bundle) {
    var buckets = {};
    (bundle.events && bundle.events.slips ? bundle.events.slips : []).forEach(function (item) {
      buckets[item.localDate] = (buckets[item.localDate] || 0) + 1;
    });
    var pairs = Object.keys(buckets).sort().map(function (key) {
      return key + " — " + buckets[key];
    });
    return pairs.length ? pairs.join(", ") : "данных по дням пока мало";
  }

  function buildSlipSummary(bundle) {
    var slips = (bundle.events && bundle.events.slips ? bundle.events.slips : []).slice(0, 12).map(function (item) {
      var parts = [
        "- [" + item.timeLabel + "]",
        "триггер: " + item.trigger,
        "тяга: " + item.cravingLevel + "/5",
        "заметка: " + (item.note || "без комментария")
      ];
      if (item.bodySignals && item.bodySignals.length) {
        parts.push("телесные сигналы: " + item.bodySignals.join(", "));
      }
      if (item.slipNote) {
        parts.push("мысль после эпизода: " + item.slipNote);
      }
      return parts.join("; ");
    });
    return slips.length ? slips.join("\n") : "- эпизодов пока мало";
  }

  function buildUserPrompt(bundle) {
    var analytics30 = bundle.analytics && bundle.analytics["30d"] ? bundle.analytics["30d"] : {};
    var summary30 = analytics30.summary || {};
    var wellbeing30 = analytics30.wellbeing || {};
    var dayPattern = safeDayPattern(analytics30);
    var totalSlips = bundle.events && bundle.events.slips ? bundle.events.slips.length : 0;
    var privacy = bundle.meta && bundle.meta.privacy ? bundle.meta.privacy : {};
    var insight = normalizeText(summary30.headline || "");
    var narrative = normalizeText(summary30.narrative || "");
    var wellbeingLine = wellbeing30 && wellbeing30.stateEntryCount
      ? "Фон состояния тоже заметен: стресс " + ((wellbeing30.averages && wellbeing30.averages.stress) ? wellbeing30.averages.stress.toFixed(1) : "0.0") + "/5, энергия " + ((wellbeing30.averages && wellbeing30.averages.energy) ? wellbeing30.averages.energy.toFixed(1) : "0.0") + "/5."
      : "Данных по состоянию пока мало.";

    return [
      "Ниже данные по одной привычке пользователя. Проанализируй их как инструмент рефлексии, а не как диагноз.",
      "",
      "Правила ответа:",
      "1. Не ставь диагноз и не изображай терапевта.",
      "2. Не используй пугающие формулировки.",
      "3. Опирайся только на данные ниже.",
      "4. Дай практический, поддерживающий разбор.",
      "",
      "Что нужно в ответе:",
      "1. 5 главных паттернов поведения.",
      "2. Повторяющиеся триггеры и сценарии.",
      "3. Какие мысли или состояния чаще всего предшествуют эпизодам.",
      "4. Какие телесные сигналы или физические последствия уже начинают повторяться.",
      "5. Что уже работает как опора.",
      "6. 5 конкретных действий на ближайшую неделю.",
      "",
      "Контекст приватности:",
      "- Имя: " + (privacy.includeName ? "доступно" : "скрыто"),
      "- Дневник: " + (privacy.diaryScope === "recent" ? "последние 10 записей" : "полный"),
      "- Время: " + (privacy.timePrecision === "exact" ? "точное" : "диапазонами"),
      "",
      "Сводка за 30 дней:",
      "- Пользователь: " + normalizeText(bundle.profile && bundle.profile.userName),
      "- Привычка: " + normalizeText(bundle.habit && bundle.habit.name),
      "- Индекс нагрузки: " + normalizeText(summary30.dependencyIndex),
      "- Уровень риска: " + normalizeText(summary30.riskLevel || "данных мало"),
      "- Окно риска: " + normalizeText(summary30.riskWindow || "данных мало"),
      "- Главный триггер: " + normalizeText(summary30.mainTrigger || "данных мало"),
      "- Инсайт: " + (insight || "данных пока мало"),
      "- Контекст: " + (narrative || "данных пока мало") + " " + wellbeingLine,
      "",
      "Статистика за последние 7 дней:",
      "- Всего срывов: " + totalSlips,
      "- По дням: " + buildDailySummary(bundle),
      "- По часам: " + buildHourlySummary(bundle),
      "",
      "Триггеры:",
      buildTriggerSummary(bundle),
      "",
      "Телесные сигналы:",
      buildPhysicalSummary(bundle),
      "",
      "Паттерн недели:",
      "- " + (dayPattern.title || "данных пока мало"),
      "- " + (dayPattern.text || "данных пока мало"),
      "- " + (dayPattern.highlight || "данных пока мало"),
      "",
      "Последние записи дневника:",
      buildDiarySummary(bundle),
      "",
      "Последние эпизоды:",
      buildSlipSummary(bundle)
    ].join("\n");
  }

  function buildResponseSchema() {
    return {
      type: "object",
      properties: {
        main_insight: { type: "string" },
        pattern: { type: "string" },
        trigger_top: { type: "string" },
        physical_pattern: { type: "string" },
        support_anchor: { type: "string" },
        best_day: { type: "string" },
        worst_time: { type: "string" },
        advice: { type: "string" }
      },
      required: ["main_insight", "pattern", "trigger_top", "physical_pattern", "support_anchor", "best_day", "worst_time", "advice"],
      propertyOrdering: ["main_insight", "pattern", "trigger_top", "physical_pattern", "support_anchor", "best_day", "worst_time", "advice"]
    };
  }

  function buildRequestBody(bundle) {
    return {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: [
        {
          parts: [{ text: buildUserPrompt(bundle) }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        responseJsonSchema: buildResponseSchema()
      }
    };
  }

  function extractText(response) {
    var candidate = response && response.candidates && response.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) return "";
    return candidate.content.parts.map(function (part) {
      return typeof part.text === "string" ? part.text : "";
    }).join("").trim();
  }

  function toReviewText(result) {
    return JSON.stringify(result, null, 2);
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function requestOnce(endpoint, apiKey, requestBody) {
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          var message = payload && payload.error && payload.error.message
            ? payload.error.message
            : "Gemini не ответил корректно.";
          throw { code: "api_error", status: response.status, message: message, payload: payload };
        }
        var text = extractText(payload);
        if (!text) {
          throw { code: "empty_response", message: "Gemini вернул пустой ответ.", payload: payload };
        }
        var parsed;
        try {
          parsed = JSON.parse(text);
        } catch (error) {
          throw { code: "invalid_json", message: "Gemini вернул ответ не в JSON.", rawText: text, payload: payload };
        }
        return {
          raw: payload,
          json: parsed,
          reviewText: toReviewText(parsed)
        };
      });
    });
  }

  function generateAnalysis(bundle, options) {
    var settings = readSettings();
    var opts = options || {};
    var apiKey = String(opts.apiKey || settings.apiKey || "").trim();
    var model = String(opts.model || settings.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

    if (!apiKey) {
      return Promise.reject({ code: "missing_api_key", message: "Нужен API key Gemini." });
    }

    var endpoint = DEFAULT_ENDPOINT + encodeURIComponent(model) + ":generateContent";
    var requestBody = buildRequestBody(bundle);

    return requestOnce(endpoint, apiKey, requestBody).catch(function (error) {
      if (error && error.code === "api_error" && error.status === 503) {
        return wait(800).then(function () {
          return requestOnce(endpoint, apiKey, requestBody);
        });
      }
      throw error;
    }).then(function (result) {
      return {
        model: model,
        requestBody: requestBody,
        raw: result.raw,
        json: result.json,
        reviewText: result.reviewText
      };
    });
  }

  window.HabitGemini = {
    DEFAULT_MODEL: DEFAULT_MODEL,
    DEFAULT_WARNING: DEFAULT_WARNING,
    readSettings: readSettings,
    writeSettings: writeSettings,
    clearSettings: clearSettings,
    buildRequestBody: buildRequestBody,
    buildUserPrompt: buildUserPrompt,
    generateAnalysis: generateAnalysis
  };
})();
