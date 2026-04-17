(function () {
  function mergeOptions(options) {
    options = options || {};
    return {
      includeName: options.includeName !== false,
      diaryScope: options.diaryScope === "recent" ? "recent" : "all",
      timePrecision: options.timePrecision === "range" ? "range" : "exact"
    };
  }

  function getDateLabel(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium"
    }).format(date);
  }

  function getTimestampLabel(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function getTimeBucket(hour) {
    if (hour >= 5 && hour < 11) return "СѓС‚СЂРѕ";
    if (hour >= 11 && hour < 17) return "РґРµРЅСЊ";
    if (hour >= 17 && hour < 22) return "РІРµС‡РµСЂ";
    return "РЅРѕС‡СЊ";
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function sanitizeText(text, profile, options) {
    var normalized = normalizeText(text);
    if (options.includeName) return normalized;

    if (profile && profile.userName) {
      normalized = normalized.replace(new RegExp("\\b" + escapeRegExp(profile.userName) + "\\b", "gi"), "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ");
    }
    if (profile && profile.initials) {
      normalized = normalized.replace(new RegExp("\\b" + escapeRegExp(profile.initials) + "\\b", "g"), "Рџ");
    }
    return normalized;
  }

  function buildProfileExport(profile, options) {
    return options.includeName
      ? { userName: profile.userName, initials: profile.initials }
      : { userName: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ", initials: "Рџ" };
  }

  function formatEventTime(date, options) {
    if (options.timePrecision === "exact") {
      return getTimestampLabel(date);
    }
    return getDateLabel(date) + ", " + getTimeBucket(date.getHours());
  }

  function compactSlip(item, helpers, profile, options) {
    var date = new Date(item.timestamp);
    return {
      timestamp: options.timePrecision === "exact" ? item.timestamp : null,
      localDate: item.localDate,
      localHour: options.timePrecision === "exact" ? item.localHour : null,
      timeLabel: formatEventTime(date, options),
      timeBucket: getTimeBucket(date.getHours()),
      trigger: helpers.triggerLabel(item.triggerTag),
      bodySignals: Array.isArray(item.bodySignals) ? item.bodySignals.map(helpers.bodySignalLabel) : [],
      cravingLevel: item.cravingLevel,
      note: sanitizeText(item.note || "", profile, options),
      slipNote: sanitizeText(item.slipNote || "", profile, options)
    };
  }

  function compactResisted(item, profile, options) {
    var date = new Date(item.timestamp);
    return {
      timestamp: options.timePrecision === "exact" ? item.timestamp : null,
      localDate: item.localDate,
      localHour: options.timePrecision === "exact" ? item.localHour : null,
      timeLabel: formatEventTime(date, options),
      timeBucket: getTimeBucket(date.getHours()),
      triggerTags: item.triggerTags || [],
      cravingLevel: item.cravingLevel,
      copingTool: sanitizeText(item.copingTool || "", profile, options)
    };
  }

  function compactDiaryEntry(item, helpers, profile, options) {
    var date = new Date(item.timestamp);
    return {
      timestamp: options.timePrecision === "exact" ? item.timestamp : null,
      timeLabel: formatEventTime(date, options),
      type: item.entryType,
      tag: item.tag ? helpers.triggerLabel(item.tag) : null,
      bodySignals: Array.isArray(item.bodySignals) ? item.bodySignals.map(helpers.bodySignalLabel) : [],
      text: sanitizeText(item.text, profile, options),
      relatedSlipId: item.relatedSlipId || null
    };
  }

  function topTriggerLabel(analytics) {
    return analytics.summary.mainTrigger || "РЅРµ РѕРїСЂРµРґРµР»С‘РЅ";
  }

  function sortByDateDesc(items) {
    return items.slice().sort(function (a, b) {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });
  }

  function applyDiaryScope(entries, options) {
    if (options.diaryScope === "recent") {
      return sortByDateDesc(entries).slice(0, 10);
    }
    return entries.slice();
  }

  function buildExportBundle(options) {
    options = mergeOptions(options);
    var state = window.HabitStore.getState();
    var helpers = window.HabitStore.helpers;
    var analytics7d = window.HabitAnalytics.getInsightViewModel("7d");
    var analytics30d = window.HabitAnalytics.getInsightViewModel("30d");
    var analytics90d = window.HabitAnalytics.getInsightViewModel("90d");
    var now = new Date();
    var diaryEntries = applyDiaryScope(state.diaryEntries, options);

    return {
      meta: {
        schemaVersion: 2,
        exportedAt: now.toISOString(),
        exportedAtLabel: getTimestampLabel(now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
        source: "habit-demo-app",
        privacy: {
          includeName: options.includeName,
          diaryScope: options.diaryScope,
          timePrecision: options.timePrecision
        }
      },
      profile: buildProfileExport(state.profile, options),
      habit: {
        id: state.currentHabit.id,
        name: state.currentHabit.name,
        dailyLimit: state.profile.dailyLimit,
        config: state.habitConfig || state.currentHabit.config || null
      },
      assessment: state.assessment,
      analytics: {
        "7d": analytics7d,
        "30d": analytics30d,
        "90d": analytics90d
      },
      events: {
        slips: sortByDateDesc(state.slips).map(function (item) { return compactSlip(item, helpers, state.profile, options); }),
        resisted: sortByDateDesc(state.resisted).map(function (item) { return compactResisted(item, state.profile, options); })
      },
      diaryEntries: diaryEntries.map(function (item) { return compactDiaryEntry(item, helpers, state.profile, options); })
    };
  }

  function buildMarkdownReport(bundle) {
    var analytics = bundle.analytics["30d"];
    var recentDiary = bundle.diaryEntries.slice(0, 10);
    var recentSlips = bundle.events.slips.slice(0, 10);

    return [
      "# Отчёт по привычке",
      "",
      "Дата выгрузки: " + bundle.meta.exportedAtLabel,
      "Часовой пояс: " + bundle.meta.timezone,
      "Настройки приватности: имя " + (bundle.meta.privacy.includeName ? "включено" : "скрыто") + ", дневник " + (bundle.meta.privacy.diaryScope === "recent" ? "последние 10 записей" : "полностью") + ", время " + (bundle.meta.privacy.timePrecision === "exact" ? "точное" : "диапазонами"),
      "",
      "## Профиль",
      "- Пользователь: " + bundle.profile.userName,
      "- Привычка: " + bundle.habit.name,
      "- Дневной лимит: " + bundle.habit.dailyLimit,
      "",
      "## Сводка за 30 дней",
      "- Индекс нагрузки: " + analytics.summary.dependencyIndex,
      "- Уровень риска: " + analytics.summary.riskLevel,
      "- Главное окно риска: " + analytics.summary.riskWindow,
      "- Главный триггер: " + topTriggerLabel(analytics),
      "- Главный инсайт: " + analytics.summary.headline,
      "- Контекст: " + analytics.summary.narrative,
      "",
      "## Триггеры",
      analytics.triggers.map(function (item) {
        return "- " + item.label + ": " + item.count + " (" + Math.round(item.share * 100) + "%)";
      }).join("\n"),
      "",
      "## Паттерн недели",
      "- " + analytics.dayPattern.title,
      "- " + analytics.dayPattern.text,
      "- Действие: " + analytics.dayPattern.highlight,
      "",
      "## Последние записи дневника",
      recentDiary.length ? recentDiary.map(function (entry) {
        var parts = ["- [" + entry.timeLabel + "]"];
        if (entry.tag) parts.push("(" + entry.tag + ")");
        parts.push(entry.text);
        return parts.join(" ");
      }).join("\n") : "- Записей пока нет",
      "",
      "## Последние эпизоды",
      recentSlips.length ? recentSlips.map(function (item) {
        return "- [" + item.timeLabel + "] " + item.trigger + ", тяга " + item.cravingLevel + "/5, заметка: " + (item.note || "без комментария");
      }).join("\n") : "- Эпизодов пока нет",
      "",
      "## Стартовый опрос",
      bundle.assessment ? "- Итоговый балл: " + bundle.assessment.score : "- Опрос не заполнен"
    ].join("\n");
  }

  function buildAiPrompt(bundle) {
    var analytics = bundle.analytics["30d"];
    var diarySlice = bundle.diaryEntries.slice(0, 12).map(function (entry) {
      return "- [" + entry.timeLabel + "] " + (entry.tag ? "(" + entry.tag + ") " : "") + entry.text + (entry.bodySignals && entry.bodySignals.length ? " · body signals: " + entry.bodySignals.join(", ") : "");
    }).join("\n") || "- Нет записей";
    var slipsSlice = bundle.events.slips.slice(0, 12).map(function (item) {
      return "- [" + item.timeLabel + "] триггер: " + item.trigger + "; тяга: " + item.cravingLevel + "/5; заметка: " + (item.note || "без комментария") + (item.bodySignals && item.bodySignals.length ? "; body signals: " + item.bodySignals.join(", ") : "") + (item.slipNote ? "; мысль после эпизода: " + item.slipNote : "");
    }).join("\n") || "- Нет эпизодов";

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
      "4. Что уже работает как опора.",
      "5. 5 конкретных действий на ближайшую неделю.",
      "",
      "Контекст приватности:",
      "- Имя: " + (bundle.meta.privacy.includeName ? "доступно" : "скрыто"),
      "- Дневник: " + (bundle.meta.privacy.diaryScope === "recent" ? "последние 10 записей" : "полный"),
      "- Время: " + (bundle.meta.privacy.timePrecision === "exact" ? "точное" : "диапазонами"),
      "",
      "Сводка за 30 дней:",
      "- Пользователь: " + bundle.profile.userName,
      "- Привычка: " + bundle.habit.name,
      "- Индекс нагрузки: " + analytics.summary.dependencyIndex,
      "- Уровень риска: " + analytics.summary.riskLevel,
      "- Окно риска: " + analytics.summary.riskWindow,
      "- Главный триггер: " + topTriggerLabel(analytics),
      "- Инсайт: " + analytics.summary.headline,
      "- Контекст: " + analytics.summary.narrative,
      "",
      "Триггеры:",
      analytics.triggers.map(function (item) {
        return "- " + item.label + ": " + item.count + " (" + Math.round(item.share * 100) + "%)";
      }).join("\n"),
      "",
      "Паттерн недели:",
      "- " + analytics.dayPattern.title,
      "- " + analytics.dayPattern.text,
      "- " + analytics.dayPattern.highlight,
      "",
      "Последние записи дневника:",
      diarySlice,
      "",
      "Последние эпизоды:",
      slipsSlice
    ].join("\n");
  }

  function downloadFile(filename, content, mimeType) {
    var textMime = String(mimeType || "").toLowerCase();
    var payload = (/^text\/|json|markdown|charset=utf-8/.test(textMime))
      ? ["\uFEFF", content]
      : [content];
    var blob = new Blob(payload, { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "readonly");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        document.body.removeChild(area);
        resolve();
      } catch (error) {
        document.body.removeChild(area);
        reject(error);
      }
    });
  }

  window.HabitExport = {
    buildExportBundle: buildExportBundle,
    buildMarkdownReport: buildMarkdownReport,
    buildAiPrompt: buildAiPrompt,
    downloadFile: downloadFile,
    copyText: copyText
  };
})();

