
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded-shell");
}
var currentPeriod = "30d";
var heatmapRoot = document.getElementById("heatmap");
var triggerBarsRoot = document.getElementById("trigger-bars");
var statRowRoot = document.getElementById("stat-row");
var statsCaption = document.getElementById("stats-caption");
var subscoreGridRoot = document.getElementById("subscore-grid");
var metaRowRoot = document.getElementById("meta-row");
var detailState = {
  "index-detail-card": false,
  "finance-detail-card": false,
  "period-detail-card": false
};

function getSetupModel(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getSetupModel) {
    return window.HabitUiFlow.getSetupModel(state);
  }
  return { completed: 0, total: 3, progress: 0, nextStep: null };
}

function openSetupNextStep(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.openSetupNextStep) {
    return window.HabitUiFlow.openSetupNextStep({
      state: state || window.HabitStore.getState(),
      firstEventRoute: "main",
      intentRoute: "profile"
    });
  }
}

function setInsightsVisibility(showAnalytics) {
  document.getElementById("summary-section-label").style.display = showAnalytics ? "" : "none";
  document.getElementById("summary-card").style.display = showAnalytics ? "" : "none";
  document.getElementById("wellbeing-section-label").style.display = "none";
  document.getElementById("wellbeing-card").style.display = "none";
  document.getElementById("stats-caption").style.display = showAnalytics ? "" : "none";
  document.getElementById("stat-row").style.display = showAnalytics ? "flex" : "none";
  document.getElementById("index-detail-card").style.display = showAnalytics ? "" : "none";
  document.getElementById("finance-detail-card").style.display = showAnalytics ? "" : "none";
  document.getElementById("period-detail-card").style.display = showAnalytics ? "" : "none";
  document.getElementById("daypattern-section-label").style.display = showAnalytics ? "" : "none";
  document.getElementById("daypattern-card").style.display = showAnalytics ? "" : "none";
}

function renderSetupCard(state, hasBehaviorData) {
  var setup = getSetupModel(state);
  var root = document.getElementById("setup-card");
  if (!setup.nextStep) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("setup-progress-fill").style.width = setup.progress + "%";
  document.getElementById("setup-meta").textContent = "Готово " + setup.completed + " из " + setup.total + " шагов";

  if (!hasBehaviorData) {
    document.getElementById("setup-title").textContent = "Инсайтам нужны первые сигналы";
    document.getElementById("setup-copy").textContent = "Когда появятся первые записи и события, приложение сможет показать окна риска, триггеры и рабочие закономерности.";
    document.getElementById("setup-btn").textContent = "Сделать первый шаг";
    return;
  }

  if (setup.nextStep.id === "assessment") {
    document.getElementById("setup-title").textContent = "Теперь уточни стартовую нагрузку";
    document.getElementById("setup-copy").textContent = "Первые сигналы уже есть. Следом опрос поможет сделать выводы точнее и спокойнее.";
    document.getElementById("setup-btn").textContent = "Открыть опрос";
  } else {
    document.getElementById("setup-title").textContent = "Добавь личный контекст";
    document.getElementById("setup-copy").textContent = "Финансы, время и health markers дадут инсайтам больше веса и связи с реальной жизнью.";
    document.getElementById("setup-btn").textContent = "Открыть настройку";
  }
}

function getFirstWeekModel(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekModel) {
    return window.HabitUiFlow.getFirstWeekModel(state);
  }
  return { active: false, completed: 0, total: 4, progress: 0 };
}

function getFirstWeekSupport(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekSupport) {
    return window.HabitUiFlow.getFirstWeekSupport(state);
  }
  return { review: null };
}

function renderFirstWeekNote(state, hasBehaviorData) {
  var model = getFirstWeekModel(state);
  var support = getFirstWeekSupport(state);
  var root = document.getElementById("first-week-note");
  if (!hasBehaviorData || !model.active) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("first-week-kicker").textContent = "Ранний период · день " + model.dayNumber;
  document.getElementById("first-week-badge").textContent = model.stageLabel;
  document.getElementById("first-week-title").textContent = model.headline;
  document.getElementById("first-week-copy").textContent = "Инсайты уже начинают собирать твой ритм. " + model.narrative;
  document.getElementById("first-week-progress").style.width = model.progress + "%";
  document.getElementById("first-week-meta").textContent = model.completed + " из " + model.total + " опор первой недели уже есть";
  if (support.review) {
    document.getElementById("first-week-review-title").textContent = support.review.headline;
    document.getElementById("first-week-review-copy").textContent = support.review.text;
  }
}

function getAdviceTimeSegmentFromHour(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function getRiskHour(model) {
  var raw = (model.summary.riskWindow || "").split(":")[0];
  return Number(raw) || 13;
}

function getInsightAdvice(model, state) {
  if (!window.HabitAdviceLibrary || !window.HabitAdviceLibrary.buildAdviceBundle) {
    return null;
  }

  var triggerTags = (model.triggers || []).slice(0, 3).map(function (item) {
    return item.key || "other";
  });

  return window.HabitAdviceLibrary.buildAdviceBundle({
    habitId: state.currentHabit.id,
    triggerTags: triggerTags,
    riskLevel: model.summary.riskLevel,
    timeSegment: getAdviceTimeSegmentFromHour(getRiskHour(model)),
    includeUnreviewed: true
  });
}

function getColor(value, maxValue) {
  if (value === 0) return getComputedStyle(document.documentElement).getPropertyValue("--heat-empty").trim() || "#f0ede8";
  var t = value / Math.max(maxValue, 1);
  if (t < 0.3) return "#9FE1CB";
  if (t < 0.6) return "#EF9F27";
  return "#D85A30";
}

function renderHeatmap(model) {
  var maxValue = Math.max.apply(null, model.heatmap.values.flat());
  heatmapRoot.innerHTML = "";
  heatmapRoot.appendChild(document.createElement("div"));
  model.heatmap.days.forEach(function (day) {
    var label = document.createElement("div");
    label.className = "hm-col-label";
    label.textContent = day;
    heatmapRoot.appendChild(label);
  });
  model.heatmap.values.forEach(function (row, rowIndex) {
    var rowLabel = document.createElement("div");
    rowLabel.className = "hm-label";
    rowLabel.textContent = model.heatmap.hours[rowIndex];
    heatmapRoot.appendChild(rowLabel);
    row.forEach(function (value, colIndex) {
      var cell = document.createElement("div");
      cell.className = "hm-cell";
      cell.style.background = getColor(value, maxValue);
      var tooltip = document.createElement("div");
      tooltip.className = "tooltip-box";
      tooltip.textContent = model.heatmap.days[colIndex] + " " + model.heatmap.hours[rowIndex] + ": " + value + " раза";
      cell.appendChild(tooltip);
      heatmapRoot.appendChild(cell);
    });
  });
}

function renderSummary(model, state) {
  var adviceBundle = getInsightAdvice(model, state);
  var primaryAdvice = adviceBundle && adviceBundle.primary ? adviceBundle.primary.advice : null;
  var recommendationNode = document.getElementById("summary-recommendation");
  var recommendationCard = recommendationNode.closest(".ic-highlight");
  document.getElementById("summary-title").textContent = model.summary.headline;
  document.getElementById("summary-badge").textContent = model.summary.badge;
  document.getElementById("summary-badge").style.background = "#FAEEDA";
  document.getElementById("summary-badge").style.color = "#633806";
  document.getElementById("summary-text").textContent = model.summary.narrative;
  recommendationNode.textContent = [
    primaryAdvice ? primaryAdvice.body : "",
    model.summary.forecastText ? "Прогноз: " + model.summary.forecastText : "",
    model.summary.confidenceText ? "Уверенность: " + model.summary.confidenceText : ""
  ].filter(Boolean).join(" ");
  recommendationCard.style.display = recommendationNode.textContent ? "" : "none";
}

function renderWellbeing(model) {
  var insight = model.wellbeing && model.wellbeing.insight;
  var trend = model.wellbeing && model.wellbeing.trend;
  var section = document.getElementById("wellbeing-section-label");
  var card = document.getElementById("wellbeing-card");
  if (!insight) {
    section.style.display = "none";
    card.style.display = "none";
    return;
  }
  section.style.display = "";
  card.style.display = "";
  document.getElementById("wellbeing-title").textContent = insight.title;
  document.getElementById("wellbeing-badge").textContent = insight.badge;
  document.getElementById("wellbeing-badge").style.background = insight.badgeBg;
  document.getElementById("wellbeing-badge").style.color = insight.badgeColor;
  document.getElementById("wellbeing-text").textContent = insight.text;
  document.getElementById("wellbeing-trend").textContent = trend ? trend.text : "";
  document.getElementById("wellbeing-trend").style.display = trend ? "" : "none";
  document.getElementById("wellbeing-highlight").textContent = insight.highlight;
}

function renderTriggers(model) {
  triggerBarsRoot.innerHTML = model.triggers.map(function (item) {
    return '<div class="tbar-row"><div class="tbar-label">' + item.label + '</div><div class="tbar-track"><div class="tbar-fill" style="width:' + Math.round(item.share * 100) + '%;background:' + item.color + ';"></div></div><div class="tbar-val">' + item.count + '</div></div>';
  }).join("");
}

function getSubscoreItems(model) {
  var subscores = model.summary.subscores || {};
  return [
    {
      key: "craving",
      label: "Тяга",
      value: subscores.cravingScore || 0,
      color: "#D85A30",
      text: "Как часто и насколько сильно сейчас поднимается тяга."
    },
    {
      key: "automaticity",
      label: "Автоматизм",
      value: subscores.automaticityScore || 0,
      color: "#0C447C",
      text: "Насколько привычка срабатывает по одному и тому же сценарию."
    },
    {
      key: "control",
      label: "Контроль",
      value: subscores.lossOfControlScore || 0,
      color: "#EF9F27",
      text: "Насколько трудно остановиться и не выйти за свой лимит."
    },
    {
      key: "emotional",
      label: "Эмоции",
      value: subscores.emotionalRelianceScore || 0,
      color: "#7F77DD",
      text: "Насколько сильно привычка сейчас привязана к стрессу и состоянию."
    },
    {
      key: "recovery",
      label: "Восстановление",
      value: subscores.recoveryScore || 0,
      color: "#1D9E75",
      text: "Как быстро удаётся вернуться в опору после трудных дней."
    }
  ].sort(function (left, right) {
    return right.value - left.value;
  });
}

function renderSubscores(model) {
  var items = getSubscoreItems(model);
  subscoreGridRoot.innerHTML = items.map(function (item, index) {
    return '<div class="subscore-card ' + (index === 0 ? "wide" : "") + '"><div class="subscore-head"><div class="subscore-name">' + item.label + '</div><div class="subscore-value">' + Math.round(item.value) + '</div></div><div class="subscore-track"><div class="subscore-fill" style="width:' + Math.round(item.value) + '%;background:' + item.color + ';"></div></div><div class="subscore-copy">' + item.text + (index === 0 ? ' Сейчас это самый сильный драйвер индекса.' : '') + '</div></div>';
  }).join("");
}

function updateDetailCard(cardId, open) {
  var card = document.getElementById(cardId);
  if (!card) return;
  card.classList.toggle("open", !!open);
}

function setDetailSummaries(model) {
  var topSubscore = getSubscoreItems(model)[0];
  var financialLoad = model.financialLoad || { label: "низкая", trend: { direction: "stable", delta: 0 } };
  var financeTrend = financialLoad.trend || { direction: "stable", delta: 0 };
  var financeTrendText = financeTrend.direction === "up"
    ? "растёт"
    : financeTrend.direction === "down"
      ? "снижается"
      : "стабильна";

  document.getElementById("index-detail-summary").textContent = topSubscore.label + " сейчас сильнее всего влияет на индекс: " + Math.round(topSubscore.value) + "/100.";
  document.getElementById("finance-detail-summary").textContent = "Нагрузка " + financialLoad.label + " и " + financeTrendText + "; маркеров заполнено " + ((model.health && model.health.filledCount) || 0) + "/" + ((model.health && model.health.totalCount) || 7) + ".";
  document.getElementById("period-detail-summary").textContent = "Окно риска: " + model.summary.riskWindow + ". Главный триггер: " + model.summary.mainTrigger.toLowerCase() + ".";
}

function renderStats(model) {
  statsCaption.textContent = "За " + model.daysLabel.toLowerCase();
  statRowRoot.innerHTML = model.stats.map(function (item) {
    return '<div class="stat-card"><div class="stat-num">' + item.value + '</div><div class="stat-sub">' + item.label + '</div><div class="stat-trend" style="color:' + item.trendColor + ';">' + item.trend + '</div></div>';
  }).join("");
}

function formatMoney(value, symbol) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(Number(value) || 0) + " " + (symbol || "₽");
}

function renderMeta(model) {
  var finance = model.finance || {};
  var financialLoad = model.financialLoad || { score: 0, label: "низкая", color: "#1D9E75", bg: "#E1F5EE", headline: "Финансовая нагрузка низкая", narrative: "", driver: "частота эпизодов" };
  var trend = financialLoad.trend || { direction: "stable", delta: 0, text: "Почти без изменений к прошлому периоду." };
  var health = model.health || { filledCount: 0, totalCount: 7, markers: {} };
  var markers = health.markers || {};
  var bp = markers.bloodPressureSystolic != null && markers.bloodPressureDiastolic != null
    ? String(markers.bloodPressureSystolic) + "/" + String(markers.bloodPressureDiastolic)
    : "не заполнено";
  var trendMark = trend.direction === "up" ? "↑ +" + Math.abs(Math.round(trend.delta)) : trend.direction === "down" ? "↓ -" + Math.abs(Math.round(trend.delta)) : "≈ 0";
  var healthTrendMark = health.trendDirection === "up" ? "↑" : health.trendDirection === "down" ? "↓" : health.trendDirection === "stable" ? "≈" : "•";

  metaRowRoot.innerHTML = [
    '<div class="meta-card wide"><div class="meta-title">Финансовая нагрузка</div><div class="meta-value" style="color:' + financialLoad.color + ';">' + Math.round(financialLoad.score) + ' · ' + financialLoad.label + ' ' + trendMark + '</div><div class="meta-copy">' + financialLoad.headline + '. Главный драйвер: ' + financialLoad.driver + '. ' + trend.text + ' ' + financialLoad.narrative + '</div></div>',
    '<div class="meta-card"><div class="meta-title">Расход за период</div><div class="meta-value">' + formatMoney(finance.monthSpent || finance.weekSpent || 0, finance.currencySymbol || "₽") + '</div><div class="meta-copy">Прогноз на месяц: ' + formatMoney(finance.monthProjection || 0, finance.currencySymbol || "₽") + '. Время: ' + (finance.monthHours || 0) + ' ч.</div></div>',
    '<div class="meta-card"><div class="meta-title">Health markers</div><div class="meta-value">' + health.filledCount + '/' + health.totalCount + ' ' + healthTrendMark + '</div><div class="meta-copy">Сон: ' + (markers.sleepHours != null ? markers.sleepHours + ' ч' : 'не заполнено') + '. Давление: ' + bp + '. ' + (health.trendSummary || 'Пока нет прошлого замера для сравнения.') + '</div></div>'
  ].join("");
}

function renderDayPattern(model) {
  document.getElementById("daypattern-title").textContent = model.dayPattern.title;
  document.getElementById("daypattern-badge").textContent = model.dayPattern.badge;
  document.getElementById("daypattern-badge").style.background = model.dayPattern.badgeBg;
  document.getElementById("daypattern-badge").style.color = model.dayPattern.badgeColor;
  document.getElementById("daypattern-text").textContent = model.dayPattern.text;
  document.getElementById("daypattern-highlight").textContent = model.dayPattern.highlight;
}

function render() {
  var model = window.HabitAnalytics.getInsightViewModel(currentPeriod);
  var state = window.HabitStore.getState();
  var hasBehaviorData = (state.slips.length + state.resisted.length + state.diaryEntries.length) > 0;
  document.getElementById("insights-subtitle").textContent = "Что стоит за привычкой: " + state.currentHabit.name;
  renderSetupCard(state, hasBehaviorData);
  renderFirstWeekNote(state, hasBehaviorData);
  setInsightsVisibility(hasBehaviorData);
  if (!hasBehaviorData) {
    return;
  }
  renderSummary(model, state);
  renderWellbeing(model);
  setDetailSummaries(model);
  renderSubscores(model);
  renderHeatmap(model);
  renderTriggers(model);
  renderStats(model);
  renderMeta(model);
  renderDayPattern(model);
  Object.keys(detailState).forEach(function (cardId) {
    updateDetailCard(cardId, detailState[cardId]);
  });
}

function render() {
  var state = window.HabitStore.getState();
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildInsightsScreenModel
    ? window.HabitScreenModels.buildInsightsScreenModel(state, currentPeriod)
    : null;
  var model = vm && vm.raw ? vm.raw : window.HabitAnalytics.getInsightViewModel(currentPeriod);
  var hasBehaviorData = vm ? vm.hasBehaviorData : (state.slips.length + state.resisted.length + state.diaryEntries.length) > 0;

  document.getElementById("insights-subtitle").textContent = vm ? vm.subtitle : ("Что стоит за привычкой: " + state.currentHabit.name);
  renderSetupCard(state, hasBehaviorData);
  if (vm) {
    document.getElementById("setup-meta").textContent = vm.setup.meta;
    document.getElementById("setup-title").textContent = vm.setup.title;
    document.getElementById("setup-copy").textContent = vm.setup.copy;
    document.getElementById("setup-btn").textContent = vm.setup.buttonLabel;
  }
  renderFirstWeekNote(state, hasBehaviorData);
  if (vm && vm.firstWeek.visible) {
    document.getElementById("first-week-kicker").textContent = "Ранний период · день " + vm.firstWeek.model.dayNumber;
    document.getElementById("first-week-badge").textContent = vm.firstWeek.model.stageLabel;
    document.getElementById("first-week-title").textContent = vm.firstWeek.model.headline;
    document.getElementById("first-week-copy").textContent = "Инсайты уже начинают собирать твой ритм. " + vm.firstWeek.model.narrative;
    document.getElementById("first-week-progress").style.width = vm.firstWeek.model.progress + "%";
    document.getElementById("first-week-meta").textContent = vm.firstWeek.model.completed + " из " + vm.firstWeek.model.total + " опор первой недели уже есть";
    if (vm.firstWeek.support && vm.firstWeek.support.review) {
      document.getElementById("first-week-review-title").textContent = vm.firstWeek.support.review.headline;
      document.getElementById("first-week-review-copy").textContent = vm.firstWeek.support.review.text;
    }
  }
  setInsightsVisibility(hasBehaviorData);
  if (!hasBehaviorData) {
    return;
  }
  renderSummary(model, state);
  renderWellbeing(model);
  if (vm) {
    document.getElementById("index-detail-summary").textContent = vm.detailSummaries.index;
    document.getElementById("finance-detail-summary").textContent = vm.detailSummaries.finance;
    document.getElementById("period-detail-summary").textContent = vm.detailSummaries.period;
  } else {
    setDetailSummaries(model);
  }
  renderSubscores(model);
  renderHeatmap(model);
  renderTriggers(model);
  renderStats(model);
  renderMeta(model);
  if (vm) {
    var metaCards = metaRowRoot.querySelectorAll(".meta-card");
    if (metaCards[0]) {
      metaCards[0].querySelector(".meta-copy").textContent = vm.meta.financialLoadText;
    }
    if (metaCards[1]) {
      metaCards[1].querySelector(".meta-value").textContent = vm.meta.periodSpent;
      metaCards[1].querySelector(".meta-copy").textContent = vm.meta.periodSpentCopy;
    }
    if (metaCards[2]) {
      metaCards[2].querySelector(".meta-copy").textContent = vm.meta.healthText;
    }
  }
  renderDayPattern(model);
  Object.keys(detailState).forEach(function (cardId) {
    updateDetailCard(cardId, detailState[cardId]);
  });
}

function render() {
  var state = window.HabitStore.getState();
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildInsightsScreenModel
    ? window.HabitScreenModels.buildInsightsScreenModel(state, currentPeriod)
    : null;
  var model = vm && vm.raw ? vm.raw : window.HabitAnalytics.getInsightViewModel(currentPeriod);
  var hasBehaviorData = vm ? vm.hasBehaviorData : (state.slips.length + state.resisted.length + state.diaryEntries.length) > 0;

  if (vm && window.HabitScreenDom && window.HabitScreenDom.applyInsightsScreenViewModel) {
    window.HabitScreenDom.applyInsightsScreenViewModel(vm);
  } else {
    document.getElementById("insights-subtitle").textContent = "Что стоит за привычкой: " + state.currentHabit.name;
  }
  renderSetupCard(state, hasBehaviorData);
  renderFirstWeekNote(state, hasBehaviorData);
  setInsightsVisibility(hasBehaviorData);
  if (!hasBehaviorData) {
    return;
  }
  renderSummary(model, state);
  renderWellbeing(model);
  if (!vm) {
    setDetailSummaries(model);
  }
  renderSubscores(model);
  renderHeatmap(model);
  renderTriggers(model);
  renderStats(model);
  renderMeta(model);
  if (vm && window.HabitScreenDom && window.HabitScreenDom.patchInsightsMeta) {
    window.HabitScreenDom.patchInsightsMeta(vm, metaRowRoot);
  }
  renderDayPattern(model);
  Object.keys(detailState).forEach(function (cardId) {
    updateDetailCard(cardId, detailState[cardId]);
  });
}

document.querySelectorAll(".pp").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll(".pp").forEach(function (item) { item.classList.remove("active"); });
    button.classList.add("active");
    currentPeriod = button.dataset.period;
    render();
  });
});

document.querySelectorAll("[data-detail-card]").forEach(function (button) {
  button.addEventListener("click", function () {
    var cardId = button.getAttribute("data-detail-card");
    detailState[cardId] = !detailState[cardId];
    updateDetailCard(cardId, detailState[cardId]);
  });
});
document.getElementById("setup-btn").addEventListener("click", function () {
  openSetupNextStep(window.HabitStore.getState());
});

window.HabitStore.subscribe(render);
window.DemoNavigation.initBottomTabs();
render();
