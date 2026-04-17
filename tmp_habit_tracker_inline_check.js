
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded-shell");
}
var demoEventIndexes = {};
var activeTips = {};
var mainDetailState = {
  "day-cost-card": false,
  "recent-log-card": false
};
var currentMainViewModel = null;
var ritualCarryoverState = {
  status: "",
  note: ""
};
var slipComposerState = {
  open: false,
  tags: [],
  bodySignals: [],
  note: "",
  cravingLevel: 4
};
var memoryExpanded = false;

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
    ? "РСЃС‚РѕС‡РЅРёРє: " + advice.sourceLabel
    : "РџРѕРєР° СЌС‚Рѕ РїСЂРѕРґСѓРєС‚РѕРІР°СЏ РїРѕРґСЃРєР°Р·РєР°, РЅРµ РєР»РёРЅРёС‡РµСЃРєР°СЏ СЂРµРєРѕРјРµРЅРґР°С†РёСЏ";
  return source;
}

function formatMoney(value, symbol) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(Number(value) || 0) + " " + (symbol || "в‚Ѕ");
}

function formatMinutes(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(Number(value) || 0) + " РјРёРЅ";
}

function compactWeekTrend(direction) {
  if (direction === "up") return "С„РѕРЅ С‚СЏР¶РµР»РµРµ";
  if (direction === "down") return "С„РѕРЅ РјСЏРіС‡Рµ";
  if (direction === "stable") return "С„РѕРЅ СЂРѕРІРЅРµРµ";
  return "РґР°РЅРЅС‹С… РјР°Р»Рѕ";
}

function compactHealthTrend(direction) {
  if (direction === "up") return "РµСЃС‚СЊ СЃРґРІРёРі";
  if (direction === "down") return "РЅСѓР¶РЅР° РѕРїРѕСЂР°";
  if (direction === "stable") return "СЂРѕРІРЅРѕ";
  return "Р±РµР· РґРёРЅР°РјРёРєРё";
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
        { t: "Р§С‚Рѕ РїРѕРїСЂРѕР±РѕРІР°С‚СЊ", d: match.advice.body },
        { t: "РџРѕС‡РµРјСѓ СЌС‚Рѕ РјРѕР¶РµС‚ РїРѕРјРѕС‡СЊ", d: match.advice.rationale },
        { t: "РћСЃРЅРѕРІР°", d: getAdviceMetaText(match.advice) }
      ]
    }
  };
}

function getAdviceDrivenTips(state) {
  if (!window.HabitAdviceLibrary || !window.HabitAdviceLibrary.buildAdviceBundle) {
    return {
      primary: {
        label: "РЎРѕРІРµС‚ РЅРµРґРѕСЃС‚СѓРїРµРЅ",
        data: {
          title: "Р‘РёР±Р»РёРѕС‚РµРєР° СЃРѕРІРµС‚РѕРІ РЅРµРґРѕСЃС‚СѓРїРЅР°",
          sub: "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РµРґРёРЅС‹Р№ РєР°С‚Р°Р»РѕРі СЂРµРєРѕРјРµРЅРґР°С†РёР№",
          items: [
            { t: "Р§С‚Рѕ РґРµР»Р°С‚СЊ СЃРµР№С‡Р°СЃ", d: "РћР±РЅРѕРІРё СЌРєСЂР°РЅ. Р•СЃР»Рё РїСЂРѕР±Р»РµРјР° РѕСЃС‚Р°РЅРµС‚СЃСЏ, РїСЂРѕРІРµСЂСЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ РјРѕРґСѓР»СЏ advice-library.js." }
          ]
        }
      },
      secondary: {
        label: "РќРµС‚ РґР°РЅРЅС‹С…",
        data: {
          title: "РЎРѕРІРµС‚С‹ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅС‹",
          sub: "Р•РґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє СЃРѕРІРµС‚РѕРІ РЅРµ Р±С‹Р» РЅР°Р№РґРµРЅ",
          items: [
            { t: "РџРѕС‡РµРјСѓ СЌС‚Рѕ РІР°Р¶РЅРѕ", d: "Р“Р»Р°РІРЅР°СЏ С‚РµРїРµСЂСЊ С‡РёС‚Р°РµС‚ СЃРѕРІРµС‚С‹ С‚РѕР»СЊРєРѕ РёР· Р±РёР±Р»РёРѕС‚РµРєРё, Р±РµР· СЃС‚Р°С‚РёС‡РµСЃРєРёС… РґСѓР±Р»РёРєР°С‚РѕРІ РІ РёРЅС‚РµСЂС„РµР№СЃРµ." }
          ]
        }
      },
      tertiary: {
        label: "РџСЂРѕРІРµСЂСЊ РјРѕРґСѓР»СЊ",
        data: {
          title: "РќСѓР¶РЅР° Р±РёР±Р»РёРѕС‚РµРєР° advice-library",
          sub: "РЎРµР№С‡Р°СЃ РєРѕРЅС‚РµРЅС‚ РЅРµ РїРѕРґРіСЂСѓР·РёР»СЃСЏ",
          items: [
            { t: "РЎР»РµРґСѓСЋС‰РёР№ С€Р°Рі", d: "РќСѓР¶РЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ analytics/advice-library.js, С‡С‚РѕР±С‹ СЃРѕРІРµС‚С‹ СЃРЅРѕРІР° РїРѕСЏРІРёР»РёСЃСЊ." }
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
    primary: adviceMatchToTipData(bundle.primary, "РЎРµР№С‡Р°СЃ РїРѕРјРѕР¶РµС‚"),
    secondary: adviceMatchToTipData(bundle.support[0] || bundle.primary, "Р•С‰С‘ РІР°СЂРёР°РЅС‚"),
    tertiary: adviceMatchToTipData(bundle.reflection || bundle.support[1] || bundle.primary, "Р§С‚Рѕ Р·Р°РјРµС‚РёС‚СЊ")
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

function getSlipComposeChoices(habitId) {
  var config = getHabitDemoEvents(habitId);
  var seen = {};
  var tags = [];
  (config.slips || []).forEach(function (item) {
    (item.triggerTags || [item.triggerTag]).forEach(function (tag) {
      if (!tag || seen[tag]) return;
      seen[tag] = true;
      tags.push(tag);
    });
  });
  return tags.slice(0, 5);
}

function getSlipTriggerDetails(tag) {
  var details = {
    stress: { icon: "!", bg: "#FAEEDA", fg: "#9A5A0B", sub: "давление, тревога" },
    boredom: { icon: "☻", bg: "#E8F1FB", fg: "#195FA5", sub: "пустота, ожидание" },
    company: { icon: "◌", bg: "#EEEDFE", fg: "#534AB7", sub: "окружение, рядом люди" },
    after_food: { icon: "◴", bg: "#E3F5EE", fg: "#137B5C", sub: "после еды, тянет по привычке" },
    fatigue: { icon: "◔", bg: "#F5EEDC", fg: "#97610E", sub: "сил уже почти не было" },
    ritual: { icon: "○", bg: "#F0ECE3", fg: "#6D655B", sub: "автоматически, не заметил как" }
  };
  return details[tag] || { icon: "•", bg: "#F0ECE3", fg: "#6D655B", sub: "этот момент стоит заметить" };
}

function getSlipIntensityChoices() {
  return [
    { value: 2, title: "Слабо", sub: "просто сделал", color: "#1D9E75" },
    { value: 4, title: "Ощутимо", sub: "боролся", color: "#EF9F27" },
    { value: 5, title: "Очень сильно", sub: "не смог", color: "#D85A30" }
  ];
}

function getActiveSlipAnchorText(state) {
  var entries = Array.isArray(state.ritualEntries) ? state.ritualEntries : [];
  var now = new Date();
  var key = window.HabitStore.helpers.formatDateKey(now);
  var todayMorning = entries.find(function (entry) {
    return entry.localDate === key && entry.type === "morning" && entry.text;
  });
  if (todayMorning && todayMorning.text) {
    return todayMorning.text;
  }
  if (currentMainViewModel && currentMainViewModel.ritual) {
    if (currentMainViewModel.ritual.mode === "carryover" && currentMainViewModel.ritual.contextText) {
      return currentMainViewModel.ritual.contextText;
    }
    if (currentMainViewModel.ritual.value) {
      return currentMainViewModel.ritual.value;
    }
    if (currentMainViewModel.ritual.contextText) {
      return currentMainViewModel.ritual.contextText;
    }
  }
  return "Сначала заметить момент, а не спорить с собой.";
}

function openSlipSheet() {
  slipComposerState.open = true;
  renderSlipComposer(window.HabitStore.getState());
}

function closeSlipSheet() {
  slipComposerState.open = false;
  slipComposerState.tags = [];
  slipComposerState.bodySignals = [];
  slipComposerState.note = "";
  slipComposerState.cravingLevel = 4;
  renderSlipComposer(window.HabitStore.getState());
}

function renderSlipComposer(state) {
  var root = document.getElementById("slip-sheet");
  var triggerRow = document.getElementById("slip-tag-row");
  var intensityRow = document.getElementById("slip-intensity-row");
  var noteInput = document.getElementById("slip-note");
  var toggle = document.getElementById("record-btn");
  var subtitle = document.querySelector(".record-cta-sub");
  var arrow = document.querySelector(".record-cta-arrow");
  var title = document.getElementById("slip-sheet-title");
  var sub = document.getElementById("slip-sheet-sub");
  var meta = document.getElementById("slip-sheet-meta");
  var anchorValue = document.getElementById("slip-sheet-anchor-value");
  var saveBtn = document.getElementById("slip-save-btn");
  if (!root || !triggerRow || !intensityRow || !noteInput || !toggle) return;

  var choices = getSlipComposeChoices(state.currentHabit.id);
  var intensityChoices = getSlipIntensityChoices();
  root.classList.toggle("open", !!slipComposerState.open);
  toggle.classList.toggle("open", !!slipComposerState.open);
  if (subtitle) subtitle.textContent = "быстро · два касания";
  if (arrow) arrow.textContent = "›";
  if (title) title.textContent = "Что произошло?";
  if (sub) sub.textContent = "Один быстрый шаг, чтобы сохранить момент без лишней анкеты.";
  if (meta) meta.textContent = "сегодня: " + window.HabitStore.getTodaySlipCount(state);
  if (anchorValue) anchorValue.textContent = "«" + getActiveSlipAnchorText(state) + "»";
  if (saveBtn) saveBtn.textContent = "Сохранить";
  noteInput.placeholder = "Что происходило в этот момент...";
  triggerRow.innerHTML = choices.map(function (tag) {
    var active = slipComposerState.tags.indexOf(tag) !== -1;
    var details = getSlipTriggerDetails(tag);
    return '<button class="slip-trigger-card' + (active ? ' active' : '') + '" type="button" data-slip-tag="' + tag + '">' +
      '<div class="slip-trigger-icon" style="background:' + details.bg + ';color:' + details.fg + ';">' + details.icon + '</div>' +
      '<div class="slip-trigger-copy"><div class="slip-trigger-title">' + window.HabitStore.helpers.triggerLabel(tag) + '</div>' +
      '<div class="slip-trigger-sub">' + details.sub + '</div></div>' +
      '</button>';
  }).join("");
  intensityRow.innerHTML = intensityChoices.map(function (item) {
    var active = slipComposerState.cravingLevel === item.value;
    return '<button class="slip-intensity-card' + (active ? ' active' : '') + '" type="button" data-slip-intensity="' + item.value + '">' +
      '<div class="slip-intensity-dot" style="background:' + item.color + ';"></div>' +
      '<div class="slip-intensity-title">' + item.title + '</div>' +
      '<div class="slip-intensity-sub">' + item.sub + '</div>' +
      '</button>';
  }).join("");
  if (noteInput.value !== slipComposerState.note) {
    noteInput.value = slipComposerState.note;
  }
}

function renderMemoryCardState() {
  var card = document.getElementById("memory-card");
  if (!card) return;
  card.classList.toggle("collapsed", !memoryExpanded);
  card.classList.toggle("expanded", !!memoryExpanded);
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
  var labels = ["РїРЅ","РІС‚","СЃСЂ","С‡С‚","РїС‚","СЃР±","РІСЃ"];
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
    return '<div class="week-col"><div class="w-day">' + label + '</div><div class="w-bar" style="height:' + height + 'px;background:' + color + ';"></div><div class="w-num ' + className + '">' + (count || "вЂ”") + '</div></div>';
  }).join("");
}

function renderLogs(state) {
  var root = document.getElementById("log-section");
  var recent = state.slips.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  }).slice(0, 6);
  document.getElementById("recent-log-summary").textContent = recent.length
    ? window.HabitStore.helpers.triggerLabel(recent[0].triggerTag) + " В· " + window.HabitStore.helpers.formatTime(new Date(recent[0].timestamp))
    : "Р—Р°РїРёСЃРё РїРѕСЏРІСЏС‚СЃСЏ РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ СЃРѕР±С‹С‚РёСЏ";
  if (!recent.length) {
    root.innerHTML = '<div class="log-item"><div class="log-dot" style="background:#9FE1CB;"></div><div class="log-text">РџРѕРєР° Р·РґРµСЃСЊ СЃРїРѕРєРѕР№РЅРѕ. РџРµСЂРІС‹Р№ СЌРїРёР·РѕРґ РёР»Рё РјРѕРјРµРЅС‚ СѓРґРµСЂР¶Р°РЅРёСЏ СЃСЂР°Р·Сѓ РїРѕСЏРІРёС‚СЃСЏ РІ Р»РµРЅС‚Рµ.</div><div class="log-time">СЃРµР№С‡Р°СЃ</div></div>';
    return;
  }
  root.innerHTML = recent.map(function (item) {
    var date = new Date(item.timestamp);
    return '<div class="log-item"><div class="log-dot" style="background:' + window.HabitStore.helpers.triggerColor(item.triggerTag) + ';"></div><div class="log-text">' + window.HabitStore.helpers.triggerLabel(item.triggerTag) + ' В· ' + (item.note || "Р‘РµР· РєРѕРјРјРµРЅС‚Р°СЂРёСЏ") + '</div><div class="log-time">' + window.HabitStore.helpers.formatTime(date) + '</div></div>';
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
  document.getElementById("quick-money").textContent = formatMoney(todaySpent, finance.currencySymbol || "в‚Ѕ");
  document.getElementById("quick-money-sub").textContent = "РќРµРґРµР»СЏ: " + formatMoney(finance.weekSpent || 0, finance.currencySymbol || "в‚Ѕ");
  document.getElementById("quick-time").textContent = formatMinutes(todayMinutes);
  document.getElementById("quick-time-sub").textContent = "РњРµСЃСЏС†: " + (finance.monthHours || 0) + " С‡";
  document.getElementById("quick-health").textContent = health.filledCount + "/" + health.totalCount;
  document.getElementById("quick-health-sub").textContent = health.filledCount ? "СЃРѕРЅ, РґР°РІР»РµРЅРёРµ Рё С‚РµР»Рѕ РІ С„РѕРєСѓСЃРµ" : "РјР°СЂРєРµСЂС‹ РїРѕРєР° РЅРµ Р·Р°РїРѕР»РЅРµРЅС‹";
  document.getElementById("day-cost-summary").textContent = formatMoney(todaySpent, finance.currencySymbol || "в‚Ѕ") + " В· " + formatMinutes(todayMinutes) + " В· health " + health.filledCount + "/" + health.totalCount;
}

function renderWeekSnapshot() {
  if (!window.HabitAnalytics) return;
  var model = window.HabitAnalytics.getInsightViewModel("7d");
  var summary = model.summary || {};
  var wellbeing = model.wellbeing || {};
  var health = model.health || {};
  var observedDays = Number(summary.observedDays) || 0;

  document.getElementById("week-snapshot-sub").textContent = observedDays >= 4
    ? "РўСЂРё СЃРёРіРЅР°Р»Р°, С‡С‚РѕР±С‹ Р±С‹СЃС‚СЂРѕ РїРѕРЅСЏС‚СЊ СЂРёС‚Рј РїРѕСЃР»РµРґРЅРёС… 7 РґРЅРµР№."
    : "РќРµРґРµР»СЏ РµС‰С‘ СЃРѕР±РёСЂР°РµС‚ РѕСЃРЅРѕРІСѓ, РЅРѕ РїРµСЂРІС‹Рµ СЃРёРіРЅР°Р»С‹ СѓР¶Рµ РІРёРґРЅС‹.";
  document.getElementById("week-snapshot-badge").textContent = observedDays >= 4 ? "РµСЃС‚СЊ СЂРёС‚Рј" : "СЂР°РЅРЅРёР№ РїРµСЂРёРѕРґ";

  document.getElementById("week-snapshot-behavior-value").textContent = "РРЅРґРµРєСЃ " + summary.dependencyIndex;
  document.getElementById("week-snapshot-behavior-copy").textContent =
    trimSentence("РўСЂРёРіРіРµСЂ: " + String(summary.mainTrigger || "Р”СЂСѓРіРѕРµ").toLowerCase() + ". РћРєРЅРѕ: " + (summary.riskWindow || "вЂ”") + ".", 56);

  if (wellbeing.stateEntryCount) {
    var stress = wellbeing.averages && wellbeing.averages.stress ? wellbeing.averages.stress.toFixed(1) : "0.0";
    document.getElementById("week-snapshot-state-value").textContent = "РЎС‚СЂРµСЃСЃ " + stress + "/5";
    document.getElementById("week-snapshot-state-copy").textContent =
      trimSentence(compactWeekTrend(wellbeing.trend && wellbeing.trend.direction) + (wellbeing.contextLabel ? " В· С‡Р°С‰Рµ " + wellbeing.contextLabel : ""), 56);
  } else {
    document.getElementById("week-snapshot-state-value").textContent = "РќРµС‚ С„РѕРЅР°";
    document.getElementById("week-snapshot-state-copy").textContent = "РџРѕСЏРІРёС‚СЃСЏ РїРѕСЃР»Рµ Р·Р°РїРёСЃРµР№ СЃРѕСЃС‚РѕСЏРЅРёСЏ.";
  }

  document.getElementById("week-snapshot-health-value").textContent =
    (health.filledCount || 0) + "/" + (health.totalCount || 0);
  document.getElementById("week-snapshot-health-copy").textContent =
    trimSentence(compactHealthTrend(health.trendDirection) + " В· " + (health.filledCount ? health.trendSummary : "РјРѕР¶РЅРѕ РЅР°С‡Р°С‚СЊ СЃРѕ СЃРЅР° Рё РїСѓР»СЊСЃР°"), 56);
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
document.getElementById("memory-toggle").addEventListener("click", function () {
  memoryExpanded = !memoryExpanded;
  renderMemoryCardState();
});
}

function getTrackerCopy(habitId) {
  var copy = {
    recordLabel: "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЃСЂС‹РІ",
    resistedLabel: "РЈРґРµСЂР¶Р°Р»СЃСЏ",
    slipToast: "РЎРѕР±С‹С‚РёРµ СЃРѕС…СЂР°РЅРµРЅРѕ. Р—Р°РїРёСЃСЊ СѓР¶Рµ РѕС‚РїСЂР°РІР»РµРЅР° РІ РґРЅРµРІРЅРёРє Рё Р°РЅР°Р»РёС‚РёРєСѓ.",
    successToast: "РњРѕРјРµРЅС‚ СѓРґРµСЂР¶Р°РЅРёСЏ СЃРѕС…СЂР°РЅС‘РЅ Рё СѓСЃРёР»РёС‚ Р°РЅР°Р»РёС‚РёРєСѓ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ."
  };

  if (habitId === "alcohol") {
    copy.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    copy.resistedLabel = "РќРµ РІС‹РїРёР»";
    copy.slipToast = "Р­РїРёР·РѕРґ СЃ Р°Р»РєРѕРіРѕР»РµРј СЃРѕС…СЂР°РЅС‘РЅ. РћРЅ СѓР¶Рµ РІР»РёСЏРµС‚ РЅР° РґРЅРµРІРЅРёРє Рё Р°РЅР°Р»РёС‚РёРєСѓ.";
    copy.successToast = "РњРѕРјРµРЅС‚, РєРѕРіРґР° С‚С‹ РЅРµ РІС‹РїРёР», СЃРѕС…СЂР°РЅС‘РЅ РєР°Рє РѕРїРѕСЂР° РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.";
  } else if (habitId === "sweets") {
    copy.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    copy.slipToast = "Р­РїРёР·РѕРґ СЃРѕ СЃР»Р°РґРєРёРј СЃРѕС…СЂР°РЅС‘РЅ. РўРµРїРµСЂСЊ Р±СѓРґРµС‚ Р»РµРіС‡Рµ Р·Р°РјРµС‚РёС‚СЊ, С‡С‚Рѕ Р·Р°РїСѓСЃРєР°РµС‚ С‚СЏРіСѓ.";
    copy.successToast = "РњРѕРјРµРЅС‚ СѓРґРµСЂР¶Р°РЅРёСЏ РѕС‚ СЃР»Р°РґРєРѕРіРѕ СЃРѕС…СЂР°РЅС‘РЅ Рё РїРѕРґРґРµСЂР¶РёС‚ Р°РЅР°Р»РёС‚РёРєСѓ СЃР°РјРѕРєРѕРЅС‚СЂРѕР»СЏ.";
  } else if (habitId === "social") {
    copy.recordLabel = "РЎРѕСЂРІР°Р»СЃСЏ РІ Р»РµРЅС‚Сѓ";
    copy.resistedLabel = "Р’С‹С€РµР» РІРѕРІСЂРµРјСЏ";
    copy.slipToast = "Р—Р°С…РѕРґ РІ Р»РµРЅС‚Сѓ СЃРѕС…СЂР°РЅС‘РЅ. Р­С‚Рѕ РїРѕРјРѕР¶РµС‚ СѓРІРёРґРµС‚СЊ, РєРѕРіРґР° Р°РІС‚РѕРїСЂРѕРєСЂСѓС‚РєР° РІРєР»СЋС‡Р°РµС‚СЃСЏ С‡Р°С‰Рµ.";
    copy.successToast = "РњРѕРјРµРЅС‚ РІС‹С…РѕРґР° РёР· Р»РµРЅС‚С‹ СЃРѕС…СЂР°РЅС‘РЅ Рё РїРѕРјРѕР¶РµС‚ Р°РЅР°Р»РёС‚РёРєРµ СЃР°РјРѕРєРѕРЅС‚СЂРѕР»СЏ.";
  } else if (habitId === "overeating") {
    copy.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    copy.resistedLabel = "РћСЃС‚Р°РЅРѕРІРёР»СЃСЏ РІРѕРІСЂРµРјСЏ";
    copy.slipToast = "Р­РїРёР·РѕРґ РїРµСЂРµРµРґР°РЅРёСЏ СЃРѕС…СЂР°РЅС‘РЅ. РўР°Рє Р±СѓРґРµС‚ РїСЂРѕС‰Рµ СѓРІРёРґРµС‚СЊ РµРіРѕ СЂРµР°Р»СЊРЅСѓСЋ РїСЂРёС‡РёРЅСѓ.";
    copy.successToast = "РњРѕРјРµРЅС‚, РєРѕРіРґР° С‚С‹ РѕСЃС‚Р°РЅРѕРІРёР»СЃСЏ РІРѕРІСЂРµРјСЏ, СЃРѕС…СЂР°РЅС‘РЅ Рё СѓСЃРёР»РёС‚ Р°РЅР°Р»РёС‚РёРєСѓ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ.";
  } else if (habitId === "custom") {
    copy.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    copy.slipToast = "Р­РїРёР·РѕРґ СЃРѕС…СЂР°РЅС‘РЅ. РћРЅ СѓР¶Рµ РїРѕРїР°Р» РІ РґРЅРµРІРЅРёРє Рё Р°РЅР°Р»РёС‚РёРєСѓ РїСЂРёРІС‹С‡РєРё.";
  }

  return copy;
}

function getTrackerStateCopy(habitId, todayCount, limit) {
  var lowThreshold = Math.max(1, Math.floor(limit * 0.4));
  var stage = todayCount === 0 ? "zero" : todayCount <= lowThreshold ? "low" : todayCount < limit ? "mid" : "high";
  var maps = {
    smoking: {
      zero: { badge: "С‡РёСЃС‚С‹Р№ РґРµРЅСЊ", title: "РЎРµРіРѕРґРЅСЏ Р±РµР· СЃРёРіР°СЂРµС‚", text: "РЎРёР»СЊРЅРѕРµ РЅР°С‡Р°Р»Рѕ. Р§РµРј РґРѕР»СЊС€Рµ РґРµРЅСЊ РёРґС‘С‚ Р±РµР· Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ СЂРёС‚СѓР°Р»Р°, С‚РµРј Р±РѕР»СЊС€Рµ Сѓ С‚РµР±СЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІР° РґР»СЏ РІС‹Р±РѕСЂР°." },
      low: { badge: "РєРѕРЅС‚СЂРѕР»СЊ РґРµСЂР¶РёС‚СЃСЏ", title: "РљСѓСЂРµРЅРёРµ РїРѕРєР° РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј", text: "РўС‹ РЅРµ РґР°Р» РїСЂРёРІС‹С‡РєРµ Р·Р°Р±СЂР°С‚СЊ РґРµРЅСЊ С†РµР»РёРєРѕРј. РќРµСЃРєРѕР»СЊРєРѕ СЃРїРѕРєРѕР№РЅС‹С… СЂРµС€РµРЅРёР№ РїРѕРґСЂСЏРґ СѓР¶Рµ РјРµРЅСЏСЋС‚ СЃС†РµРЅР°СЂРёР№." },
      mid: { badge: "РёРґС‘С‚ СЃРЅРёР¶РµРЅРёРµ", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " СЌРї.", text: "Р­С‚Рѕ РµС‰С‘ СѓРїСЂР°РІР»СЏРµРјС‹Р№ РґРёР°РїР°Р·РѕРЅ. РЎР°РјС‹Р№ РїРѕР»РµР·РЅС‹Р№ С€Р°Рі СЃРµР№С‡Р°СЃ вЂ” РїРѕР№РјР°С‚СЊ СЃР»РµРґСѓСЋС‰РёР№ С‚СЂРёРіРіРµСЂ С‡СѓС‚СЊ СЂР°РЅСЊС€Рµ." },
      high: { badge: "РЅР°РїСЂСЏР¶С‘РЅРЅС‹Р№ РґРµРЅСЊ", title: "Р”РµРЅСЊ РїРѕР»СѓС‡РёР»СЃСЏ С‚СЏР¶С‘Р»С‹Рј", text: "РќРµ СЃРІРѕРґРё РІСЃС‘ Рє СЃРёР»Рµ РІРѕР»Рё. Р›СѓС‡С€Рµ СЃРјРѕС‚СЂРё, РІ РєР°РєРѕР№ РјРѕРјРµРЅС‚ РєСѓСЂРµРЅРёРµ РІРєР»СЋС‡Р°Р»РѕСЃСЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, Рё РіРѕС‚РѕРІСЊ Р·Р°РјРµРЅСѓ РёРјРµРЅРЅРѕ С‚СѓРґР°." }
    },
    alcohol: {
      zero: { badge: "СЃРїРѕРєРѕР№РЅС‹Р№ РґРµРЅСЊ", title: "РЎРµРіРѕРґРЅСЏ Р±РµР· Р°Р»РєРѕРіРѕР»СЏ", text: "РҐРѕСЂРѕС€РёР№ Р±Р°Р·РѕРІС‹Р№ РґРµРЅСЊ. Р§РµРј СЃРїРѕРєРѕР№РЅРµРµ С‚С‹ РїСЂРѕС…РѕРґРёС€СЊ С‚СЂРёРіРіРµСЂРЅС‹Рµ РѕРєРЅР°, С‚РµРј СЃРёР»СЊРЅРµРµ РѕС‰СѓС‰РµРЅРёРµ РєРѕРЅС‚СЂРѕР»СЏ." },
      low: { badge: "РєРѕРЅС‚СЂРѕР»СЊ РЅР° С‚РІРѕРµР№ СЃС‚РѕСЂРѕРЅРµ", title: "РџРѕРєР° Р±РµР· Р»РёС€РЅРёС… СЌРїРёР·РѕРґРѕРІ", text: "РЎС†РµРЅР°СЂРёР№ РµС‰С‘ РЅРµ СЂР°Р·РѕРіРЅР°Р»СЃСЏ. Р›СѓС‡С€Рµ Р·Р°СЂР°РЅРµРµ СЂРµС€РёС‚СЊ, С‡РµРј Р·Р°РјРµРЅРёС‚СЊ СЃР»РµРґСѓСЋС‰РёР№ РёРјРїСѓР»СЊСЃ Рє Р°Р»РєРѕРіРѕР»СЋ." },
      mid: { badge: "РґРµРЅСЊ РїРѕРґ РЅР°Р±Р»СЋРґРµРЅРёРµРј", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " СЌРї.", text: "Р”РµРЅСЊ РµС‰С‘ РјРѕР¶РЅРѕ РІРµСЂРЅСѓС‚СЊ РІ СЃРїРѕРєРѕР№РЅС‹Р№ СЂРµР¶РёРј. РџРѕРјРѕРіР°РµС‚ РЅРµ СЃРїРѕСЂРёС‚СЊ СЃ СЃРѕР±РѕР№, Р° Р·Р°СЂР°РЅРµРµ СѓР±СЂР°С‚СЊ РґРѕСЃС‚СѓРї Рё СЃРѕС†РёР°Р»СЊРЅС‹Р№ С‚СЂРёРіРіРµСЂ." },
      high: { badge: "СЃР»РѕР¶РЅС‹Р№ РґРµРЅСЊ", title: "РЎРµРіРѕРґРЅСЏ Р±С‹Р»Рѕ РјРЅРѕРіРѕ С‚СЂРёРіРіРµСЂРѕРІ", text: "РЎРµР№С‡Р°СЃ РІР°Р¶РЅРµРµ РјСЏРіРєРѕ СЃРѕРєСЂР°С‚РёС‚СЊ СЃР»РµРґСѓСЋС‰РёР№ СЌРїРёР·РѕРґ Рё РїРѕРґРіРѕС‚РѕРІРёС‚СЊ Р±РµР·РѕРїР°СЃРЅС‹Р№ СЃС†РµРЅР°СЂРёР№, С‡РµРј С‚СЂРµР±РѕРІР°С‚СЊ РёРґРµР°Р»СЊРЅРѕСЃС‚Рё." }
    },
    sweets: {
      zero: { badge: "СЂРѕРІРЅС‹Р№ РґРµРЅСЊ", title: "РЎР»Р°РґРєРѕРµ РїРѕРєР° РЅРµ РІРєР»СЋС‡РёР»РѕСЃСЊ", text: "РћС‚Р»РёС‡РЅРѕРµ РЅР°С‡Р°Р»Рѕ. Р•СЃР»Рё СѓРґРµСЂР¶Р°С‚СЊ СЂРёС‚Рј РµРґС‹ Рё СЌРЅРµСЂРіРёРё, С‚СЏРЅСѓС‚СЊ Р±СѓРґРµС‚ Р·Р°РјРµС‚РЅРѕ РјРµРЅСЊС€Рµ." },
      low: { badge: "С‚СЏРіР° СЃРЅРёР¶Р°РµС‚СЃСЏ", title: "Р”РµРЅСЊ РёРґС‘С‚ СЃС‚Р°Р±РёР»СЊРЅРѕ", text: "РўС‹ СѓР¶Рµ РґРµСЂР¶РёС€СЊ СЃР»Р°РґРєРѕРµ РЅРµ РЅР° Р°РІС‚РѕРјР°С‚Рµ. РЎР»РµРґСѓСЋС‰РёР№ СЃРёР»СЊРЅС‹Р№ РјРѕРјРµРЅС‚ С‡Р°С‰Рµ РІСЃРµРіРѕ РїСЂРёС…РѕРґРёС‚ РїРѕСЃР»Рµ РµРґС‹ РёР»Рё СѓСЃС‚Р°Р»РѕСЃС‚Рё." },
      mid: { badge: "РІР°Р¶РµРЅ СЃР»РµРґСѓСЋС‰РёР№ РІС‹Р±РѕСЂ", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " СЌРї.", text: "Р­С‚Рѕ РµС‰С‘ РЅРµ РїСЂРѕРІР°Р» РґРЅСЏ. РЎРµР№С‡Р°СЃ Р»СѓС‡С€Рµ Р·Р°СЂР°РЅРµРµ Р·Р°РєСЂС‹С‚СЊ СЃР»РµРґСѓСЋС‰РёР№ С‚СЂРёРіРіРµСЂ: РіРѕР»РѕРґ, СЃС‚СЂРµСЃСЃ РёР»Рё РІРёР·СѓР°Р»СЊРЅС‹Р№ РґРѕСЃС‚СѓРї." },
      high: { badge: "РґРµРЅСЊ РїРµСЂРµРіСЂСѓР¶РµРЅ", title: "РўСЏРіР° СЃРµРіРѕРґРЅСЏ Р±С‹Р»Р° РІС‹СЃРѕРєРѕР№", text: "РќРµ СЂСѓРіР°Р№ СЃРµР±СЏ. РџРѕР»РµР·РЅРµРµ РїРѕРЅСЏС‚СЊ, РіРґРµ РїСЂРѕСЃРµР»Р° СЌРЅРµСЂРіРёСЏ РёР»Рё РЅР°РєРѕРїРёР»СЃСЏ СЃС‚СЂРµСЃСЃ, Рё РїРѕРґСЃС‚СЂР°С…РѕРІР°С‚СЊ РёРјРµРЅРЅРѕ СЌС‚РѕС‚ РјРѕРјРµРЅС‚." }
    },
    social: {
      zero: { badge: "С„РѕРєСѓСЃ РґРµСЂР¶РёС‚СЃСЏ", title: "Р›РµРЅС‚Р° РїРѕРєР° РЅРµ Р·Р°Р±СЂР°Р»Р° РґРµРЅСЊ", text: "РҐРѕСЂРѕС€РёР№ СЂРёС‚Рј. Р§РµРј СЂРµР¶Рµ С‚РµР»РµС„РѕРЅ РїРѕРїР°РґР°РµС‚ РІ СЂСѓРєРё Р±РµР· С†РµР»Рё, С‚РµРј СЃР»Р°Р±РµРµ Р°РІС‚РѕРїСЂРѕРєСЂСѓС‚РєР°." },
      low: { badge: "СЌРєСЂР°РЅ РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј", title: "РўС‹ РїРѕРєР° СѓРїСЂР°РІР»СЏРµС€СЊ РІРЅРёРјР°РЅРёРµРј", text: "Р•СЃС‚СЊ Р·Р°РїР°СЃ. РЎР°РјРѕРµ РїРѕР»РµР·РЅРѕРµ СЃРµР№С‡Р°СЃ вЂ” Р·Р°СЂР°РЅРµРµ СЂРµС€РёС‚СЊ, РєРѕРіРґР° РёРјРµРЅРЅРѕ РјРѕР¶РЅРѕ Р·Р°С…РѕРґРёС‚СЊ РІ Р»РµРЅС‚Сѓ Рё РєРѕРіРґР° РІС‹С…РѕРґРёС‚СЊ." },
      mid: { badge: "РІР°Р¶РµРЅ РІС‹С…РѕРґ РІРѕРІСЂРµРјСЏ", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " Р·Р°С…РѕРґР°", text: "Р”РµРЅСЊ РµС‰С‘ РјРѕР¶РЅРѕ РІС‹СЂРѕРІРЅСЏС‚СЊ. РЎР»РµРґСѓСЋС‰РёР№ Р»СѓС‡С€РёР№ С€Р°Рі вЂ” СЃРѕРєСЂР°С‚РёС‚СЊ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ, Р° РЅРµ Р¶РґР°С‚СЊ РёРґРµР°Р»СЊРЅРѕРіРѕ РЅСѓР»СЏ." },
      high: { badge: "РґРµРЅСЊ СЂР°СЃСЃС‹РїР°Р»СЃСЏ", title: "РђРІС‚РѕРїСЂРѕРєСЂСѓС‚РєР° СЃРµРіРѕРґРЅСЏ СѓСЃРёР»РёР»Р°СЃСЊ", text: "РћР±С‹С‡РЅРѕ СЌС‚Рѕ СЃРІСЏР·Р°РЅРѕ СЃ СѓСЃС‚Р°Р»РѕСЃС‚СЊСЋ, РїРµСЂРµРіСЂСѓР·РєРѕР№ РёР»Рё СЃРєСѓРєРѕР№. РЎРµР№С‡Р°СЃ Р»СѓС‡С€Рµ СѓР±СЂР°С‚СЊ С‚РµР»РµС„РѕРЅ РёР· Р±С‹СЃС‚СЂРѕРіРѕ РґРѕСЃС‚СѓРїР° Рё РґР°С‚СЊ РјРѕР·РіСѓ РґСЂСѓРіРѕР№ СЂРёС‚СѓР°Р»." }
    },
    overeating: {
      zero: { badge: "СЃРїРѕРєРѕР№РЅС‹Р№ СЂРёС‚Рј", title: "РџРѕРєР° Р±РµР· СЌРїРёР·РѕРґРѕРІ РїРµСЂРµРµРґР°РЅРёСЏ", text: "Р РѕРІРЅС‹Р№ РґРµРЅСЊ. РљРѕРіРґР° РµРґР° РѕСЃС‚Р°С‘С‚СЃСЏ РѕС‚РІРµС‚РѕРј РЅР° РіРѕР»РѕРґ, Р° РЅРµ РЅР° РЅР°РїСЂСЏР¶РµРЅРёРµ, С‚РµР»Сѓ СЃС‚Р°РЅРѕРІРёС‚СЃСЏ Р»РµРіС‡Рµ." },
      low: { badge: "РґРµРЅСЊ РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј", title: "РўС‹ РґРµСЂР¶РёС€СЊ СЂРёС‚Рј РїРёС‚Р°РЅРёСЏ", text: "РҐРѕСЂРѕС€РёР№ Р·РЅР°Рє. РћСЃРѕР±РµРЅРЅРѕ РІР°Р¶РЅРѕ Р·Р°СЂР°РЅРµРµ РїРѕРґС…РІР°С‚РёС‚СЊ СѓСЃС‚Р°Р»РѕСЃС‚СЊ Рё СЃС‚СЂРµСЃСЃ, С‡С‚РѕР±С‹ РЅРµ СѓР№С‚Рё РІ РµРґСѓ РЅР° Р°РІС‚РѕРјР°С‚Рµ." },
      mid: { badge: "РІРЅРёРјР°РЅРёРµ Рє С‚СЂРёРіРіРµСЂСѓ", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " СЌРї.", text: "Р­С‚Рѕ РµС‰С‘ РЅРµ РїРѕС‚РµСЂСЏРЅРЅС‹Р№ РґРµРЅСЊ. РџРѕРјРѕРіР°РµС‚ Р·Р°СЂР°РЅРµРµ Р·Р°РєСЂС‹С‚СЊ СЃР»РµРґСѓСЋС‰РµРµ РѕРєРЅРѕ СЂРёСЃРєР°: СЃС‚СЂРµСЃСЃ, СѓСЃС‚Р°Р»РѕСЃС‚СЊ РёР»Рё РґРѕРµРґР°РЅРёРµ РїРѕСЃР»Рµ РµРґС‹." },
      high: { badge: "С‚СЏР¶С‘Р»С‹Р№ РґРµРЅСЊ", title: "РЎРµРіРѕРґРЅСЏ Р±С‹Р»Рѕ РјРЅРѕРіРѕ РЅР°РїСЂСЏР¶РµРЅРёСЏ", text: "РЎРµР№С‡Р°СЃ РІР°Р¶РЅРµРµ РјСЏРіРєРѕ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РѕРїРѕСЂСѓ: РІРѕРґР°, РїР°СѓР·Р°, РїРѕРЅСЏС‚РЅС‹Р№ СЃР»РµРґСѓСЋС‰РёР№ РїСЂРёС‘Рј РїРёС‰Рё Рё С‡СѓС‚СЊ РјРµРЅСЊС€Рµ СЃР°РјРѕРєСЂРёС‚РёРєРё." }
    },
    custom: {
      zero: { badge: "СЃРїРѕРєРѕР№РЅС‹Р№ РґРµРЅСЊ", title: "РЎРµРіРѕРґРЅСЏ РїРѕРєР° РЅРѕР»СЊ", text: "РЎРёР»СЊРЅРѕРµ РЅР°С‡Р°Р»Рѕ РґРЅСЏ. Р­С‚Рѕ СѓР¶Рµ РЅРѕРІР°СЏ РѕРїРѕСЂР°." },
      low: { badge: "РґРµРЅСЊ РїРѕРґ РєРѕРЅС‚СЂРѕР»РµРј", title: "РћС‚Р»РёС‡РЅРѕ РґРµСЂР¶РёС€СЊСЃСЏ", text: "РўС‹ РІ Р·РѕРЅРµ РєРѕРЅС‚СЂРѕР»СЏ. Р•С‰С‘ РЅРµРјРЅРѕРіРѕ, Рё РґРµРЅСЊ Р±СѓРґРµС‚ Р·Р°РјРµС‚РЅРѕ Р»РµРіС‡Рµ." },
      mid: { badge: "РёРґС‘С‚ СЃРЅРёР¶РµРЅРёРµ", title: "РЎРµРіРѕРґРЅСЏ СѓР¶Рµ " + todayCount + " СЌРї.", text: "РўС‹ РІСЃС‘ РµС‰С‘ РІРЅСѓС‚СЂРё СѓРїСЂР°РІР»СЏРµРјРѕРіРѕ РґРёР°РїР°Р·РѕРЅР°. РљР°Р¶РґС‹Р№ СѓРґРµСЂР¶Р°РЅРЅС‹Р№ РјРѕРјРµРЅС‚ РёРјРµРµС‚ Р·РЅР°С‡РµРЅРёРµ." },
      high: { badge: "РЅР°РїСЂСЏР¶С‘РЅРЅС‹Р№ РґРµРЅСЊ", title: "РЎР»РѕР¶РЅС‹Р№ РґРµРЅСЊ, Рё СЌС‚Рѕ РЅРѕСЂРјР°Р»СЊРЅРѕ", text: "РќРµ СЃСѓРґРё СЃРµР±СЏ. Р“Р»Р°РІРЅРѕРµ вЂ” СЃР»РµРґСѓСЋС‰РёР№ С€Р°Рі, Р° РЅРµ РёРґРµР°Р»СЊРЅРѕСЃС‚СЊ." }
    }
  };

  var map = maps[habitId] || maps.custom;
  return map[stage];
}

function getHabitDemoEvents(habitId) {
  var maps = {
    smoking: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РЅР°РїСЂСЏР¶РµРЅРёРµ РїРѕСЃР»Рµ Р·Р°РґР°С‡Рё" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїР°СѓР·Р° Рё РїСЂРёРІС‹С‡РєР° СЂСѓРє" },
        { triggerTag: "after_food", triggerTags: ["after_food", "ritual"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїРѕСЃР»Рµ РµРґС‹" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СѓСЃС‚Р°Р»РѕСЃС‚СЊ Рє РІРµС‡РµСЂСѓ" }
      ],
      resisted: { triggerTags: ["stress", "after_food"], cravingLevel: 3, copingTool: "walk" }
    },
    alcohol: {
      slips: [
        { triggerTag: "company", triggerTags: ["company"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РєРѕРјРїР°РЅРёСЏ РїРѕСЃР»Рµ РґРЅСЏ" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· С…РѕС‚РµР»РѕСЃСЊ СЃРЅСЏС‚СЊ РЅР°РїСЂСЏР¶РµРЅРёРµ" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СѓСЃС‚Р°Р»РѕСЃС‚СЊ Рё Р¶РµР»Р°РЅРёРµ СЂР°СЃСЃР»Р°Р±РёС‚СЊСЃСЏ" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїСЂРёРІС‹С‡РЅС‹Р№ РІРµС‡РµСЂРЅРёР№ СЃС†РµРЅР°СЂРёР№" }
      ],
      resisted: { triggerTags: ["company", "stress"], cravingLevel: 4, copingTool: "sparkling_water" }
    },
    sweets: {
      slips: [
        { triggerTag: "after_food", triggerTags: ["after_food"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїРѕСЃР»Рµ РµРґС‹ Р·Р°С…РѕС‚РµР»РѕСЃСЊ СЃР»Р°РґРєРѕРіРѕ" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· С‚СЏРіР° РЅР° С„РѕРЅРµ РЅР°РїСЂСЏР¶РµРЅРёСЏ" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїСЂРѕСЃРµР»Р° СЌРЅРµСЂРіРёСЏ" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїРѕС‚СЏРЅСѓР»Рѕ РЅР° Р°РІС‚РѕРјР°С‚Рµ" }
      ],
      resisted: { triggerTags: ["after_food", "stress"], cravingLevel: 3, copingTool: "tea" }
    },
    social: {
      slips: [
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СЂСѓРєР° СЃР°РјР° РїРѕС‚СЏРЅСѓР»Р°СЃСЊ Рє Р»РµРЅС‚Рµ" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· Р·Р°Р»РёРї РЅР° С„РѕРЅРµ СѓСЃС‚Р°Р»РѕСЃС‚Рё" },
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СѓС€С‘Р» РІ СЌРєСЂР°РЅ РїРѕСЃР»Рµ РЅР°РїСЂСЏР¶РµРЅРёСЏ" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїСЂРёРІС‹С‡РЅС‹Р№ Р·Р°С…РѕРґ РїРµСЂРµРґ СЃРЅРѕРј" }
      ],
      resisted: { triggerTags: ["fatigue", "boredom"], cravingLevel: 3, copingTool: "timer" }
    },
    overeating: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· С…РѕС‚РµР»РѕСЃСЊ СЃРЅСЏС‚СЊ РЅР°РїСЂСЏР¶РµРЅРёРµ РµРґРѕР№" },
        { triggerTag: "after_food", triggerTags: ["after_food"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· Р·Р°С…РѕС‚РµР»РѕСЃСЊ РїСЂРѕРґРѕР»Р¶РёС‚СЊ РїРѕСЃР»Рµ РµРґС‹" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СѓСЃС‚Р°Р»РѕСЃС‚СЊ Рё РїСѓСЃС‚РѕС‚Р°" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РµР» РЅР° Р°РІС‚РѕРјР°С‚Рµ" }
      ],
      resisted: { triggerTags: ["stress", "fatigue"], cravingLevel: 4, copingTool: "water_pause" }
    },
    custom: {
      slips: [
        { triggerTag: "stress", triggerTags: ["stress"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РЅР°РїСЂСЏР¶РµРЅРёРµ" },
        { triggerTag: "boredom", triggerTags: ["boredom"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СЃРєСѓРєР°" },
        { triggerTag: "fatigue", triggerTags: ["fatigue"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· СѓСЃС‚Р°Р»РѕСЃС‚СЊ" },
        { triggerTag: "ritual", triggerTags: ["ritual"], note: "РўРѕР»СЊРєРѕ С‡С‚Рѕ В· РїСЂРёРІС‹С‡РЅС‹Р№ СЃС†РµРЅР°СЂРёР№" }
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
  next.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЃСЂС‹РІ";
  next.resistedLabel = "РЈРґРµСЂР¶Р°Р»СЃСЏ";
  next.slipToast = "РЎРѕР±С‹С‚РёРµ СЃРѕС…СЂР°РЅРµРЅРѕ. Р›РµРЅС‚Р° Рё Р°РЅР°Р»РёС‚РёРєР° СѓР¶Рµ РѕР±РЅРѕРІРёР»РёСЃСЊ.";
  next.successToast = "РњРѕРјРµРЅС‚ СѓРґРµСЂР¶Р°РЅРёСЏ СЃРѕС…СЂР°РЅС‘РЅ. Р­С‚Рѕ С‚РѕР¶Рµ РІР°Р¶РЅР°СЏ С‡Р°СЃС‚СЊ С‚РІРѕРµРіРѕ СЂРёС‚РјР°.";

  if (habitId === "alcohol") {
    next.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    next.resistedLabel = "РќРµ РІС‹РїРёР»";
    next.slipToast = "Р­РїРёР·РѕРґ СЃРѕС…СЂР°РЅС‘РЅ. Р›РµРЅС‚Р° Рё Р°РЅР°Р»РёС‚РёРєР° СѓР¶Рµ РїРѕРґСЃС‚СЂРѕРёР»РёСЃСЊ РїРѕРґ РЅРµРіРѕ.";
    next.successToast = "РњРѕРјРµРЅС‚, РєРѕРіРґР° С‚С‹ РЅРµ РІС‹РїРёР», СЃРѕС…СЂР°РЅС‘РЅ РєР°Рє РѕРїРѕСЂР° РЅР° Р±СѓРґСѓС‰РµРµ.";
  } else if (habitId === "sweets") {
    next.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    next.slipToast = "Р­РїРёР·РѕРґ СЃРѕС…СЂР°РЅС‘РЅ. РўРµРїРµСЂСЊ Р±СѓРґРµС‚ Р»РµРіС‡Рµ Р·Р°РјРµС‚РёС‚СЊ, С‡С‚Рѕ РёРјРµРЅРЅРѕ Р·Р°РїСѓСЃРєР°РµС‚ С‚СЏРіСѓ.";
    next.successToast = "РњРѕРјРµРЅС‚ СѓРґРµСЂР¶Р°РЅРёСЏ СЃРѕС…СЂР°РЅС‘РЅ. РћРЅ СѓСЃРёР»РёС‚ РєР°СЂС‚РёРЅСѓ СЃР°РјРѕРєРѕРЅС‚СЂРѕР»СЏ.";
  } else if (habitId === "social") {
    next.recordLabel = "РЎРѕСЂРІР°Р»СЃСЏ РІ Р»РµРЅС‚Сѓ";
    next.resistedLabel = "Р’С‹С€РµР» РІРѕРІСЂРµРјСЏ";
    next.slipToast = "Р—Р°С…РѕРґ РІ Р»РµРЅС‚Сѓ СЃРѕС…СЂР°РЅС‘РЅ. Р­С‚Рѕ РїРѕРјРѕР¶РµС‚ С‚РѕС‡РЅРµРµ СѓРІРёРґРµС‚СЊ СЃС†РµРЅР°СЂРёР№ Р°РІС‚РѕРїСЂРѕРєСЂСѓС‚РєРё.";
    next.successToast = "РњРѕРјРµРЅС‚ РІС‹С…РѕРґР° СЃРѕС…СЂР°РЅС‘РЅ. Р­С‚Рѕ С‚РѕР¶Рµ РґРІРёР¶РµРЅРёРµ РІ РЅСѓР¶РЅСѓСЋ СЃС‚РѕСЂРѕРЅСѓ.";
  } else if (habitId === "overeating") {
    next.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    next.resistedLabel = "РћСЃС‚Р°РЅРѕРІРёР»СЃСЏ РІРѕРІСЂРµРјСЏ";
    next.slipToast = "Р­РїРёР·РѕРґ СЃРѕС…СЂР°РЅС‘РЅ. РўР°Рє Р±СѓРґРµС‚ Р»РµРіС‡Рµ Р·Р°РјРµС‚РёС‚СЊ РµРіРѕ СЂРµР°Р»СЊРЅСѓСЋ РїСЂРёС‡РёРЅСѓ.";
    next.successToast = "РњРѕРјРµРЅС‚, РєРѕРіРґР° С‚С‹ РѕСЃС‚Р°РЅРѕРІРёР»СЃСЏ РІРѕРІСЂРµРјСЏ, С‚РѕР¶Рµ СЃРѕС…СЂР°РЅС‘РЅ РІ СЂРёС‚РјРµ РЅРµРґРµР»Рё.";
  } else if (habitId === "custom") {
    next.recordLabel = "Р—Р°С„РёРєСЃРёСЂРѕРІР°С‚СЊ СЌРїРёР·РѕРґ";
    next.slipToast = "Р­РїРёР·РѕРґ СЃРѕС…СЂР°РЅС‘РЅ. РћРЅ СѓР¶Рµ РїРѕРїР°Р» РІ Р»РµРЅС‚Сѓ Рё Р°РЅР°Р»РёС‚РёРєСѓ РїСЂРёРІС‹С‡РєРё.";
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
          : "РќР°С‡РЅРё СЃ РїРµСЂРІРѕР№ Р·Р°РїРёСЃРё. РћРґРЅРѕР№ РёР· РґРІСѓС… РєРЅРѕРїРѕРє РЅРёР¶Рµ СѓР¶Рµ РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ.");
      }
    });
  }
}

function renderSetupBanner(state) {
  var setup = getSetupModel(state);
  var root = document.getElementById("setup-banner");
  var hasBehaviorData = (state.slips.length + state.resisted.length + state.diaryEntries.length) > 0;
  if (!setup.nextStep || hasBehaviorData || (currentMainViewModel && currentMainViewModel.ritual && currentMainViewModel.ritual.mode === "carryover")) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("setup-banner-progress").style.width = setup.progress + "%";
  document.getElementById("setup-banner-meta").textContent = "Р“РѕС‚РѕРІРѕ " + setup.completed + " РёР· " + setup.total + " С€Р°РіРѕРІ";

  if (setup.nextStep.id === "first_event") {
    document.getElementById("setup-banner-title").textContent = "РќР°С‡РЅРё СЃ РїРµСЂРІРѕР№ Р·Р°РїРёСЃРё";
    document.getElementById("setup-banner-copy").textContent = "РћРґРёРЅ СЃСЂС‹РІ, РѕРґРЅРѕ СѓРґРµСЂР¶Р°РЅРёРµ РёР»Рё РѕРґРЅР° РјС‹СЃР»СЊ СѓР¶Рµ РґР°РґСѓС‚ РїСЂРёР»РѕР¶РµРЅРёСЋ Р¶РёРІРѕР№ СЂРёС‚Рј РґРЅСЏ.";
    document.getElementById("setup-banner-btn").textContent = "РЎРґРµР»Р°С‚СЊ Р·РґРµСЃСЊ";
  } else if (setup.nextStep.id === "assessment") {
    document.getElementById("setup-banner-title").textContent = "РЎР»РµРґРѕРј СЃС‚РѕРёС‚ РїСЂРѕР№С‚Рё РѕРїСЂРѕСЃ";
    document.getElementById("setup-banner-copy").textContent = "РџРѕСЃР»Рµ РїРµСЂРІРѕР№ Р·Р°РїРёСЃРё Р»СѓС‡С€Рµ СЃСЂР°Р·Сѓ СѓС‚РѕС‡РЅРёС‚СЊ СЃС‚Р°СЂС‚РѕРІСѓСЋ РЅР°РіСЂСѓР·РєСѓ. РЇ РѕС‚РєСЂРѕСЋ РЅСѓР¶РЅС‹Р№ С€Р°Рі РІ РїСЂРѕС„РёР»Рµ.";
    document.getElementById("setup-banner-btn").textContent = "РћС‚РєСЂС‹С‚СЊ РѕРїСЂРѕСЃ";
  } else {
    document.getElementById("setup-banner-title").textContent = "Р”РѕР±Р°РІСЊ Р»РёС‡РЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚";
    document.getElementById("setup-banner-copy").textContent = "Р¦РµРЅР° СЌРїРёР·РѕРґР°, РІСЂРµРјСЏ Рё health markers СЃРґРµР»Р°СЋС‚ Р°РЅР°Р»РёС‚РёРєСѓ Р·Р°РјРµС‚РЅРѕ РїРѕР»РµР·РЅРµРµ СѓР¶Рµ РЅР° СЌС‚РѕР№ РЅРµРґРµР»Рµ.";
    document.getElementById("setup-banner-btn").textContent = "РћС‚РєСЂС‹С‚СЊ РЅР°СЃС‚СЂРѕР№РєСѓ";
  }
}

function normalizePrimaryFlow() {
  var ritualCard = document.getElementById("ritual-card");
  var hero = document.querySelector(".hero");
  var memoryCard = document.getElementById("memory-card");
  if (ritualCard && hero && ritualCard.nextElementSibling !== hero) {
    ritualCard.insertAdjacentElement("afterend", hero);
  }
if (hero && memoryCard && hero.nextElementSibling !== memoryCard) {
  hero.insertAdjacentElement("afterend", memoryCard);
}
renderMemoryCardState();
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
  document.getElementById("first-week-kicker").textContent = "РџРµСЂРІР°СЏ РЅРµРґРµР»СЏ В· РґРµРЅСЊ " + model.dayNumber;
  document.getElementById("first-week-stage").textContent = model.stageLabel;
  document.getElementById("first-week-title").textContent = model.headline;
  document.getElementById("first-week-copy").textContent = model.narrative;
  document.getElementById("first-week-progress").style.width = model.progress + "%";
  document.getElementById("first-week-meta").textContent = model.completed + " РёР· " + model.total + " РѕРїРѕСЂ СѓР¶Рµ РµСЃС‚СЊ";
  document.getElementById("first-week-chips").innerHTML = model.milestones.map(function (item) {
    return '<div class="week-journey-chip ' + (item.done ? "done" : "") + '">' + item.shortTitle + '</div>';
  }).join("");
  document.getElementById("first-week-next").textContent = model.nextMilestone
    ? "РЎР»РµРґСѓСЋС‰Р°СЏ РјР°Р»РµРЅСЊРєР°СЏ РѕРїРѕСЂР°: " + model.nextMilestone.title + "."
    : "Р‘Р°Р·Р° РїРµСЂРІРѕР№ РЅРµРґРµР»Рё СѓР¶Рµ СЃРѕР±СЂР°РЅР°. РўРµРїРµСЂСЊ РїСЂРёР»РѕР¶РµРЅРёРµ Р±СѓРґРµС‚ РІРёРґРµС‚СЊ С‚РІРѕР№ СЂРёС‚Рј Р·Р°РјРµС‚РЅРѕ СѓРІРµСЂРµРЅРЅРµРµ.";
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
      badge: "СЃРїРѕРєРѕР№РЅС‹Р№ РґРµРЅСЊ",
      title: "РЎРµРіРѕРґРЅСЏ РјРѕР¶РЅРѕ РґРµСЂР¶Р°С‚СЊСЃСЏ Р·Р° СЂРёС‚Рј",
      text: "Р”Р°Р¶Рµ РѕРґРёРЅ С‡РµСЃС‚РЅС‹Р№ СЃРёРіРЅР°Р» СѓР¶Рµ РїРѕР»РµР·РЅРµРµ, С‡РµРј РїРѕРїС‹С‚РєР° РІСЃС‘ РєРѕРЅС‚СЂРѕР»РёСЂРѕРІР°С‚СЊ РёРґРµР°Р»СЊРЅРѕ."
    };
  }
  document.getElementById("user-name").textContent = state.profile.userName;
  document.getElementById("avatar").textContent = state.profile.initials;
  document.getElementById("hero-habit").textContent = state.currentHabit.name + " В· СЃРµРіРѕРґРЅСЏ";
  document.getElementById("count").textContent = todayCount;
  document.getElementById("hero-sub").textContent = "РѕСЂРёРµРЅС‚РёСЂ: РґРѕ " + limit + " " + state.currentHabit.unitLabel + " РІ РґРµРЅСЊ";
  document.getElementById("goal-fill").style.width = pct + "%";
  document.getElementById("goal-fill").style.background = todayCount >= limit ? "#D85A30" : "#1D9E75";
  document.getElementById("goal-label").textContent = "СЃРµРіРѕРґРЅСЏ " + todayCount + " / " + limit;
  document.getElementById("record-btn").textContent = trackerCopy.recordLabel;
  document.getElementById("resisted-btn").textContent = trackerCopy.resistedLabel;
  document.getElementById("streak-badge").textContent = trackerState.badge || "СЃРїРѕРєРѕР№РЅС‹Р№ РґРµРЅСЊ";

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

function syncRitualCarryoverUi() {
  var ritual = currentMainViewModel && currentMainViewModel.ritual;
  var feedback = document.getElementById("ritual-carryover-feedback");
  var noteWrap = document.getElementById("ritual-carryover-note-wrap");
  var noteLabel = document.getElementById("ritual-carryover-note-label");
  var noteInput = document.getElementById("ritual-carryover-note");
  document.querySelectorAll("[data-carryover-option]").forEach(function (button) {
    button.classList.toggle("active", button.dataset.carryoverOption === ritualCarryoverState.status);
  });
  if (!ritual || ritual.mode !== "carryover") {
    if (feedback) {
      feedback.textContent = "";
      feedback.classList.remove("visible");
    }
    if (noteWrap) {
      noteWrap.classList.remove("visible");
      noteWrap.style.display = "none";
    }
    return;
  }

  var status = ritualCarryoverState.status;
  var showNote = status === "partial" || status === "present";
  if (feedback) {
    feedback.textContent = status && ritual.carryoverFeedback ? (ritual.carryoverFeedback[status] || "") : "";
    feedback.classList.toggle("visible", !!status);
  }
  if (noteWrap) {
    noteWrap.classList.toggle("visible", showNote);
    noteWrap.style.display = showNote ? "block" : "none";
  }
  if (noteLabel) {
    noteLabel.textContent = status === "partial"
      ? "\u0415\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0448\u044c, \u043c\u043e\u0436\u043d\u043e \u043e\u0434\u043d\u043e\u0439 \u0444\u0440\u0430\u0437\u043e\u0439"
      : "\u0415\u0441\u043b\u0438 \u0437\u0430\u0445\u043e\u0447\u0435\u0448\u044c, \u043c\u043e\u0436\u043d\u043e \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043c\u0435\u0442\u043a\u0443";
  }
  if (noteInput) {
    noteInput.placeholder = showNote && ritual.carryoverNotePlaceholders
      ? (ritual.carryoverNotePlaceholders[status] || "")
      : "";
    if (!showNote) {
      noteInput.value = "";
      ritualCarryoverState.note = "";
    }
  }
}

function renderMain(state) {
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildMainScreenModel
    ? window.HabitScreenModels.buildMainScreenModel(state)
    : null;
  currentMainViewModel = vm;
  if (!vm || !vm.ritual || vm.ritual.mode !== "carryover") {
    ritualCarryoverState = { status: "", note: "" };
  }
  if (vm && window.HabitScreenDom && window.HabitScreenDom.applyMainScreenViewModel) {
    window.HabitScreenDom.applyMainScreenViewModel(vm);
  }
  normalizePrimaryFlow();
  renderSlipComposer(state);
  syncRitualCarryoverUi();

  renderSetupBanner(state);
  Object.keys(mainDetailState).forEach(function (cardId) {
    updateDetailCard(cardId, mainDetailState[cardId]);
  });
}

document.getElementById("record-btn").addEventListener("click", function () {
  openSlipSheet();
});

document.getElementById("resisted-btn").addEventListener("click", function () {
  var state = window.HabitStore.getState();
  var trackerCopy = polishTrackerCopy(state.currentHabit.id, getTrackerCopy(state.currentHabit.id));
  var toastCopy = this.dataset.toast || trackerCopy.successToast;
  slipComposerState = { open: false, tags: [], bodySignals: [], note: "", cravingLevel: 4 };
  window.HabitStore.recordResisted(getHabitDemoEvents(state.currentHabit.id).resisted);
  showToast(toastCopy);
});
document.getElementById("slip-sheet-close").addEventListener("click", function () {
  closeSlipSheet();
});
document.getElementById("slip-tag-row").addEventListener("click", function (event) {
  var target = event.target.closest("[data-slip-tag]");
  if (!target) return;
  var tag = target.dataset.slipTag;
  slipComposerState.tags = [tag];
  renderSlipComposer(window.HabitStore.getState());
});
document.getElementById("slip-intensity-row").addEventListener("click", function (event) {
  var target = event.target.closest("[data-slip-intensity]");
  if (!target) return;
  slipComposerState.cravingLevel = Number(target.dataset.slipIntensity) || 4;
  renderSlipComposer(window.HabitStore.getState());
});
document.getElementById("slip-note").addEventListener("input", function () {
  slipComposerState.note = this.value || "";
});
document.getElementById("slip-save-btn").addEventListener("click", function () {
  var state = window.HabitStore.getState();
  var trackerCopy = polishTrackerCopy(state.currentHabit.id, getTrackerCopy(state.currentHabit.id));
  var choices = getSlipComposeChoices(state.currentHabit.id);
  var tags = slipComposerState.tags.length ? slipComposerState.tags.slice() : (choices[0] ? [choices[0]] : ["stress"]);
  var note = String(slipComposerState.note || "").trim();
  window.HabitStore.recordSlip({
    triggerTag: tags[0],
    triggerTags: tags,
    bodySignals: [],
    cravingLevel: slipComposerState.cravingLevel || 4,
    note: note
  });
  slipComposerState = {
    open: false,
    tags: [],
    bodySignals: [],
    note: "",
    cravingLevel: 4
  };
  renderSlipComposer(window.HabitStore.getState());
  showToast(this.dataset.toast || document.getElementById("record-btn").dataset.toast || trackerCopy.slipToast);
});
document.getElementById("setup-banner-btn").addEventListener("click", function () {
  openSetupNextStep(window.HabitStore.getState());
});
document.getElementById("mission-btn").addEventListener("click", function () {
  var route = this.dataset.route || "diary";
  if (route === "main") {
    document.querySelector(".hero").scrollIntoView({ behavior: "smooth", block: "center" });
    if (this.dataset.copy) {
      showToast(this.dataset.copy);
    }
    return;
  }
  window.DemoNavigation.navigate(route);
});
document.getElementById("ritual-carryover-options").addEventListener("click", function (event) {
  var target = event.target.closest("[data-carryover-option]");
  if (!target) return;
  ritualCarryoverState.status = target.dataset.carryoverOption || "";
  syncRitualCarryoverUi();
});
document.getElementById("ritual-carryover-note").addEventListener("input", function () {
  ritualCarryoverState.note = this.value || "";
});
document.getElementById("ritual-save-btn").addEventListener("click", function () {
  var mode = this.dataset.mode || "entry";
  if (mode === "carryover") {
    if (!currentMainViewModel || !currentMainViewModel.ritual || currentMainViewModel.ritual.mode !== "carryover") {
      return;
    }
    if (!ritualCarryoverState.status) {
      showToast("\u0414\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043e\u0434\u043d\u043e\u0433\u043e \u0447\u0435\u0441\u0442\u043d\u043e\u0433\u043e \u043e\u0442\u0432\u0435\u0442\u0430.");
      return;
    }
    var noteInput = document.getElementById("ritual-carryover-note");
    var note = noteInput ? String(noteInput.value || "").trim() : "";
    window.HabitStore.saveRitualClosure({
      localDate: this.dataset.carryoverDate || currentMainViewModel.ritual.carryoverDate,
      status: ritualCarryoverState.status,
      note: note
    });
    showToast(
      currentMainViewModel.ritual.carryoverToast && currentMainViewModel.ritual.carryoverToast[ritualCarryoverState.status]
        ? currentMainViewModel.ritual.carryoverToast[ritualCarryoverState.status]
        : "\u0412\u0447\u0435\u0440\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u043e. \u0422\u0435\u043f\u0435\u0440\u044c \u043c\u043e\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0441\u0435\u0433\u043e\u0434\u043d\u044f."
    );
    ritualCarryoverState = { status: "", note: "" };
    renderMain(window.HabitStore.getState());
    return;
  }

  var input = document.getElementById("ritual-input");
  var text = (input && input.value || "").trim();
  if (!text) {
    showToast("\u041e\u0434\u043d\u043e\u0439 \u043a\u043e\u0440\u043e\u0442\u043a\u043e\u0439 \u0444\u0440\u0430\u0437\u044b \u0443\u0436\u0435 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e.");
    if (input) input.focus();
    return;
  }
  window.HabitStore.saveRitualEntry({
    type: this.dataset.type || "morning",
    text: text
  });
  showToast(this.dataset.toast || "\u041c\u044b\u0441\u043b\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430.");
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

