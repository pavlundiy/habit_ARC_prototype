(function () {
  function getTimestampLabel(date) {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function sanitizeForAi(text) {
    return normalizeText(text)
      .replace(/\bИван\b/gi, "Пользователь")
      .replace(/\bИВ\b/g, "П");
  }

  function topTriggerLabel(analytics) {
    return analytics.summary.mainTrigger || "не определён";
  }

  function compactSlip(item, helpers) {
    return {
      timestamp: item.timestamp,
      localDate: item.localDate,
      localHour: item.localHour,
      trigger: helpers.triggerLabel(item.triggerTag),
      cravingLevel: item.cravingLevel,
      note: item.note || "",
      slipNote: item.slipNote || ""
    };
  }

  function compactResisted(item, helpers) {
    return {
      timestamp: item.timestamp,
      localDate: item.localDate,
      localHour: item.localHour,
      triggerTags: item.triggerTags || [],
      cravingLevel: item.cravingLevel,
      copingTool: item.copingTool || ""
    };
  }

  function compactDiaryEntry(item, helpers) {
    return {
      timestamp: item.timestamp,
      type: item.entryType,
      tag: item.tag ? helpers.triggerLabel(item.tag) : null,
      text: item.text,
      relatedSlipId: item.relatedSlipId || null
    };
  }

  function buildExportBundle() {
    var state = window.HabitStore.getState();
    var helpers = window.HabitStore.helpers;
    var analytics7d = window.HabitAnalytics.getInsightViewModel("7d");
    var analytics30d = window.HabitAnalytics.getInsightViewModel("30d");
    var analytics90d = window.HabitAnalytics.getInsightViewModel("90d");
    var now = new Date();

    return {
      meta: {
        schemaVersion: 1,
        exportedAt: now.toISOString(),
        exportedAtLabel: getTimestampLabel(now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
        source: "habit-demo-app"
      },
      profile: {
        userName: state.profile.userName,
        initials: state.profile.initials
      },
      habit: {
        id: state.currentHabit.id,
        name: state.currentHabit.name,
        dailyLimit: state.profile.dailyLimit
      },
      assessment: state.assessment,
      analytics: {
        "7d": analytics7d,
        "30d": analytics30d,
        "90d": analytics90d
      },
      events: {
        slips: state.slips.map(function (item) { return compactSlip(item, helpers); }),
        resisted: state.resisted.map(function (item) { return compactResisted(item, helpers); })
      },
      diaryEntries: state.diaryEntries.map(function (item) { return compactDiaryEntry(item, helpers); })
    };
  }

  function buildMarkdownReport(bundle) {
    var analytics = bundle.analytics["30d"];
    var recentDiary = bundle.diaryEntries.slice(0, 10);
    var recentSlips = bundle.events.slips.slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, 10);

    return [
      "# Отчёт по привычке",
      "",
      "Дата выгрузки: " + bundle.meta.exportedAtLabel,
      "Часовой пояс: " + bundle.meta.timezone,
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
        var parts = ["- [" + getTimestampLabel(new Date(entry.timestamp)) + "]"];
        if (entry.tag) parts.push("(" + entry.tag + ")");
        parts.push(entry.text);
        return parts.join(" ");
      }).join("\n") : "- Записей пока нет",
      "",
      "## Последние эпизоды",
      recentSlips.length ? recentSlips.map(function (item) {
        return "- [" + getTimestampLabel(new Date(item.timestamp)) + "] " + item.trigger + ", тяга " + item.cravingLevel + "/5, заметка: " + (item.note || "без комментария");
      }).join("\n") : "- Эпизодов пока нет",
      "",
      "## Стартовый опрос",
      bundle.assessment ? "- Итоговый балл: " + bundle.assessment.score : "- Опрос не заполнен"
    ].join("\n");
  }

  function buildAiPrompt(bundle) {
    var analytics = bundle.analytics["30d"];
    var diarySlice = bundle.diaryEntries.slice(0, 12).map(function (entry) {
      return "- [" + getTimestampLabel(new Date(entry.timestamp)) + "] " + (entry.tag ? "(" + entry.tag + ") " : "") + sanitizeForAi(entry.text);
    }).join("\n") || "- Нет записей";
    var slipsSlice = bundle.events.slips.slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, 12).map(function (item) {
      return "- [" + getTimestampLabel(new Date(item.timestamp)) + "] триггер: " + item.trigger + "; тяга: " + item.cravingLevel + "/5; заметка: " + sanitizeForAi(item.note || "без комментария") + (item.slipNote ? "; мысль после эпизода: " + sanitizeForAi(item.slipNote) : "");
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
      "Сводка за 30 дней:",
      "- Привычка: " + bundle.habit.name,
      "- Индекс нагрузки: " + analytics.summary.dependencyIndex,
      "- Уровень риска: " + analytics.summary.riskLevel,
      "- Окно риска: " + analytics.summary.riskWindow,
      "- Главный триггер: " + topTriggerLabel(analytics),
      "- Инсайт: " + analytics.summary.headline,
      "- Контекст: " + sanitizeForAi(analytics.summary.narrative),
      "",
      "Триггеры:",
      analytics.triggers.map(function (item) {
        return "- " + item.label + ": " + item.count + " (" + Math.round(item.share * 100) + "%)";
      }).join("\n"),
      "",
      "Паттерн недели:",
      "- " + analytics.dayPattern.title,
      "- " + sanitizeForAi(analytics.dayPattern.text),
      "- " + sanitizeForAi(analytics.dayPattern.highlight),
      "",
      "Последние записи дневника:",
      diarySlice,
      "",
      "Последние эпизоды:",
      slipsSlice
    ].join("\n");
  }

  function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
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
