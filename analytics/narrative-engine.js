(function () {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashSeed(value) {
    var input = String(value || "");
    var hash = 0;
    for (var index = 0; index < input.length; index += 1) {
      hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function pickVariant(seed, variants) {
    if (!variants || !variants.length) return "";
    return variants[hashSeed(seed) % variants.length];
  }

  function lower(value) {
    return String(value || "").trim().toLowerCase();
  }

  function trimText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function shorten(value, limit) {
    var text = trimText(value);
    if (!text) return "";
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 1)).trim() + "…";
  }

  var TONE_META = {
    supportive: { id: "supportive", label: "Поддержка", summary: "мягко и без давления" },
    calm: { id: "calm", label: "Спокойно", summary: "ровно и без лишнего шума" },
    direct: { id: "direct", label: "По делу", summary: "коротко и предельно конкретно" },
    energetic: { id: "energetic", label: "Энергично", summary: "больше импульса и движения" },
    light: { id: "light", label: "Легче", summary: "чуть живее и с мягкой лёгкостью" }
  };

  function normalizeTone(value) {
    return TONE_META[value] ? value : "supportive";
  }

  function getToneMeta(value) {
    return TONE_META[normalizeTone(value)];
  }

  function resolveTone(context) {
    return normalizeTone(context && context.state && context.state.profile && context.state.profile.guidanceTone);
  }

  function getSupportMode(context) {
    var state = (context && context.state) || {};
    var summary7 = (context && context.analytics7 && context.analytics7.summary) || {};
    var wellbeing7 = (context && context.analytics7 && context.analytics7.wellbeing) || {};
    var today = getTodayCounts(state);
    var dailyLimit = (state.currentHabit && state.currentHabit.dailyLimit) || (state.profile && state.profile.dailyLimit) || 1;
    var observedDays = Number(summary7.observedDays) || 0;
    var dependencyIndex = Number(summary7.dependencyIndex) || 0;
    var riskLevel = String(summary7.riskLevel || "").toLowerCase();
    var celebration = context && context.firstWeekSupport && context.firstWeekSupport.celebration;

    if (today.slips >= Math.max(1, dailyLimit) || dependencyIndex >= 65 || riskLevel === "high" || riskLevel === "very_high") {
      return "grounding";
    }
    if (celebration || today.resisted > today.slips || (wellbeing7.trend && wellbeing7.trend.direction === "down")) {
      return "uplift";
    }
    if (observedDays < 3) {
      return "gentle";
    }
    return "steady";
  }

  function sentences(value, count) {
    var text = trimText(value);
    if (!text) return "";
    var parts = text.match(/[^.!?]+[.!?]?/g) || [text];
    return trimText(parts.slice(0, Math.max(1, count || 1)).join(" "));
  }

  function lowerFirst(value) {
    var text = trimText(value);
    if (!text) return "";
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function toneTodayMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        tone: "calm",
        title: "Сегодняшний ориентир",
        body: "Текущая картина: " + sentences(message.body, 2),
        nextStep: "Полезный шаг: " + lowerFirst(message.nextStep)
      };
    }
    if (tone === "direct") {
      return {
        tone: "direct",
        title: "Сегодня по плану",
        body: "Ситуация: " + sentences(message.body, 1),
        nextStep: "Действие: " + lowerFirst(message.nextStep)
      };
    }
    if (tone === "energetic") {
      return {
        tone: "energetic",
        title: "Сегодня можно перехватить день раньше привычки",
        body: "Точка уже видна, и это твой шанс сыграть на опережение. " + sentences(message.body, 2),
        nextStep: "Твой ход: " + lowerFirst(message.nextStep)
      };
    }
    if (tone === "light") {
      return {
        tone: "light",
        title: "Сегодня без надрыва, только один хороший ход",
        body: "Не нужно героически тащить весь день на себе. " + sentences(message.body, 2),
        nextStep: "Небольшой ход: " + lowerFirst(message.nextStep)
      };
    }
    if (supportMode === "grounding") {
      return Object.assign({}, message, {
        title: "Сегодня важнее опора, чем самокритика",
        body: "Неделя сейчас неровная, поэтому достаточно одного понятного шага. " + message.body,
        nextStep: "На сейчас подойдёт вот это: " + lowerFirst(message.nextStep)
      });
    }
    if (supportMode === "uplift") {
      return Object.assign({}, message, {
        body: "У тебя уже есть за что зацепиться сегодня. " + message.body
      });
    }
    if (supportMode === "gentle") {
      return Object.assign({}, message, {
        body: "Пока мы только собираем твой ритм, поэтому здесь достаточно одного ясного сигнала. " + message.body
      });
    }
    return message;
  }

  function toneProgressMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        title: "Сигнал прогресса",
        body: "Если смотреть ровно, сейчас видно вот что: " + sentences(message.body, 2)
      };
    }
    if (tone === "direct") {
      return {
        title: "Факт недели",
        body: "Факт: " + sentences(message.body, 1)
      };
    }
    if (tone === "energetic") {
      return {
        title: "Это уже реальное движение вперёд",
        body: "Даже небольшой сдвиг здесь уже работает на тебя. " + sentences(message.body, 2)
      };
    }
    if (tone === "light") {
      return {
        title: "Это уже плюс, не списывай его со счетов",
        body: "Маленькие сдвиги здесь не для галочки, а вполне по делу. " + sentences(message.body, 2)
      };
    }
    if (supportMode === "grounding") {
      return Object.assign({}, message, {
        body: "Сейчас прогресс лучше мерить не идеальностью, а маленькими честными шагами. " + message.body
      });
    }
    if (supportMode === "uplift") {
      return Object.assign({}, message, {
        body: "Это уже не пустой сдвиг, а рабочая опора на следующую неделю. " + message.body
      });
    }
    return message;
  }

  function toneWeeklyMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        title: "Ритм недели",
        body: "Если смотреть без спешки, неделя говорит вот что: " + sentences(message.body, 3),
        highlight: "Следующий ориентир: " + lowerFirst(message.nextStep || message.highlight || ""),
        nextStep: "Следующий ориентир: " + lowerFirst(message.nextStep || ""),
        compact: shorten("Ритм недели: " + sentences(message.body, 2), 96)
      };
    }
    if (tone === "direct") {
      return {
        title: "Итог недели",
        body: sentences(message.body, 1),
        highlight: "Главный шаг недели: " + lowerFirst(message.nextStep || ""),
        nextStep: "Главный шаг недели: " + lowerFirst(message.nextStep || ""),
        compact: shorten("Итог: " + sentences(message.body, 1), 96)
      };
    }
    if (tone === "energetic") {
      return {
        title: "Неделя уже показывает, где можно выиграть следующий кусок ритма",
        body: "Картина не просто собралась, она уже отдаёт тебе инициативу. " + sentences(message.body, 3),
        highlight: "Ход недели: " + lowerFirst(message.nextStep || ""),
        nextStep: "Ход недели: " + lowerFirst(message.nextStep || ""),
        compact: shorten("Есть точка роста: " + sentences(message.body, 2), 96)
      };
    }
    if (tone === "light") {
      return {
        title: "Неделя уже тихо подсказала, где тебе легче",
        body: "Если не давить на себя сверху, паттерн уже вполне читается. " + sentences(message.body, 3),
        highlight: "Мягкий ход недели: " + lowerFirst(message.nextStep || ""),
        nextStep: "Мягкий ход недели: " + lowerFirst(message.nextStep || ""),
        compact: shorten("Подсказка недели: " + sentences(message.body, 2), 96)
      };
    }
    if (supportMode === "grounding") {
      return Object.assign({}, message, {
        body: "Неделя была тяжелее обычного, так что здесь важнее не осуждение, а ясность паттерна. " + message.body,
        highlight: "Шаг на следующую неделю: " + lowerFirst(message.nextStep || message.highlight || ""),
        nextStep: "Шаг на следующую неделю: " + lowerFirst(message.nextStep || "")
      });
    }
    if (supportMode === "uplift") {
      return Object.assign({}, message, {
        body: "На этой неделе уже есть сдвиг, на который можно опереться дальше. " + message.body
      });
    }
    return message;
  }

  function toneMissionMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        key: message.key,
        title: message.title.replace("Миссия дня", "Фокус дня"),
        body: "На сегодня достаточно вот этого: " + sentences(message.body, 2),
        ctaLabel: message.ctaLabel,
        route: message.route
      };
    }
    if (tone === "direct") {
      return {
        key: message.key,
        title: message.title.replace("Миссия дня:", "Задача:"),
        body: "Зачем: " + sentences(message.body, 1),
        ctaLabel: message.ctaLabel,
        route: message.route
      };
    }
    if (tone === "energetic") {
      return {
        key: message.key,
        title: message.title,
        body: "Это маленький шаг, но он уже разворачивает день в твою сторону. " + sentences(message.body, 2),
        ctaLabel: message.ctaLabel,
        route: message.route
      };
    }
    if (tone === "light") {
      return {
        key: message.key,
        title: message.title,
        body: "Без лишнего напряжения: " + sentences(message.body, 2),
        ctaLabel: message.ctaLabel,
        route: message.route
      };
    }
    if (supportMode === "grounding") {
      return Object.assign({}, message, {
        body: "Сейчас полезнее один посильный шаг, чем попытка вытащить весь день сразу. " + message.body
      });
    }
    if (supportMode === "uplift") {
      return Object.assign({}, message, {
        body: "Шаг маленький, но сейчас он хорошо закрепит твой ритм. " + message.body
      });
    }
    return message;
  }

  function toneProfileMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        body: "Сейчас картина выглядит так: " + sentences(message.body, 3)
      };
    }
    if (tone === "direct") {
      return {
        body: "Коротко по сути: " + sentences(message.body, 2)
      };
    }
    if (tone === "energetic") {
      return {
        body: "У тебя уже есть материал, чтобы двигать ритм в свою сторону. " + sentences(message.body, 3)
      };
    }
    if (tone === "light") {
      return {
        body: "Если убрать лишнюю драму, картина уже вполне понятна: " + sentences(message.body, 3)
      };
    }
    if (supportMode === "grounding") {
      return { body: "Сейчас лучше смотреть на картину мягко и по фактам. " + message.body };
    }
    if (supportMode === "uplift") {
      return { body: "У тебя уже есть живая опора, и это видно в общей картине. " + message.body };
    }
    return message;
  }

  function toneInsightMessage(tone, message, supportMode) {
    if (!message) return message;
    if (tone === "calm") {
      return {
        headline: "Главный вывод периода",
        narrative: "Если говорить спокойно, сейчас видно следующее. " + sentences(message.narrative, 3),
        recommendation: "Следующий ориентир: " + lowerFirst(message.recommendation)
      };
    }
    if (tone === "direct") {
      return {
        headline: "Главный вывод",
        narrative: "Вывод: " + sentences(message.narrative, 1),
        recommendation: "Действие: " + lowerFirst(message.recommendation)
      };
    }
    if (tone === "energetic") {
      return {
        headline: "Здесь уже видно, где можно выиграть следующий отрезок",
        narrative: "Паттерн уже читается, и это даёт тебе преимущество на следующий ход. " + sentences(message.narrative, 3),
        recommendation: "Ход недели: " + lowerFirst(message.recommendation)
      };
    }
    if (tone === "light") {
      return {
        headline: "Паттерн уже не особенно прячется",
        narrative: "Картина уже гораздо яснее, чем кажется на бегу. " + sentences(message.narrative, 3),
        recommendation: "Небольшой ход: " + lowerFirst(message.recommendation)
      };
    }
    if (supportMode === "grounding") {
      return Object.assign({}, message, {
        narrative: "Сейчас важнее не давить на себя, а увидеть сценарий яснее. " + message.narrative,
        recommendation: "На ближайшее время достаточно одного шага: " + lowerFirst(message.recommendation)
      });
    }
    if (supportMode === "uplift") {
      return Object.assign({}, message, {
        narrative: "В картине уже есть сдвиг, и это даёт хорошую опору на следующий шаг. " + message.narrative
      });
    }
    return message;
  }

  function toneActionMessage(tone, kind, message, supportMode) {
    var text = trimText(message);
    if (!text) return "";
    if (supportMode === "grounding") {
      return (kind === "success" ? "Спокойно отмечаю это. " : "Фиксирую без самокритики. ") + lowerFirst(sentences(text, 1));
    }
    if (supportMode === "uplift") {
      return (kind === "success" ? "Это хороший сдвиг. " : "Честный сигнал тоже полезен. ") + lowerFirst(sentences(text, 1));
    }
    if (tone === "calm") {
      return (kind === "success" ? "Спокойно отмечаю: " : "Спокойно фиксирую: ") + lowerFirst(text);
    }
    if (tone === "direct") {
      return (kind === "success" ? "Засчитано. " : "Зафиксировано. ") + sentences(text, 1);
    }
    if (tone === "energetic") {
      return (kind === "success" ? "Есть. " : "Отмечено. ") + lowerFirst(sentences(text, 1));
    }
    if (tone === "light") {
      return (kind === "success" ? "Хороший ход. " : "Без драмы, просто честно фиксирую: ") + lowerFirst(sentences(text, 1));
    }
    return text;
  }

  function getDateKey() {
    if (window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.formatDateKey) {
      return window.HabitStore.helpers.formatDateKey(new Date());
    }
    return new Date().toISOString().slice(0, 10);
  }

  function getTodayCounts(state) {
    var todayKey = getDateKey();
    var slips = (state.slips || []).filter(function (item) { return item.localDate === todayKey; }).length;
    var resisted = (state.resisted || []).filter(function (item) { return item.localDate === todayKey; }).length;
    return { slips: slips, resisted: resisted };
  }

  function getLatestHabitReflection(state) {
    var habitEntries = (state.diaryEntries || []).filter(function (entry) {
      return entry.entryScope !== "state" && entry.text;
    }).sort(function (left, right) {
      return new Date(right.timestamp) - new Date(left.timestamp);
    });
    return habitEntries[0] || null;
  }

  function getLatestStateReflection(state) {
    var stateEntries = (state.diaryEntries || []).filter(function (entry) {
      return entry.entryScope === "state" && entry.text;
    }).sort(function (left, right) {
      return new Date(right.timestamp) - new Date(left.timestamp);
    });
    return stateEntries[0] || null;
  }

  function getQuoteSnippet(entry, fallbackLimit) {
    if (!entry || !entry.text) return "";
    return "Ты уже сам отмечал: «" + shorten(entry.text, fallbackLimit || 88) + "»";
  }

  function getTopTriggerKey(summary) {
    var label = lower(summary && summary.mainTrigger);
    if (label.indexOf("стресс") !== -1) return "stress";
    if (label.indexOf("скук") !== -1) return "boredom";
    if (label.indexOf("компан") !== -1) return "company";
    if (label.indexOf("после еды") !== -1) return "after_food";
    if (label.indexOf("устал") !== -1) return "fatigue";
    if (label.indexOf("одино") !== -1) return "loneliness";
    return "other";
  }

  function getContextLabel(wellbeing) {
    if (!wellbeing) return "";
    if (wellbeing.contextLabel) return lower(wellbeing.contextLabel);
    if (wellbeing.insight && wellbeing.insight.badge) return lower(wellbeing.insight.badge);
    return "";
  }

  function buildNextStep(habitId, triggerKey, riskWindow, wellbeing) {
    var contextLabel = getContextLabel(wellbeing);
    var hasSleepContext = contextLabel.indexOf("сон") !== -1;

    if (triggerKey === "stress") {
      return "Поставь на " + (riskWindow || "сложное окно") + " короткую паузу на 2–3 минуты до того, как день ускорится.";
    }
    if (triggerKey === "after_food") {
      return "После еды заранее смени сценарий: вода, пройтись две минуты или сразу уйти из триггерного места.";
    }
    if (triggerKey === "boredom") {
      return "Когда станет пусто или скучно, подставь короткое действие-замену заранее, а не в момент импульса.";
    }
    if (triggerKey === "company") {
      return "Подумай заранее, как выглядел бы безопасный сценарий рядом с людьми: что ты скажешь и куда на минуту выйдешь.";
    }
    if (triggerKey === "fatigue" || hasSleepContext) {
      return "На этой неделе полезнее всего беречь сон и не оставлять тяжёлые окна без короткой паузы на восстановление.";
    }
    if (habitId === "social") {
      return "Заранее реши, сколько минут можно дать ленте, и поставь таймер до первого открытия, а не после.";
    }
    if (habitId === "smoking") {
      return "Подготовь одну короткую замену именно на " + (riskWindow || "сложный момент") + ": выйти, сделать пару глубоких вдохов или сменить маршрут.";
    }
    return "Выбери один маленький шаг на самое сложное окно недели и повтори его несколько раз подряд, не требуя идеальности.";
  }

  function buildTodayNarrative(context) {
    var state = context.state;
    var summary = (context.analytics7 && context.analytics7.summary) || {};
    var today = getTodayCounts(state);
    var limit = state.currentHabit.dailyLimit || state.profile.dailyLimit || 1;
    var triggerKey = getTopTriggerKey(summary);
    var quote = getQuoteSnippet(getLatestHabitReflection(state), 76);
    var step = buildNextStep(state.currentHabit.id, triggerKey, summary.riskWindow, context.analytics7 && context.analytics7.wellbeing);
    var seed = state.currentHabit.id + ":" + getDateKey() + ":" + triggerKey;

    if (context.setup && context.setup.nextStep && context.setup.nextStep.id === "first_event") {
      return {
        tone: "supportive",
        title: "Начни не с идеального дня, а с одного честного сигнала",
        body: "Приложению сейчас не нужен красивый отчёт. Один реальный момент уже превратит привычку из общей тревоги в понятный сценарий.",
        nextStep: "Зафиксируй первый момент прямо сегодня, даже если он кажется маленьким."
      };
    }

    if (today.resisted > 0 && today.slips === 0) {
      return {
        tone: "celebratory",
        title: pickVariant(seed, [
          "Сегодня уже есть опора, а не просто пустой день",
          "Ты не просто избежал эпизода, а создал новый ритм дня"
        ]),
        body: quote
          ? quote + " И сегодня у тебя уже есть момент, где сценарий не сработал как обычно."
          : "Сегодня у тебя уже есть момент, где сценарий не сработал как обычно. Это и есть та самая живая опора, из которой потом складывается изменение.",
        nextStep: step
      };
    }

    if (today.slips >= limit) {
      return {
        tone: "grounding",
        title: pickVariant(seed, [
          "Сегодня важнее не ругать себя, а увидеть сценарий целиком",
          "Тяжёлый день лучше разбирать по моментам, а не по чувству вины"
        ]),
        body: "Похоже, привычка сегодня включалась быстрее обычного, особенно вокруг " + (summary.riskWindow || "сложного окна") + ". " +
          (quote ? quote + " " : "") +
          "Сейчас полезнее искать не силу воли, а точку, где можно заранее снять автопилот.",
        nextStep: step
      };
    }

    if (today.slips > 0) {
      return {
        tone: "reflective",
        title: pickVariant(seed, [
          "День ещё можно вернуть в более спокойный ритм",
          "Сценарий уже проявился, а значит его легче поймать раньше"
        ]),
        body: "У тебя уже есть несколько честных сигналов за сегодня. Главный драйвер сейчас — " + lower(summary.mainTrigger || "другое") +
          ", и чаще всего это собирается вокруг " + (summary.riskWindow || "одного окна") + ". " +
          (quote ? quote : "Это хороший момент не спорить с собой, а заметить, где привычка включает автоматизм."),
        nextStep: step
      };
    }

    return {
      tone: "supportive",
      title: pickVariant(seed, [
        "Сегодня лучше держаться не за силу воли, а за ритм",
        "Пока день спокойный, можно заранее подготовить мягкую опору"
      ]),
      body: "Даже если сегодня всё тихо, твой паттерн уже заметен: сложнее всего обычно бывает около " + (summary.riskWindow || "сложного окна") +
        " и рядом с фактором \"" + lower(summary.mainTrigger || "другое") + "\". Лучше подготовить следующий шаг заранее, пока день не разогнался.",
      nextStep: step
    };
  }

  function buildProgressNarrative(context) {
    var firstWeekSupport = context.firstWeekSupport || {};
    var review = firstWeekSupport.review || null;
    var celebration = firstWeekSupport.celebration || null;
    var wellbeing = (context.analytics7 && context.analytics7.wellbeing) || {};

    if (celebration) {
      return {
        title: celebration.title,
        body: celebration.text
      };
    }

    if (review) {
      return {
        title: review.headline,
        body: review.text
      };
    }

    if (wellbeing.trend && wellbeing.trend.direction === "down") {
      return {
        title: "Фон недели уже стал мягче",
        body: "Даже если идеальных дней ещё нет, внутреннее напряжение просело. Это не громкий успех, а очень важный сдвиг в фоне."
      };
    }

    return {
      title: "Прогресс сейчас измеряется честностью, а не идеальностью",
      body: "Если ты стал раньше замечать момент, записывать контекст или возвращаться в приложение на следующий день, это уже часть реального изменения."
    };
  }

  function buildWeeklyNarrative(context) {
    var state = context.state;
    var summary = (context.analytics7 && context.analytics7.summary) || {};
    var wellbeing = (context.analytics7 && context.analytics7.wellbeing) || {};
    var observedDays = Number(summary.observedDays) || 0;
    var trigger = lower(summary.mainTrigger || "другое");
    var quote = getQuoteSnippet(getLatestHabitReflection(state), 84);
    var stateQuote = getQuoteSnippet(getLatestStateReflection(state), 72);
    var step = buildNextStep(state.currentHabit.id, getTopTriggerKey(summary), summary.riskWindow, wellbeing);

    if (observedDays < 4) {
      return {
        title: "Неделя ещё только собирает твою реальную картину",
        body: "Пока данных немного, но уже видно, где привычка начинает сгущаться: вокруг " + (summary.riskWindow || "сложного окна") + " и рядом с фактором \"" + trigger + "\".",
        highlight: "На этой неделе достаточно нескольких честных сигналов из реальной жизни.",
        nextStep: step,
        compact: "Ранний период: уже видно окно " + (summary.riskWindow || "риска") + " и фактор \"" + trigger + "\"."
      };
    }

    var body = "Эта неделя уже показывает твой ритм: чаще всего привычка собирается через \"" + trigger + "\" и особенно заметна в окне " + (summary.riskWindow || "риска") + ".";
    if (quote) body += " " + quote;
    if (!quote && stateQuote) body += " " + stateQuote;
    if (wellbeing.stateEntryCount) {
      body += " Фон недели тоже влияет: стресс " + ((wellbeing.averages && wellbeing.averages.stress) || 0).toFixed(1) + "/5, энергия " + ((wellbeing.averages && wellbeing.averages.energy) || 0).toFixed(1) + "/5.";
    }

    return {
      title: "Неделя уже показывает твой настоящий сценарий",
      body: body,
      highlight: "Следующий полезный шаг: " + step,
      nextStep: step,
      compact: shorten(body, 96)
    };
  }

  function buildProfileNarrative(context) {
    var weekly = buildWeeklyNarrative(context);
    var progress = buildProgressNarrative(context);
    return {
      body: weekly.body + " " + progress.body
    };
  }

  function buildMission(context) {
    var state = context.state;
    var analytics7 = context.analytics7 || {};
    var summary = analytics7.summary || {};
    var today = getTodayCounts(state);
    var todayKey = getDateKey();
    var todayEntries = (state.diaryEntries || []).filter(function (entry) {
      return String(entry.timestamp || "").slice(0, 10) === todayKey;
    });
    var recentStateEntries = (state.diaryEntries || []).filter(function (entry) {
      return entry.entryScope === "state";
    }).sort(function (left, right) {
      return new Date(right.timestamp) - new Date(left.timestamp);
    });
    var lastStateEntry = recentStateEntries[0] || null;
    var lastStateTooOld = !lastStateEntry || ((new Date() - new Date(lastStateEntry.timestamp)) / 86400000) >= 2;
    var triggerKey = getTopTriggerKey(summary);
    var riskWindow = summary.riskWindow || "сложного окна";

    if (!todayEntries.length) {
      return {
        key: "today_note",
        title: "Миссия дня: одна честная запись",
        body: "Одна короткая мысль о сегодняшнем дне уже сделает паттерн понятнее, чем попытка всё держать в голове.",
        ctaLabel: "Открыть дневник",
        route: "diary"
      };
    }

    if (lastStateTooOld) {
      return {
        key: "state_note",
        title: "Миссия дня: заметь фон дня",
        body: "Пара слов про сон, энергию или напряжение часто объясняет сложные моменты лучше любых цифр.",
        ctaLabel: "Добавить состояние",
        route: "diary"
      };
    }

    if (today.slips > 0 && today.resisted === 0) {
      return {
        key: "one_pause",
        title: "Миссия дня: один момент удержания",
        body: "Тебе не нужен идеальный день. Достаточно один раз заметить импульс чуть раньше и дать себе короткую паузу.",
        ctaLabel: "Вернуться на главную",
        route: "main"
      };
    }

    if (today.resisted > 0) {
      return {
        key: "save_support",
        title: "Миссия дня: закрепи то, что уже сработало",
        body: "Сохрани одну короткую фразу о том, что помогло сегодня. Завтра именно это может стать твоей опорой.",
        ctaLabel: "Записать это",
        route: "diary"
      };
    }

    return {
      key: "risk_window",
      title: "Миссия дня: заранее встретить трудное окно",
      body: "Сегодня лучше всего подготовить себя к " + riskWindow + ". Главный фактор сейчас — " + lower(summary.mainTrigger || "другое") + ".",
      ctaLabel: triggerKey === "stress" ? "Запомнить паузу" : "Остаться в ритме",
      route: "main"
    };
  }

  function buildInsightNarrative(context) {
    var state = context.state;
    var summary = (context.analytics30 && context.analytics30.summary) || {};
    var wellbeing = (context.analytics30 && context.analytics30.wellbeing) || {};
    var trigger = lower(summary.mainTrigger || "другое");
    var step = buildNextStep(state.currentHabit.id, getTopTriggerKey(summary), summary.riskWindow, wellbeing);
    var quote = getQuoteSnippet(getLatestHabitReflection(state), 78);

    var headline = "Это уже не хаос, а узнаваемый сценарий — " + (summary.riskWindow || "важное окно");
    if (state.currentHabit.id === "social") {
      headline = "Паттерн внимания уже виден — " + (summary.riskWindow || "важное окно");
    } else if (state.currentHabit.id === "sweets") {
      headline = "Тяга уже складывается в понятный ритм — " + (summary.riskWindow || "важное окно");
    } else if (state.currentHabit.id === "alcohol") {
      headline = "Трудный сценарий уже узнаваем — " + (summary.riskWindow || "важное окно");
    }

    var narrative = "Главный паттерн сейчас не в том, что с тобой «что-то не так», а в том, что привычка чаще собирается через \"" + trigger + "\"";
    if (summary.riskWindow) {
      narrative += " и сгущается около " + summary.riskWindow;
    }
    narrative += ".";
    if (quote) narrative += " " + quote;
    if (wellbeing.stateEntryCount) {
      narrative += " Фон состояния тоже уже участвует в картине: стресс " + ((wellbeing.averages && wellbeing.averages.stress) || 0).toFixed(1) + "/5, энергия " + ((wellbeing.averages && wellbeing.averages.energy) || 0).toFixed(1) + "/5.";
    }

    return {
      headline: headline,
      narrative: narrative,
      recommendation: step
    };
  }

  function buildPack(context) {
    var tone = resolveTone(context);
    var supportMode = getSupportMode(context);
    var today = toneTodayMessage(tone, buildTodayNarrative(context), supportMode);
    var mission = toneMissionMessage(tone, buildMission(context), supportMode);
    var progress = toneProgressMessage(tone, buildProgressNarrative(context), supportMode);
    var weekly = toneWeeklyMessage(tone, buildWeeklyNarrative(context), supportMode);
    var profile = toneProfileMessage(tone, buildProfileNarrative(context), supportMode);
    var insight = toneInsightMessage(tone, buildInsightNarrative(context), supportMode);

    return {
      meta: Object.assign({ supportMode: supportMode }, getToneMeta(tone)),
      today: today,
      mission: mission,
      progress: progress,
      weekly: weekly,
      profile: profile,
      insight: insight
    };
  }

  window.HabitNarrativeEngine = {
    buildPack: buildPack,
    toneActionMessage: toneActionMessage,
    getSupportMode: getSupportMode
  };
})();
