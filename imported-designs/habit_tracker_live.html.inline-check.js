
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded-shell");
}
var demoEventIndexes = {};
var activeTips = {};
var mainDetailState = {
  "day-cost-card": false,
  "recent-log-card": false
};

function getAdviceTimeSegment(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function getHomeRiskLevel(todayCount, limit) {
  var ratio = todayCount / Math.max(limit, 1);
  if (ratio >= 1.2) return "very_high";
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.35) return "moderate";
  return "low";
}

function getRecentTriggerTags(state) {
  var recent = state.slips.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  }).slice(0, 5);
  var tags = [];
  recent.forEach(function (item) {
    (item.triggerTags || [item.triggerTag]).forEach(function (tag) {
      if (tag && tags.indexOf(tag) === -1) {
        tags.push(tag);
      }
    });
  });
  return tags;
}

function getAdviceMetaText(advice) {
  var source = advice.verificationStatus === "reviewed" || advice.verificationStatus === "verified"
    ? "Источник: " + advice.sourceLabel
    : "Пока это продуктовая подсказка, не клиническая рекомендация";
  return source;
}

function formatMoney(value, symbol) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(Number(value) || 0) + " " + (symbol || "₽");
}

function formatMinutes(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(Number(value) || 0) + " мин";
}

function compactWeekTrend(direction) {
  if (direction === "up") return "фон тяжелее";
  if (direction === "down") return "фон мягче";
  if (direction === "stable") return "фон ровнее";
  return "данных мало";
}

function compactHealthTrend(direction) {
  if (direction === "up") return "есть сдвиг";
  if (direction === "down") return "нужна опора";
  if (direction === "stable") return "ровно";
  return "без динамики";
}

function trimSentence(text, limit) {
  var value = String(text || "").trim();
  if (!value) return "";
  if (value.length <= limit) return value;
  return value.slice(0, limit - 3).trim() + "...";
}

function adviceMatchToTipData(match, fallbackLabel) {
  if (!match || !match.advice) return null;
  return {
    label: match.advice.shortLabel || fallbackLabel,
    data: {
      title: match.advice.title,
      sub: match.advice.rationale,
      items: [
        { t: "Что попробовать", d: match.advice.body },
        { t: "Почему это может помочь", d: match.advice.rationale },
        { t: "Основа", d: getAdviceMetaText(match.advice) }
      ]
    }
  };
}

function getAdviceDrivenTips(state) {
  if (!window.HabitAdviceLibrary || !window.HabitAdviceLibrary.buildAdviceBundle) {
    return {
      primary: {
        label: "Совет недоступен",
        data: {
          title: "Библиотека советов недоступна",
          sub: "Не удалось загрузить единый каталог рекомендаций",
          items: [
            { t: "Что делать сейчас", d: "Обнови экран. Если проблема останется, проверь подключение модуля advice-library.js." }
          ]
        }
      },
      secondary: {
        label: "Нет данных",
        data: {
          title: "Советы временно недоступны",
          sub: "Единый источник советов не был найден",
          items: [
            { t: "Почему это важно", d: "Главная теперь читает советы только из библиотеки, без статических дубликатов в интерфейсе." }
          ]
        }
      },
      tertiary: {
        label: "Проверь модуль",
        data: {
          title: "Нужна библиотека advice-library",
          sub: "Сейчас контент не подгрузился",
          items: [
            { t: "Следующий шаг", d: "Нужно восстановить подключение analytics/advice-library.js, чтобы советы снова появились." }
          ]
        }
      }
    };
  }

  var todayCount = window.HabitStore.getTodaySlipCount(state);
  var limit = state.profile.dailyLimit;
  var bundle = window.HabitAdviceLibrary.buildAdviceBundle({
    habitId: state.currentHabit.id,
    triggerTags: getRecentTriggerTags(state),
    riskLevel: getHomeRiskLevel(todayCount, limit),
    timeSegment: getAdviceTimeSegment(new Date().getHours()),
    includeUnreviewed: true
  });

  if (!bundle || (!bundle.primary && !bundle.reflection && !bundle.support.length)) {
    return null;
  }

  return {
    primary: adviceMatchToTipData(bundle.primary, "Сейчас поможет"),
    secondary: adviceMatchToTipData(bundle.support[0] || bundle.primary, "Ещё вариант"),
    tertiary: adviceMatchToTipData(bundle.reflection || bundle.support[1] || bundle.primary, "Что заметить")
  };
}

function showToast(msg) {
  var el = document.getElementById("toast");
  if (window.HabitUiFeedback && window.HabitUiFeedback.showToast) {
    window.HabitUiFeedback.showToast(el, msg, { hiddenClass: "hidden", duration: 3000 });
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(function () { el.classList.add("hidden"); }, 3000);
}

function showTip(type) {
  var d = activeTips[type];
  if (!d) return;
  document.getElementById("modal-title").textContent = d.title;
  document.getElementById("modal-sub").textContent = d.sub;
  document.getElementById("modal-tips").innerHTML = d.items.map(function (item) {
    return '<div class="modal-tip"><div class="modal-tip-title">' + item.t + '</div><div class="modal-tip-text">' + item.d + '</div></div>';
  }).join("");
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function updateDetailCard(cardId, open) {
  var card = document.getElementById(cardId);
  if (!card) return;
  card.classList.toggle("open", !!open);
}

function renderWeek(state) {
  var row = document.getElementById("week-row");
  var now = new Date();
  var start = new Date(now);
  var day = now.getDay() || 7;
  start.setDate(now.getDate() - day + 1);
  start.setHours(0,0,0,0);
  var labels = ["пн","вт","ср","чт","пт","сб","вс"];
  var counts = labels.map(function (_, index) {
    var date = new Date(start);
    date.setDate(start.getDate() + index);
    var key = window.HabitStore.helpers.formatDateKey(date);
    return state.slips.filter(function (item) { return item.localDate === key; }).length;
  });
  var best = Math.min.apply(null, counts);
  var worst = Math.max.apply(null, counts);
  row.innerHTML = labels.map(function (label, index) {
    var count = counts[index];
    var height = Math.max(3, count * 6 + 8);
    var color = count === worst && count > 0 ? "#F0997B" : count <= 2 ? "#9FE1CB" : "#5DCAA5";
    var className = count === worst && count > 0 ? "worst" : count === best ? "best" : "";
    return '<div class="week-col"><div class="w-day">' + label + '</div><div class="w-bar" style="height:' + height + 'px;background:' + color + ';"></div><div class="w-num ' + className + '">' + (count || "—") + '</div></div>';
  }).join("");
}

function renderLogs(state) {
  var root = document.getElementById("log-section");
  var recent = state.slips.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  }).slice(0, 6);
  document.getElementById("recent-log-summary").textContent = recent.length
    ? window.HabitStore.helpers.triggerLabel(recent[0].triggerTag) + " · " + window.HabitStore.helpers.formatTime(new Date(recent[0].timestamp))
    : "Записи появятся после первого события";
  if (!recent.length) {
    root.innerHTML = '<div class="log-item"><div class="log-dot" style="background:#9FE1CB;"></div><div class="log-text">Пока здесь спокойно. Первый эпизод или момент удержания сразу появится в ленте.</div><div class="log-time">сейчас</div></div>';
    return;
  }
  root.innerHTML = recent.map(function (item) {
    var date = new Date(item.timestamp);
    return '<div class="log-item"><div class="log-dot" style="background:' + window.HabitStore.helpers.triggerColor(item.triggerTag) + ';"></div><div class="log-text">' + window.HabitStore.helpers.triggerLabel(item.triggerTag) + ' · ' + (item.note || "Без комментария") + '</div><div class="log-time">' + window.HabitStore.helpers.formatTime(date) + '</div></div>';
  }).join("");
}

function renderQuickStats(state) {
  var model = window.HabitAnalytics ? window.HabitAnalytics.getInsightViewModel("30d") : { finance: {}, health: { filledCount: 0, totalCount: 7 } };
  var finance = model.finance || {};
  var health = model.health || { filledCount: 0, totalCount: 7 };
  var todaySpent = finance.todaySpent || 0;
  var config = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getCurrentHabitConfig
    ? window.HabitStore.helpers.getCurrentHabitConfig(state)
    : ((state.currentHabit && state.currentHabit.config) || state.habitConfig || { minutesPerEpisode: 0 });
  var todayMinutes = (config.minutesPerEpisode || 0) * window.HabitStore.getTodaySlipCount(state);
  document.getElementById("quick-money").textContent = formatMoney(todaySpent, finance.currencySymbol || "₽");
  document.getElementById("quick-money-sub").textContent = "Неделя: " + formatMoney(finance.weekSpent || 0, finance.currencySymbol || "₽");
  document.getElementById("quick-time").textContent = formatMinutes(todayMinutes);
  document.getElementById("quick-time-sub").textContent = "Месяц: " + (finance.monthHours || 0) + " ч";
  document.getElementById("quick-health").textContent = health.filledCount + "/" + health.totalCount;
  document.getElementById("quick-health-sub").textContent = health.filledCount ? "сон, давление и тело в фокусе" : "маркеры пока не заполнены";
  document.getElementById("day-cost-summary").textContent = formatMoney(todaySpent, finance.currencySymbol || "₽") + " · " + formatMinutes(todayMinutes) + " · health " + health.filledCount + "/" + health.totalCount;
}

function renderWeekSnapshot() {
  if (!window.HabitAnalytics) return;
  var model = window.HabitAnalytics.getInsightViewModel("7d");
  var summary = model.summary || {};
  var wellbeing = model.wellbeing || {};
  var health = model.health || {};
  var observedDays = Number(summary.observedDays) || 0;

  document.getElementById("week-snapshot-sub").textContent = observedDays >= 4
    ? "Три сигнала, чтобы быстро понять ритм последних 7 дней."
    : "Неделя ещё собирает основу, но первые сигналы уже видны.";
  document.getElementById("week-snapshot-badge").textContent = observedDays >= 4 ? "есть ритм" : "ранний период";

  document.getElementById("week-snapshot-behavior-value").textContent = "Индекс " + summary.dependencyIndex;
  document.getElementById("week-snapshot-behavior-copy").textContent =
    trimSentence("Триггер: " + String(summary.mainTrigger || "Другое").toLowerCase() + ". Окно: " + (summary.riskWindow || "—") + ".", 56);

  if (wellbeing.stateEntryCount) {
    var stress = wellbeing.averages && wellbeing.averages.stress ? wellbeing.averages.stress.toFixed(1) : "0.0";
    document.getElementById("week-snapshot-state-value").textContent = "Стресс " + stress + "/5";
    document.getElementById("week-snapshot-state-copy").textContent =
      trimSentence(compactWeekTrend(wellbeing.trend && wellbeing.trend.direction) + (wellbeing.contextLabel ? " · чаще " + wellbeing.contextLabel : ""), 56);
  } else {
    document.getElementById("week-snapshot-state-value").textContent = "Нет фона";
    document.getElementById("week-snapshot-state-copy").textContent = "Появится после записей состояния.";
  }

  document.getElementById("week-snapshot-health-value").textContent =
    (health.filledCount || 0) + "/" + (health.totalCount || 0);
  document.getElementById("week-snapshot-health-copy").textContent =
    trimSentence(compactHealthTrend(health.trendDirection) + " · " + (health.filledCount ? health.trendSummary : "можно начать со сна и пульса"), 56);
}

function renderTips(state) {
  var config = getAdviceDrivenTips(state);
  activeTips = {
    primary: config.primary.data,
    secondary: config.secondary.data,
    tertiary: config.tertiary.data
  };
  document.querySelectorAll(".tip-label")[0].textContent = config.primary.label;
  document.querySelectorAll(".tip-label")[1].textContent = config.secondary.label;
  document.querySelectorAll(".tip-label")[2].textContent = config.tertiary.label;
  document.getElementById("tip-btn-1").onclick = function () { showTip("primary"); };
  document.getElementById("tip-btn-2").onclick = function () { showTip("secondary"); };
  document.getElementById("tip-btn-3").onclick = function () { showTip("tertiary"); };
}

function getTrackerCopy(habitId) {
  var copy = {
    recordLabel: "Зафиксировать срыв",
    resistedLabel: "Удержался",
    slipToast: "Событие сохранено. Запись уже отправлена в дневник и аналитику.",
    successToast: "Момент удержания сохранён и усилит аналитику восстановления."
  };

  if (habitId === "alcohol") {
    copy.recordLabel = "Зафиксировать эпизод";
    copy.resistedLabel = "Не выпил";
    copy.slipToast = "Эпизод с алкоголем сохранён. Он уже влияет на дневник и аналитику.";
    copy.successToast = "Момент, когда ты не выпил, сохранён как опора для восстановления.";
  } else if (habitId === "sweets") {
    copy.recordLabel = "Зафиксировать эпизод";
    copy.slipToast = "Эпизод со сладким сохранён. Теперь будет легче заметить, что запускает тягу.";
    copy.successToast = "Момент удержания от сладкого сохранён и поддержит аналитику самоконтроля.";
  } else if (habitId === "social") {
    copy.recordLabel = "Сорвался в ленту";
    copy.resistedLabel = "Вышел вовремя";
    copy.slipToast = "Заход в ленту сохранён. Это поможет увидеть, когда автопрокрутка включается чаще.";
    copy.successToast = "Момент выхода из ленты сохранён и поможет аналитике самоконтроля.";
  } else if (habitId === "overeating") {
    copy.recordLabel = "Зафиксировать эпизод";
    copy.resistedLabel = "Остановился вовремя";
    copy.slipToast = "Эпизод переедания сохранён. Так будет проще увидеть его реальную причину.";
    copy.successToast = "Момент, когда ты остановился вовремя, сохранён и усилит аналитику восстановления.";
  } else if (habitId === "custom") {
    copy.recordLabel = "Зафиксировать эпизод";
    copy.slipToast = "Эпизод сохранён. Он уже попал в дневник и аналитику привычки.";
  }

  return copy;
}

function getTrackerStateCopy(habitId, todayCount, limit) {
  var lowThreshold = Math.max(1, Math.floor(limit * 0.4));
  var stage = todayCount === 0 ? "zero" : todayCount <= lowThreshold ? "low" : todayCount < limit ? "mid" : "high";
  var maps = {
    smoking: {
      zero: { badge: "чистый день", title: "Сегодня без сигарет", text: "Сильное начало. Чем дольше день идёт без автоматического ритуала, тем больше у тебя пространства для выбора." },
      low: { badge: "контроль держится", title: "Курение пока под контролем", text: "Ты не дал привычке забрать день целиком. Несколько спокойных решений подряд уже меняют сценарий." },
      mid: { badge: "идёт снижение", title: "Сегодня уже " + todayCount + " эп.", text: "Это ещё управляемый диапазон. Самый полезный шаг сейчас — поймать следующий триггер чуть раньше." },
      high: { badge: "напряжённый день", title: "День получился тяжёлым", text: "Не своди всё к силе воли. Лучше смотри, в какой момент курение включалось автоматически, и готовь замену именно туда." }
    },
    alcohol: {
      zero: { badge: "спокойный день", title: "Сегодня без алкоголя", text: "Хороший базовый день. Чем спокойнее ты проходишь триггерные окна, тем сильнее ощущение контроля." },
      low: { badge: "контроль на твоей стороне", title: "Пока без лишних эпизодов", text: "Сценарий ещё не разогнался. Лучше заранее решить, чем заменить следующий импульс к алкоголю." },
      mid: { badge: "день под наблюдением", title: "Сегодня уже " + todayCount + " эп.", text: "День ещё можно вернуть в спокойный режим. Помогает не спорить с собой, а заранее убрать доступ и социальный триггер." },
      high: { badge: "сложный день", title: "Сегодня было много триггеров", text: "Сейчас важнее мягко сократить следующий эпизод и подготовить безопасный сценарий, чем требовать идеальности." }
    },
    sweets: {
      zero: { badge: "ровный день", title: "Сладкое пока не включилось", text: "Отличное начало. Если удержать ритм еды и энергии, тянуть будет заметно меньше." },
      low: { badge: "тяга снижается", title: "День идёт стабильно", text: "Ты уже держишь сладкое не на автомате. Следующий сильный момент чаще всего приходит после еды или усталости." },
      mid: { badge: "важен следующий выбор", title: "Сегодня уже " + todayCount + " эп.", text: "Это ещё не провал дня. Сейчас лучше заранее закрыть следующий триггер: голод, стресс или визуальный доступ." },
      high: { badge: "день перегружен", title: "Тяга сегодня была высокой", text: "Не ругай себя. Полезнее понять, где просела энергия или накопился стресс, и подстраховать именно этот момент." }
    },
    social: {
      zero: { badge: "фокус держится", title: "Лента пока не забрала день", text: "Хороший ритм. Чем реже телефон попадает в руки без цели, тем слабее автопрокрутка." },
      low: { badge: "экран под контролем", title: "Ты пока управляешь вниманием", text: "Есть запас. Самое полезное сейчас — заранее решить, когда именно можно заходить в ленту и когда выходить." },
      mid: { badge: "важен выход вовремя", title: "Сегодня уже " + todayCount + " захода", text: "День ещё можно выровнять. Следующий лучший шаг — сократить длительность, а не ждать идеального нуля." },
      high: { badge: "день рассыпался", title: "Автопрокрутка сегодня усилилась", text: "Обычно это связано с усталостью, перегрузкой или скукой. Сейчас лучше убрать телефон из быстрого доступа и дать мозгу другой ритуал." }
    },
    overeating: {
      zero: { badge: "спокойный ритм", title: "Пока без эпизодов переедания", text: "Ровный день. Когда еда остаётся ответом на голод, а не на напряжение, телу становится легче." },
      low: { badge: "день под контролем", title: "Ты держишь ритм питания", text: "Хороший знак. Особенно важно заранее подхватить усталость и стресс, чтобы не уйти в еду на автомате." },
      mid: { badge: "внимание к триггеру", title: "Сегодня уже " + todayCount + " эп.", text: "Это ещё не потерянный день. Помогает заранее закрыть следующее окно риска: стресс, усталость или доедание после еды." },
      high: { badge: "тяжёлый день", title: "Сегодня было много напряжения", text: "Сейчас важнее мягко восстановить опору: вода, пауза, понятный следующий приём пищи и чуть меньше самокритики." }
    },
    custom: {
      zero: { badge: "спокойный день", title: "Сегодня пока ноль", text: "Сильное начало дня. Это уже новая опора." },
      low: { badge: "день под контролем", title: "Отлично держишься", text: "Ты в зоне контроля. Ещё немного, и день будет заметно легче." },
      mid: { badge: "идёт снижение", title: "Сегодня уже " + todayCount + " эп.", text: "Ты всё ещё внутри управляемого диапазона. Каждый удержанный момент имеет значение." },
      high: { badge: "напряжённый день", title: "Сложный день, и это нормально", text: "Не суди себя. Главное — следующий шаг, а не идеальность." }
    }
  };

  var map = maps[habitId] || maps.custom;
  return map[stage];
}

function getHabitDemoEvents(habitId) {
  var maps = {
    smoking: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · напряжение после задачи" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "Только что · пауза и привычка рук" },
        { triggerTag: "after_food", triggerTags: ["after_food", "ritual"], note: "Только что · после еды" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · усталость к вечеру" }
      ],
      resisted: { triggerTags: ["stress", "after_food"], cravingLevel: 3, copingTool: "walk" }
    },
    alcohol: {
      slips: [
        { triggerTag: "company", triggerTags: ["company"], note: "Только что · компания после дня" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · хотелось снять напряжение" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · усталость и желание расслабиться" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "Только что · привычный вечерний сценарий" }
      ],
      resisted: { triggerTags: ["company", "stress"], cravingLevel: 4, copingTool: "sparkling_water" }
    },
    sweets: {
      slips: [
        { triggerTag: "after_food", triggerTags: ["after_food"], note: "Только что · после еды захотелось сладкого" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · тяга на фоне напряжения" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · просела энергия" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "Только что · потянуло на автомате" }
      ],
      resisted: { triggerTags: ["after_food", "stress"], cravingLevel: 3, copingTool: "tea" }
    },
    social: {
      slips: [
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "Только что · рука сама потянулась к ленте" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · залип на фоне усталости" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · ушёл в экран после напряжения" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "Только что · привычный заход перед сном" }
      ],
      resisted: { triggerTags: ["fatigue", "boredom"], cravingLevel: 3, copingTool: "timer" }
    },
    overeating: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · хотелось снять напряжение едой" },
        { triggerTag: "after_food", triggerTags: ["after_food"], note: "Только что · захотелось продолжить после еды" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · усталость и пустота" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "Только что · ел на автомате" }
      ],
      resisted: { triggerTags: ["stress", "fatigue"], cravingLevel: 4, copingTool: "water_pause" }
    },
    custom: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "Только что · напряжение" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "Только что · скука" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "Только что · усталость" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "Только что · привычный сценарий" }
      ],
      resisted: { triggerTags: ["stress", "ritual"], cravingLevel: 3, copingTool: "pause" }
    }
  };

  return maps[habitId] || maps.custom;
}

function getNextSlipEvent(habitId) {
  var config = getHabitDemoEvents(habitId);
  var currentIndex = demoEventIndexes[habitId] || 0;
  demoEventIndexes[habitId] = currentIndex + 1;
  return config.slips[currentIndex % config.slips.length];
}

function polishTrackerCopy(habitId, copy) {
  var next = Object.assign({}, copy);
  next.recordLabel = "Зафиксировать срыв";
  next.resistedLabel = "Удержался";
  next.slipToast = "Событие сохранено. Лента и аналитика уже обновились.";
  next.successToast = "Момент удержания сохранён. Это тоже важная часть твоего ритма.";

  if (habitId === "alcohol") {
    next.recordLabel = "Зафиксировать эпизод";
    next.resistedLabel = "Не выпил";
    next.slipToast = "Эпизод сохранён. Лента и аналитика уже подстроились под него.";
    next.successToast = "Момент, когда ты не выпил, сохранён как опора на будущее.";
  } else if (habitId === "sweets") {
    next.recordLabel = "Зафиксировать эпизод";
    next.slipToast = "Эпизод сохранён. Теперь будет легче заметить, что именно запускает тягу.";
    next.successToast = "Момент удержания сохранён. Он усилит картину самоконтроля.";
  } else if (habitId === "social") {
    next.recordLabel = "Сорвался в ленту";
    next.resistedLabel = "Вышел вовремя";
    next.slipToast = "Заход в ленту сохранён. Это поможет точнее увидеть сценарий автопрокрутки.";
    next.successToast = "Момент выхода сохранён. Это тоже движение в нужную сторону.";
  } else if (habitId === "overeating") {
    next.recordLabel = "Зафиксировать эпизод";
    next.resistedLabel = "Остановился вовремя";
    next.slipToast = "Эпизод сохранён. Так будет легче заметить его реальную причину.";
    next.successToast = "Момент, когда ты остановился вовремя, тоже сохранён в ритме недели.";
  } else if (habitId === "custom") {
    next.recordLabel = "Зафиксировать эпизод";
    next.slipToast = "Эпизод сохранён. Он уже попал в ленту и аналитику привычки.";
  }

  return next;
}

function getSetupModel(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getSetupModel) {
    return window.HabitUiFlow.getSetupModel(state);
  }
  return { steps: [], completed: 0, total: 3, progress: 0, nextStep: null };
}

function openSetupNextStep(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.openSetupNextStep) {
    return window.HabitUiFlow.openSetupNextStep({
      state: state || window.HabitStore.getState(),
      intentRoute: "profile",
      onFirstEvent: function () {
        document.getElementById("record-btn").scrollIntoView({ behavior: "smooth", block: "center" });
        showToast(window.HabitUiFeedback && window.HabitUiFeedback.getUiCopy
          ? window.HabitUiFeedback.getUiCopy("onboarding_first_event")
          : "Начни с первой записи. Одной из двух кнопок ниже уже достаточно.");
      }
    });
  }
}

function renderSetupBanner(state) {
  var setup = getSetupModel(state);
  var root = document.getElementById("setup-banner");
  if (!setup.nextStep) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("setup-banner-progress").style.width = setup.progress + "%";
  document.getElementById("setup-banner-meta").textContent = "Готово " + setup.completed + " из " + setup.total + " шагов";

  if (setup.nextStep.id === "first_event") {
    document.getElementById("setup-banner-title").textContent = "Начни с первой записи";
    document.getElementById("setup-banner-copy").textContent = "Один срыв, одно удержание или одна мысль уже дадут приложению живой ритм дня.";
    document.getElementById("setup-banner-btn").textContent = "Сделать здесь";
  } else if (setup.nextStep.id === "assessment") {
    document.getElementById("setup-banner-title").textContent = "Следом стоит пройти опрос";
    document.getElementById("setup-banner-copy").textContent = "После первой записи лучше сразу уточнить стартовую нагрузку. Я открою нужный шаг в профиле.";
    document.getElementById("setup-banner-btn").textContent = "Открыть опрос";
  } else {
    document.getElementById("setup-banner-title").textContent = "Добавь личный контекст";
    document.getElementById("setup-banner-copy").textContent = "Цена эпизода, время и health markers сделают аналитику заметно полезнее уже на этой неделе.";
    document.getElementById("setup-banner-btn").textContent = "Открыть настройку";
  }
}

function getFirstWeekModel(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekModel) {
    return window.HabitUiFlow.getFirstWeekModel(state);
  }
  return { active: false, completed: 0, total: 4, progress: 0, milestones: [], nextMilestone: null };
}

function getFirstWeekSupport(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekSupport) {
    return window.HabitUiFlow.getFirstWeekSupport(state);
  }
  return { celebration: null, review: null };
}

function renderFirstWeekCard(state) {
  var model = getFirstWeekModel(state);
  var root = document.getElementById("first-week-card");
  if (!model.active) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("first-week-kicker").textContent = "Первая неделя · день " + model.dayNumber;
  document.getElementById("first-week-stage").textContent = model.stageLabel;
  document.getElementById("first-week-title").textContent = model.headline;
  document.getElementById("first-week-copy").textContent = model.narrative;
  document.getElementById("first-week-progress").style.width = model.progress + "%";
  document.getElementById("first-week-meta").textContent = model.completed + " из " + model.total + " опор уже есть";
  document.getElementById("first-week-chips").innerHTML = model.milestones.map(function (item) {
    return '<div class="week-journey-chip ' + (item.done ? "done" : "") + '">' + item.shortTitle + '</div>';
  }).join("");
  document.getElementById("first-week-next").textContent = model.nextMilestone
    ? "Следующая маленькая опора: " + model.nextMilestone.title + "."
    : "База первой недели уже собрана. Теперь приложение будет видеть твой ритм заметно увереннее.";
}

function renderCelebration(state) {
  var support = getFirstWeekSupport(state);
  var celebration = support.celebration;
  var root = document.getElementById("celebration-card");
  if (!celebration) {
    root.classList.remove("open");
    return;
  }
  root.classList.add("open");
  document.getElementById("celebration-title").textContent = celebration.title;
  document.getElementById("celebration-copy").textContent = celebration.text;
}

function renderMain(state) {
  var todayCount = window.HabitStore.getTodaySlipCount(state);
  var limit = state.profile.dailyLimit;
  var pct = Math.min(100, Math.round(todayCount / Math.max(limit, 1) * 100));
  var trackerCopy = polishTrackerCopy(state.currentHabit.id, getTrackerCopy(state.currentHabit.id));
  var trackerState = getTrackerStateCopy(state.currentHabit.id, todayCount, limit);
  if (!trackerState || !trackerState.title || !trackerState.text) {
    trackerState = {
      badge: "спокойный день",
      title: "Сегодня можно держаться за ритм",
      text: "Даже один честный сигнал уже полезнее, чем попытка всё контролировать идеально."
    };
  }
  document.getElementById("user-name").textContent = state.profile.userName;
  document.getElementById("avatar").textContent = state.profile.initials;
  document.getElementById("hero-habit").textContent = state.currentHabit.name + " · сегодня";
  document.getElementById("count").textContent = todayCount;
  document.getElementById("hero-sub").textContent = "ориентир: до " + limit + " " + state.currentHabit.unitLabel + " в день";
  document.getElementById("goal-fill").style.width = pct + "%";
  document.getElementById("goal-fill").style.background = todayCount >= limit ? "#D85A30" : "#1D9E75";
  document.getElementById("goal-label").textContent = "сегодня " + todayCount + " / " + limit;
  document.getElementById("record-btn").textContent = trackerCopy.recordLabel;
  document.getElementById("resisted-btn").textContent = trackerCopy.resistedLabel;
  document.getElementById("streak-badge").textContent = trackerState.badge || "спокойный день";

  var mood = document.getElementById("mood-text");
  mood.innerHTML = "<strong>" + trackerState.title + "</strong>" + trackerState.text;

  renderSetupBanner(state);
  renderFirstWeekCard(state);
  renderCelebration(state);
  renderWeekSnapshot();
  renderWeek(state);
  renderQuickStats(state);
  renderLogs(state);
  renderTips(state);
  Object.keys(mainDetailState).forEach(function (cardId) {
    updateDetailCard(cardId, mainDetailState[cardId]);
  });
}

function renderMain(state) {
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildMainScreenModel
    ? window.HabitScreenModels.buildMainScreenModel(state)
    : null;
  if (vm) {
    document.getElementById("user-name").textContent = vm.hero.userName;
    document.getElementById("avatar").textContent = vm.hero.initials;
    document.getElementById("hero-habit").textContent = vm.hero.habitLabel;
    document.getElementById("count").textContent = vm.hero.count;
    document.getElementById("hero-sub").textContent = vm.hero.sub;
    document.getElementById("goal-fill").style.width = vm.hero.goalPct + "%";
    document.getElementById("goal-fill").style.background = vm.hero.goalColor;
    document.getElementById("goal-label").textContent = vm.hero.goalLabel;
    document.getElementById("record-btn").textContent = vm.hero.recordLabel;
    document.getElementById("resisted-btn").textContent = vm.hero.resistedLabel;
    document.getElementById("streak-badge").textContent = vm.hero.badge || "спокойный день";
    document.getElementById("mood-text").innerHTML = "<strong>" + vm.hero.moodTitle + "</strong>" + vm.hero.moodText;
    document.getElementById("quick-money").textContent = vm.quickStats.money;
    document.getElementById("quick-money-sub").textContent = vm.quickStats.moneySub;
    document.getElementById("quick-time").textContent = vm.quickStats.time;
    document.getElementById("quick-time-sub").textContent = vm.quickStats.timeSub;
    document.getElementById("quick-health").textContent = vm.quickStats.health;
    document.getElementById("quick-health-sub").textContent = vm.quickStats.healthSub;
    document.getElementById("day-cost-summary").textContent = vm.quickStats.summary;
    document.getElementById("week-snapshot-sub").textContent = vm.weekSnapshot.sub;
    document.getElementById("week-snapshot-badge").textContent = vm.weekSnapshot.badge;
    document.getElementById("week-snapshot-behavior-value").textContent = vm.weekSnapshot.behaviorValue;
    document.getElementById("week-snapshot-behavior-copy").textContent = vm.weekSnapshot.behaviorCopy;
    document.getElementById("week-snapshot-state-value").textContent = vm.weekSnapshot.stateValue;
    document.getElementById("week-snapshot-state-copy").textContent = vm.weekSnapshot.stateCopy;
    document.getElementById("week-snapshot-health-value").textContent = vm.weekSnapshot.healthValue;
    document.getElementById("week-snapshot-health-copy").textContent = vm.weekSnapshot.healthCopy;
  }

  renderSetupBanner(state);
  renderFirstWeekCard(state);
  renderCelebration(state);
  renderWeek(state);
  renderLogs(state);
  renderTips(state);
  Object.keys(mainDetailState).forEach(function (cardId) {
    updateDetailCard(cardId, mainDetailState[cardId]);
  });
}

function renderMain(state) {
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildMainScreenModel
    ? window.HabitScreenModels.buildMainScreenModel(state)
    : null;
  if (vm && window.HabitScreenDom && window.HabitScreenDom.applyMainScreenViewModel) {
    window.HabitScreenDom.applyMainScreenViewModel(vm);
  }

  renderSetupBanner(state);
  renderFirstWeekCard(state);
  renderCelebration(state);
  renderWeek(state);
  renderLogs(state);
  renderTips(state);
  Object.keys(mainDetailState).forEach(function (cardId) {
    updateDetailCard(cardId, mainDetailState[cardId]);
  });
}

document.getElementById("record-btn").addEventListener("click", function () {
  var state = window.HabitStore.getState();
  var trackerCopy = polishTrackerCopy(state.currentHabit.id, getTrackerCopy(state.currentHabit.id));
  var slipEvent = getNextSlipEvent(state.currentHabit.id);
  window.HabitStore.recordSlip(slipEvent);
  showToast(trackerCopy.slipToast);
});

document.getElementById("resisted-btn").addEventListener("click", function () {
  var state = window.HabitStore.getState();
  var trackerCopy = polishTrackerCopy(state.currentHabit.id, getTrackerCopy(state.currentHabit.id));
  window.HabitStore.recordResisted(getHabitDemoEvents(state.currentHabit.id).resisted);
  showToast(trackerCopy.successToast);
});
document.getElementById("setup-banner-btn").addEventListener("click", function () {
  openSetupNextStep(window.HabitStore.getState());
});
document.querySelectorAll("[data-detail-card]").forEach(function (button) {
  button.addEventListener("click", function () {
    var cardId = button.dataset.detailCard;
    mainDetailState[cardId] = !mainDetailState[cardId];
    updateDetailCard(cardId, mainDetailState[cardId]);
  });
});

window.HabitStore.subscribe(renderMain);
window.DemoNavigation.initBottomTabs();
renderMain(window.HabitStore.getState());
