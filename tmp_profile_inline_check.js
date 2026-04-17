
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded-shell");
}
var selectedHabitId = null;
var selectedAssessmentAnswers = {};
var currentAiPrompt = "";
var currentGeminiSettings = { apiKey: "", model: "gemini-flash-latest", rememberKey: true };
var isGeminiPromptPreviewOpen = false;
var isManualAiExportOpen = false;
var isManualAiReviewOpen = false;
var healthMarkerKeys = [
  "sleepHours",
  "restingHeartRate",
  "bloodPressureSystolic",
  "bloodPressureDiastolic",
  "weightKg",
  "waistCm",
  "hba1c"
];
var exportSettings = {
  includeName: true,
  diaryScope: "all",
  timePrecision: "exact"
};
var profileDetailState = {
  "guidance-detail-card": false,
  "finance-detail-card": false,
  "assessment-detail-card": false,
  "export-detail-card": false,
  "ai-review-detail-card": false
};

function riskLabel(level) {
  if (level === "very_high") return "очень высокая нагрузка";
  if (level === "high") return "высокая нагрузка";
  if (level === "moderate") return "умеренная нагрузка";
  return "низкая нагрузка";
}

function getGuidanceToneOptions() {
  if (window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getGuidanceToneOptions) {
    return window.HabitStore.helpers.getGuidanceToneOptions();
  }
  return [
    { id: "supportive", label: "Поддержка", summary: "мягко и без давления" },
    { id: "calm", label: "Спокойно", summary: "ровно и без лишнего шума" },
    { id: "direct", label: "По делу", summary: "коротко и предельно конкретно" },
    { id: "energetic", label: "Энергично", summary: "больше импульса и движения" },
    { id: "light", label: "Легче", summary: "чуть живее и с мягкой лёгкостью" }
  ];
}

function formatMoney(value, symbol) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(Number(value) || 0) + " " + (symbol || "₽");
}

function formatHours(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(Number(value) || 0) + " ч";
}

function compactTrendLabel(direction) {
  if (direction === "up") return "фон тяжелее";
  if (direction === "down") return "фон мягче";
  if (direction === "stable") return "фон ровный";
  return "данных мало";
}

function compactHealthLabel(direction) {
  if (direction === "up") return "есть сдвиг";
  if (direction === "down") return "нужна опора";
  if (direction === "stable") return "без резких изменений";
  return "нет динамики";
}

function shortenHealthSummary(text) {
  var value = String(text || "").trim();
  if (!value) return "Пока нет прошлого замера для сравнения.";
  if (value.length <= 96) return value;
  return value.slice(0, 93).trim() + "...";
}

function markerText(value, suffix) {
  if (value === null || value === undefined || value === "") return "не заполнено";
  return String(value) + (suffix ? " " + suffix : "");
}

function buildSetupModel(state) {
  if (window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getSetupProgress) {
    return window.HabitStore.helpers.getSetupProgress(state);
  }
  return { steps: [], completed: 0, total: 3, progress: 0, nextStep: null };
}

function getFirstWeekModel(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekModel) {
    return window.HabitUiFlow.getFirstWeekModel(state);
  }
  return { active: false, milestones: [], completed: 0, total: 4, progress: 0 };
}

function getFirstWeekSupport(state) {
  if (window.HabitUiFlow && window.HabitUiFlow.getFirstWeekSupport) {
    return window.HabitUiFlow.getFirstWeekSupport(state);
  }
  return { review: null };
}

function openSetupNextStep() {
  if (window.HabitUiFlow && window.HabitUiFlow.openProfileSetupNextStep) {
    return window.HabitUiFlow.openProfileSetupNextStep({
      state: window.HabitStore.getState(),
      openAssessment: openAssessmentSheet,
      openContext: openFinanceHealthSheet,
      openHabit: openHabitSheet
    });
  }
}

function getCurrentHabitConfig(state) {
  if (window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getCurrentHabitConfig) {
    return window.HabitStore.helpers.getCurrentHabitConfig(state);
  }
  return (state.currentHabit && state.currentHabit.config) || state.habitConfig || window.HabitStore.helpers.getDefaultHabitConfig(state.currentHabit.id);
}

function renderHabitOptions(state) {
  var root = document.getElementById("habit-options");
  root.innerHTML = state.habits.map(function (habit) {
    var isActive = habit.id === selectedHabitId;
    var meta = habit.id === "custom"
      ? "Свой сценарий с нейтральными подписями и советами"
      : "Отдельный трек и аналитика для этой привычки";
    return '<button class="habit-option ' + (isActive ? "active" : "") + '" type="button" data-habit-id="' + habit.id + '"><div class="habit-option-name">' + habit.name + '</div><div class="habit-option-meta">' + meta + '</div></button>';
  }).join("");

  root.querySelectorAll("[data-habit-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedHabitId = button.dataset.habitId;
      renderHabitOptions(window.HabitStore.getState());
      document.getElementById("custom-habit-input").style.display = selectedHabitId === "custom" ? "block" : "none";
    });
  });
}

function openHabitSheet() {
  var state = window.HabitStore.getState();
  selectedHabitId = state.currentHabit.id;
  document.getElementById("custom-habit-input").value = state.profile.customHabitName || "";
  document.getElementById("custom-habit-input").style.display = selectedHabitId === "custom" ? "block" : "none";
  renderHabitOptions(state);
  document.getElementById("habit-screen").classList.add("open");
}

function closeHabitSheet() {
  document.getElementById("habit-screen").classList.remove("open");
}

function saveHabitSelection() {
  var customName = document.getElementById("custom-habit-input").value.trim();
  var nextHabitId = selectedHabitId || "smoking";
  if (nextHabitId === "custom" && !customName) {
    document.getElementById("custom-habit-input").focus();
    return;
  }
  window.HabitStore.selectHabit(nextHabitId, customName);
  closeHabitSheet();
  openAssessmentSheet();
}

function renderAssessmentQuestions(state) {
  var questions = window.HabitStore.helpers.getAssessmentQuestions(state.currentHabit.id);
  var root = document.getElementById("assessment-questions");
  root.innerHTML = questions.map(function (question) {
    var currentValue = typeof selectedAssessmentAnswers[question.id] === "number" ? selectedAssessmentAnswers[question.id] : null;
    return '<div class="qa-card"><div class="qa-title">' + question.title + '</div><div class="qa-options">' + question.options.map(function (option) {
      var active = currentValue === option.value ? "active" : "";
      return '<button class="qa-option ' + active + '" type="button" data-question-id="' + question.id + '" data-value="' + option.value + '">' + option.label + '</button>';
    }).join("") + '</div></div>';
  }).join("");

  root.querySelectorAll("[data-question-id]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedAssessmentAnswers[button.dataset.questionId] = Number(button.dataset.value);
      renderAssessmentQuestions(window.HabitStore.getState());
    });
  });
}

function openAssessmentSheet() {
  var state = window.HabitStore.getState();
  selectedAssessmentAnswers = state.assessment && state.assessment.answers ? JSON.parse(JSON.stringify(state.assessment.answers)) : {};
  document.getElementById("assessment-sheet-sub").textContent = "Ответы останутся внутри привычки: " + state.currentHabit.name + ". Они помогут точнее считать стартовую нагрузку.";
  renderAssessmentQuestions(state);
  document.getElementById("assessment-screen").classList.add("open");
}

function closeAssessmentSheet() {
  document.getElementById("assessment-screen").classList.remove("open");
}

function saveAssessment() {
  var state = window.HabitStore.getState();
  var questions = window.HabitStore.helpers.getAssessmentQuestions(state.currentHabit.id);
  var isComplete = questions.every(function (question) {
    return typeof selectedAssessmentAnswers[question.id] === "number";
  });
  if (!isComplete) {
    return;
  }
  window.HabitStore.saveAssessment({
    habitId: state.currentHabit.id,
    answers: selectedAssessmentAnswers
  });
  closeAssessmentSheet();
}

function openFinanceHealthSheet() {
  var state = window.HabitStore.getState();
  var config = getCurrentHabitConfig(state);
  var markers = config.healthMarkers || {};
  var habitId = state.currentHabit && state.currentHabit.id ? state.currentHabit.id : "smoking";
  var costLabel = "Расходы за раз";
  var costPlaceholder = "Если их нет — можно оставить 0";
  var minutesLabel = "Минут за раз";
  var minutesPlaceholder = "Например, 7 минут";
  var sub = "Эти настройки сохраняются отдельно для привычки: " + state.currentHabit.name + ". Здесь можно задать время, простой телесный контекст и, если это уместно, прямые расходы.";
  var note = "Это не медицинская форма и не отчёт. Если у привычки нет прямых денежных расходов, это нормально — можно оставить 0 и просто заполнить то, что тебе действительно откликается.";

  if (habitId === "smoking") {
    sub = "Это личный контекст для привычки «" + state.currentHabit.name + "»: деньги, время и самочувствие рядом с эпизодом.";
    costLabel = "Цена сигареты";
    costPlaceholder = "Например, 22 ₽";
    minutesLabel = "Минут на перекур";
    minutesPlaceholder = "Например, 7 минут";
    note = "Это не отчёт и не медформа. Просто личный контекст: сколько стоит эпизод, сколько времени он занимает и как ты себя чувствуешь рядом с ним.";
  } else if (habitId === "alcohol") {
    sub = "Эти настройки сохраняются отдельно для привычки: " + state.currentHabit.name + ". Здесь можно спокойно задать, сколько обычно обходится один эпизод с алкоголем, сколько он длится и как ты себя потом чувствуешь.";
    costLabel = "Цена эпизода";
    costPlaceholder = "Например, 350 ₽";
    minutesLabel = "Минут на эпизод";
    minutesPlaceholder = "Например, 120 минут";
    note = "Если прямые расходы бывают не всегда, это нормально — можно поставить примерную сумму или оставить 0. Важен не идеальный расчёт, а твоя реальная картина.";
  } else if (habitId === "social") {
    sub = "Эти настройки сохраняются отдельно для привычки: " + state.currentHabit.name + ". Здесь важнее время и телесный фон, а деньги — только если рядом бывают импульсивные траты.";
    costLabel = "Расходы за раз";
    costPlaceholder = "Если нет — можно оставить 0";
    minutesLabel = "Минут на заход";
    minutesPlaceholder = "Например, 25 минут";
    note = "Для телефона или соцсетей деньги часто не главное. Если прямых расходов нет, просто оставь 0 и заполни то, что помогает понять твой ритм.";
  } else if (habitId === "sweets" || habitId === "overeating") {
    sub = "Эти настройки сохраняются отдельно для привычки: " + state.currentHabit.name + ". Здесь можно увидеть не только количество эпизодов, но и сколько они обычно забирают по деньгам, времени и самочувствию.";
    if (habitId === "sweets") {
      costLabel = "Цена эпизода";
      costPlaceholder = "Например, 180 ₽";
      minutesLabel = "Минут на эпизод";
      minutesPlaceholder = "Например, 18 минут";
      note = "Здесь не нужно быть точным до рубля. Достаточно примерно понять, сколько обычно уходит на сладкое и как это отражается на теле.";
    } else {
      costLabel = "Расходы за раз";
      costPlaceholder = "Если нет — можно оставить 0";
      minutesLabel = "Минут на эпизод";
      minutesPlaceholder = "Например, 35 минут";
      note = "Для переедания деньги могут быть не главным фактором. Если прямых расходов не хочется считать, это нормально — можно оставить 0 и заполнить только время и самочувствие.";
    }
  } else if (habitId === "custom") {
    sub = "Эти настройки сохраняются отдельно для привычки: " + state.currentHabit.name + ". Здесь можно отметить только тот контекст, который реально помогает тебе понимать сценарий.";
    costLabel = "Расходы за раз";
    costPlaceholder = "Если их нет — можно оставить 0";
    minutesLabel = "Минут на эпизод";
    minutesPlaceholder = "Например, 15 минут";
    note = "Это свободный контекст под твою привычку. Не нужно заполнять всё: достаточно того, что действительно помогает видеть картину.";
  }

  document.getElementById("finance-health-sub").textContent = sub;
  document.getElementById("finance-health-note").textContent = note;
  document.getElementById("config-cost-label").textContent = costLabel;
  document.getElementById("config-minutes-label").textContent = minutesLabel;
  document.getElementById("config-cost-input").placeholder = costPlaceholder;
  document.getElementById("config-minutes-input").placeholder = minutesPlaceholder;
  document.getElementById("config-cost-input").value = config.costPerEpisode != null ? config.costPerEpisode : "";
  document.getElementById("config-minutes-input").value = config.minutesPerEpisode != null ? config.minutesPerEpisode : "";
  document.getElementById("health-sleep-input").value = markers.sleepHours != null ? markers.sleepHours : "";
  document.getElementById("health-hr-input").value = markers.restingHeartRate != null ? markers.restingHeartRate : "";
  document.getElementById("health-bp-sys-input").value = markers.bloodPressureSystolic != null ? markers.bloodPressureSystolic : "";
  document.getElementById("health-bp-dia-input").value = markers.bloodPressureDiastolic != null ? markers.bloodPressureDiastolic : "";
  document.getElementById("health-weight-input").value = markers.weightKg != null ? markers.weightKg : "";
  document.getElementById("health-waist-input").value = markers.waistCm != null ? markers.waistCm : "";
  document.getElementById("finance-health-screen").classList.add("open");
}

function closeFinanceHealthSheet() {
  document.getElementById("finance-health-screen").classList.remove("open");
}

function consumeOnboardingIntent() {
  if (window.HabitUiFlow && window.HabitUiFlow.applyProfileOnboardingIntent) {
    window.HabitUiFlow.applyProfileOnboardingIntent({
      openAssessment: openAssessmentSheet,
      openContext: openFinanceHealthSheet,
      openHabit: openHabitSheet
    });
  }
}

function saveFinanceHealth() {
  var state = window.HabitStore.getState();
  window.HabitStore.saveHabitConfig({
    habitId: state.currentHabit.id,
    costPerEpisode: document.getElementById("config-cost-input").value,
    minutesPerEpisode: document.getElementById("config-minutes-input").value,
    currencySymbol: config.currencySymbol || "₽"
  });
  window.HabitStore.saveHealthMarkers({
    habitId: state.currentHabit.id,
    markers: {
      sleepHours: document.getElementById("health-sleep-input").value,
      restingHeartRate: document.getElementById("health-hr-input").value,
      bloodPressureSystolic: document.getElementById("health-bp-sys-input").value,
      bloodPressureDiastolic: document.getElementById("health-bp-dia-input").value,
      weightKg: document.getElementById("health-weight-input").value,
      waistCm: document.getElementById("health-waist-input").value
    }
  });
  closeFinanceHealthSheet();
  setExportStatusKey("finance_saved");
}

function setExportStatus(message, tone) {
  var node = document.getElementById("export-status");
  if (window.HabitUiFeedback && window.HabitUiFeedback.applyStatus) {
    window.HabitUiFeedback.applyStatus(node, message, tone);
    return;
  }
  node.textContent = message;
  node.dataset.tone = tone || "neutral";
}

function statusMessage(key, payload) {
  if (window.HabitUiFeedback && window.HabitUiFeedback.getStatusMessage) {
    return window.HabitUiFeedback.getStatusMessage(key, payload || {});
  }
  return "";
}

function statusTone(key) {
  if (window.HabitUiFeedback && window.HabitUiFeedback.getStatusTone) {
    return window.HabitUiFeedback.getStatusTone(key);
  }
  return "neutral";
}

function setExportStatusKey(key, payload) {
  setExportStatus(statusMessage(key, payload), statusTone(key));
}

function getExportSettings() {
  return {
    includeName: !document.getElementById("privacy-hide-name").checked,
    diaryScope: exportSettings.diaryScope,
    timePrecision: exportSettings.timePrecision
  };
}

function renderExportSettings() {
  document.getElementById("privacy-hide-name").checked = !exportSettings.includeName;
  document.querySelectorAll(".privacy-option").forEach(function (button) {
    button.classList.toggle("active", exportSettings[button.dataset.setting] === button.dataset.value);
  });
}

function describeExportSettings(settings) {
  return "Приватность: имя " + (settings.includeName ? "включено" : "скрыто") + ", дневник " + (settings.diaryScope === "recent" ? "последние 10 записей" : "полный") + ", время " + (settings.timePrecision === "exact" ? "точное" : "диапазонами") + ".";
}

function buildExportFilename(prefix, extension) {
  var state = window.HabitStore.getState();
  var dateKey = window.HabitStore.helpers.formatDateKey(new Date());
  return prefix + "-" + state.currentHabit.id + "-" + dateKey + "." + extension;
}

function downloadExportJson() {
  var settings = getExportSettings();
  var bundle = window.HabitExport.buildExportBundle(settings);
  window.HabitExport.downloadFile(
    buildExportFilename("habit-export", "json"),
    JSON.stringify(bundle, null, 2),
    "application/json;charset=utf-8"
  );
  setExportStatusKey("export_json_saved");
}

function downloadExportReport() {
  var settings = getExportSettings();
  var bundle = window.HabitExport.buildExportBundle(settings);
  var report = window.HabitExport.buildMarkdownReport(bundle);
  window.HabitExport.downloadFile(
    buildExportFilename("habit-report", "md"),
    report,
    "text/markdown;charset=utf-8"
  );
  setExportStatusKey("export_report_saved");
}

function downloadStateBackup() {
  var rawState = window.HabitStore.exportRawState();
  window.HabitExport.downloadFile(
    buildExportFilename("habit-backup", "json"),
    JSON.stringify(rawState, null, 2),
    "application/json;charset=utf-8"
  );
  setExportStatusKey("backup_saved");
}

function openRestorePicker() {
  var input = document.getElementById("restore-state-input");
  input.value = "";
  input.click();
}

function restoreStateFromFile(event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function () {
    try {
      var parsed = JSON.parse(String(reader.result || "{}"));
      var result = window.HabitStore.tryReplaceState(parsed);
      if (!result.ok) {
        setExportStatusKey(result.errorCode === "invalid_backup" ? "restore_invalid_backup" : "restore_failed");
        return;
      }
      setExportStatusKey("restore_success");
    } catch (error) {
      setExportStatusKey("restore_parse_failed");
    }
  };
  reader.onerror = function () {
    setExportStatusKey("restore_read_failed");
  };
  reader.readAsText(file, "utf-8");
}

function openAiExportSheet() {
  var settings = getExportSettings();
  var bundle = window.HabitExport.buildExportBundle(settings);
  currentAiPrompt = window.HabitExport.buildAiPrompt(bundle);
  document.getElementById("ai-prompt-preview").value = currentAiPrompt;
  document.getElementById("ai-export-sheet").classList.add("open");
  setExportStatusKey("ai_prompt_ready");
}

function closeAiExportSheet() {
  document.getElementById("ai-export-sheet").classList.remove("open");
}

function copyAiPrompt() {
  if (!currentAiPrompt) {
    openAiExportSheet();
  }
  window.HabitExport.copyText(currentAiPrompt).then(function () {
    setExportStatusKey("ai_prompt_copied");
  }).catch(function () {
    setExportStatusKey("ai_prompt_copy_failed");
  });
}

function downloadAiPrompt() {
  if (!currentAiPrompt) {
    openAiExportSheet();
  }
  window.HabitExport.downloadFile(
    buildExportFilename("habit-ai-brief", "txt"),
    currentAiPrompt,
    "text/plain;charset=utf-8"
  );
  setExportStatusKey("ai_prompt_saved");
}

function setGeminiSheetStatus(message, tone) {
  var node = document.getElementById("gemini-sheet-status");
  if (!node) return;
  node.textContent = message || "";
  node.dataset.tone = tone || "neutral";
}

function renderManualAiPanels() {
  var exportPanel = document.getElementById("manual-ai-export-panel");
  var reviewPanel = document.getElementById("manual-ai-review-panel");
  var exportButton = document.getElementById("toggle-manual-ai-export-btn");
  var reviewButton = document.getElementById("toggle-manual-ai-review-btn");

  if (exportPanel) exportPanel.classList.toggle("open", !!isManualAiExportOpen);
  if (reviewPanel) reviewPanel.classList.toggle("open", !!isManualAiReviewOpen);
  if (exportButton) exportButton.textContent = isManualAiExportOpen ? "Скрыть ручной режим" : "Ручной режим";
  if (reviewButton) reviewButton.textContent = isManualAiReviewOpen ? "Скрыть ручную вставку" : "Ручная вставка";
}

function toggleManualAiExport() {
  isManualAiExportOpen = !isManualAiExportOpen;
  renderManualAiPanels();
}

function toggleManualAiReview() {
  isManualAiReviewOpen = !isManualAiReviewOpen;
  renderManualAiPanels();
}

function renderGeminiSettings(sourceSettings) {
  if (!window.HabitGemini) return;
  var saved = window.HabitGemini.readSettings();
  currentGeminiSettings = {
    apiKey: sourceSettings && typeof sourceSettings.apiKey === "string" ? sourceSettings.apiKey : saved.apiKey,
    model: sourceSettings && sourceSettings.model ? sourceSettings.model : (saved.model || "gemini-flash-latest"),
    rememberKey: sourceSettings && typeof sourceSettings.rememberKey === "boolean" ? sourceSettings.rememberKey : (saved.rememberKey !== false)
  };
  document.getElementById("gemini-api-key-input").value = currentGeminiSettings.apiKey || "";
  document.getElementById("gemini-remember-key").checked = currentGeminiSettings.rememberKey !== false;
  document.querySelectorAll("[data-gemini-model]").forEach(function (button) {
    button.classList.toggle("active", button.dataset.geminiModel === currentGeminiSettings.model);
  });
}

function renderGeminiPromptPreview() {
  var preview = document.getElementById("gemini-prompt-preview");
  var button = document.getElementById("toggle-gemini-preview-btn");
  if (!preview || !button || !window.HabitGemini || !window.HabitExport) return;

  if (!isGeminiPromptPreviewOpen) {
    preview.style.display = "none";
    button.textContent = "Показать prompt";
    return;
  }

  var bundle = window.HabitExport.buildExportBundle(getExportSettings());
  currentAiPrompt = window.HabitGemini.buildUserPrompt(bundle);
  preview.value = currentAiPrompt;
  preview.style.display = "block";
  button.textContent = "Скрыть prompt";
}

function openGeminiSheet() {
  renderGeminiSettings();
  isGeminiPromptPreviewOpen = false;
  renderGeminiPromptPreview();
  setGeminiSheetStatus("Ничего не отправится, пока ты явно не нажмёшь кнопку ниже.", "neutral");
  document.getElementById("gemini-sheet").classList.add("open");
}

function closeGeminiSheet() {
  isGeminiPromptPreviewOpen = false;
  renderGeminiPromptPreview();
  document.getElementById("gemini-sheet").classList.remove("open");
}

function toggleGeminiPromptPreview() {
  isGeminiPromptPreviewOpen = !isGeminiPromptPreviewOpen;
  renderGeminiPromptPreview();
}

function saveGeminiSettingsFromSheet() {
  if (!window.HabitGemini) return { apiKey: "", model: "gemini-flash-latest", rememberKey: true };
  var apiKey = document.getElementById("gemini-api-key-input").value.trim();
  var rememberKey = document.getElementById("gemini-remember-key").checked;
  var settings = {
    apiKey: rememberKey ? apiKey : "",
    model: currentGeminiSettings.model || "gemini-flash-latest",
    rememberKey: rememberKey
  };
  currentGeminiSettings = window.HabitGemini.writeSettings(settings);
  if (!rememberKey) {
    currentGeminiSettings.apiKey = apiKey;
  }
  return {
    apiKey: apiKey,
    model: currentGeminiSettings.model || "gemini-flash-latest",
    rememberKey: rememberKey
  };
}

function runGeminiReview() {
  if (!window.HabitGemini) return;
  var settings = saveGeminiSettingsFromSheet();
  var apiKey = String(settings.apiKey || "").trim();
  if (!apiKey) {
    setGeminiSheetStatus("Нужен API key Gemini. Его можно вставить для демо и сохранить только на этом устройстве.", "error");
    setExportStatus("Нужен API key Gemini. Его можно вставить для демо и сохранить только на этом устройстве.", "error");
    document.getElementById("gemini-api-key-input").focus();
    return;
  }

  var bundle = window.HabitExport.buildExportBundle(getExportSettings());
  currentAiPrompt = window.HabitGemini.buildUserPrompt(bundle);
  setGeminiSheetStatus("Отправляем сводку в Gemini. Это займёт несколько секунд.", "neutral");
  setExportStatus("Отправляем сводку в Gemini. Это займёт несколько секунд.", "neutral");

  window.HabitGemini.generateAnalysis(bundle, {
    apiKey: apiKey,
    model: settings.model
  }).then(function (result) {
    var state = window.HabitStore.getState();
    var review = window.HabitAiReviewStore.saveReview(state.currentHabit.id, {
      promptText: currentAiPrompt || window.HabitGemini.buildUserPrompt(bundle),
      responseText: result.reviewText
    });
    closeGeminiSheet();
    renderProfile();
    setExportStatus("Gemini-разбор сохранён. Краткий вывод и действия уже появились в профиле.", "success");
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "demo:ai-review-ready",
          text: review && review.summary ? review.summary : "Gemini-разбор уже готов и сохранён в профиле."
        }, "*");
      }
    } catch (error) {}
  }).catch(function (error) {
    var message = error && error.message
      ? "Gemini не ответил корректно: " + error.message
      : "Gemini не ответил корректно. Проверь ключ, сеть или попробуй ещё раз позже.";
    setGeminiSheetStatus(message, "error");
    setExportStatus(message, "error");
  });
}

function openAiResponseSheet() {
  document.getElementById("ai-response-sheet").classList.add("open");
  document.getElementById("ai-response-input").focus();
}

function closeAiResponseSheet() {
  document.getElementById("ai-response-sheet").classList.remove("open");
}

function openResetHabitSheet() {
  var state = window.HabitStore.getState();
  document.getElementById("reset-habit-sub").textContent = "Будут удалены события, дневник, опрос и health markers только для привычки: " + state.currentHabit.name + ". Остальные привычки останутся на месте.";
  document.getElementById("reset-habit-sheet").classList.add("open");
}

function closeResetHabitSheet() {
  document.getElementById("reset-habit-sheet").classList.remove("open");
}

function confirmResetHabitData() {
  var state = window.HabitStore.getState();
  window.HabitStore.resetActiveHabitData();
  closeResetHabitSheet();
  setExportStatusKey("reset_habit_done", { habitName: state.currentHabit.name });
}

function openAiReviewScreen() {
  window.DemoNavigation.navigate("ai-review");
}

function renderAiReview(state) {
  var review = window.HabitAiReviewStore.getLatestReview(state.currentHabit.id);
  var metaNode = document.getElementById("ai-review-meta");
  var summaryNode = document.getElementById("ai-review-summary");
  var actionsNode = document.getElementById("ai-review-actions");

  if (!review) {
    metaNode.textContent = "Разбор ещё не сохранён";
    summaryNode.textContent = "Здесь появится краткое резюме последнего ответа ИИ по этой привычке.";
    actionsNode.innerHTML = '<div class="review-empty">Пока нет сохранённых действий.</div>';
    return;
  }

  metaNode.textContent = "Последний разбор: " + window.HabitStore.helpers.todayLabel(new Date(review.createdAt));
  summaryNode.textContent = review.summary || "Ответ сохранён, но краткое резюме не выделилось автоматически.";
  actionsNode.innerHTML = (review.actionItems && review.actionItems.length
    ? review.actionItems.slice(0, 5).map(function (item) {
        return '<div class="review-item">' + item.replace(/</g, "&lt;") + '</div>';
      }).join("")
    : '<div class="review-empty">ИИ-ответ сохранён, но явные действия не нашлись. Можно перечитать исходный текст через prompt и вставить более структурированный ответ.</div>');
}

function renderGuidanceTone(state, vm) {
  var options = getGuidanceToneOptions();
  var activeId = state.profile.guidanceTone || "supportive";
  var active = options.filter(function (item) { return item.id === activeId; })[0] || options[0];
  var root = document.getElementById("guidance-tone-options");
  document.getElementById("guidance-detail-summary").textContent = active.label + " · " + active.summary;
  document.getElementById("guidance-tone-preview").textContent =
    vm && vm.details && vm.details.guidancePreview
      ? vm.details.guidancePreview
      : "Здесь будет видно, как меняется голос приложения.";

  root.innerHTML = options.map(function (item) {
    return '<button class="tone-option ' + (item.id === activeId ? 'active' : '') + '" type="button" data-guidance-tone="' + item.id + '">' +
      '<div class="tone-option-label">' + item.label + '</div>' +
      '<div class="tone-option-copy">' + item.summary + '</div>' +
      '</button>';
  }).join("");
}

function updateDetailCard(cardId, open) {
  var card = document.getElementById(cardId);
  if (!card) return;
  card.classList.toggle("open", !!open);
}

function setProfileDetailSummaries(state, analytics) {
  var finance = analytics.finance || {};
  var health = analytics.health || { filledCount: 0, totalCount: 0 };
  var review = window.HabitAiReviewStore.getLatestReview(state.currentHabit.id);

  document.getElementById("finance-detail-summary").textContent =
    "30 дней: " + formatMoney(finance.monthSpent || 0, finance.currencySymbol || "₽") +
    " · маркеров: " + (health.filledCount || 0) + "/" + (health.totalCount || healthMarkerKeys.length);

  document.getElementById("assessment-detail-summary").textContent = state.currentHabit.assessmentComplete
    ? "Заполнен: " + state.currentHabit.assessmentSummary
    : "4 коротких вопроса для стартовой точности";

  document.getElementById("export-detail-summary").textContent =
    "Имя " + (exportSettings.includeName ? "включено" : "скрыто") +
    " · " + (exportSettings.diaryScope === "recent" ? "10 записей" : "полный дневник") +
    " · " + (exportSettings.timePrecision === "exact" ? "точное время" : "диапазоны");

  document.getElementById("ai-review-detail-summary").textContent = review
    ? "Последний разбор: " + window.HabitStore.helpers.todayLabel(new Date(review.createdAt)) + " · действий: " + ((review.actionItems && review.actionItems.length) || 0)
    : "Последнего разбора пока нет";
}

function renderFinanceHealth(state, analytics) {
  if (analytics && analytics.monthSpent && analytics.monthProjection && analytics.episodeMeta) {
    document.getElementById("finance-month-spent").textContent = analytics.monthSpent;
    document.getElementById("finance-month-projection").textContent = analytics.monthProjection;
    document.getElementById("finance-month-hours").textContent = analytics.monthHours;
    document.getElementById("finance-episode-meta").textContent = analytics.episodeMeta;
    document.getElementById("health-sleep").textContent = analytics.sleep;
    document.getElementById("health-resting-hr").textContent = analytics.restingHr;
    document.getElementById("health-bp").textContent = analytics.bp;
    document.getElementById("health-body").textContent = analytics.body;
    document.getElementById("finance-health-note").textContent = analytics.note;
    return;
  }
  var config = getCurrentHabitConfig(state);
  var health = analytics.health || { markers: {}, filledCount: 0, totalCount: 0 };
  var finance = analytics.finance || {};
  var markers = health.markers || {};
  var bpReady = markers.bloodPressureSystolic != null && markers.bloodPressureDiastolic != null;

  document.getElementById("finance-month-spent").textContent = formatMoney(finance.monthSpent || 0, finance.currencySymbol || config.currencySymbol);
  document.getElementById("finance-month-projection").textContent = "Прогноз на месяц: " + formatMoney(finance.monthProjection || 0, finance.currencySymbol || config.currencySymbol);
  document.getElementById("finance-month-hours").textContent = formatHours(finance.monthHours || 0);
  document.getElementById("finance-episode-meta").textContent = formatMoney(finance.costPerEpisode || 0, finance.currencySymbol || config.currencySymbol) + " и " + (finance.minutesPerEpisode || 0) + " мин на эпизод";
  document.getElementById("health-sleep").textContent = markerText(markers.sleepHours, "ч");
  document.getElementById("health-resting-hr").textContent = markerText(markers.restingHeartRate, "уд/мин");
  document.getElementById("health-bp").textContent = bpReady ? String(markers.bloodPressureSystolic) + "/" + String(markers.bloodPressureDiastolic) : "не заполнено";
  document.getElementById("health-body").textContent = (markers.weightKg != null || markers.waistCm != null)
    ? [markers.weightKg != null ? String(markers.weightKg) + " кг" : null, markers.waistCm != null ? String(markers.waistCm) + " см" : null].filter(Boolean).join(" · ")
    : "не заполнено";
  document.getElementById("finance-health-note").textContent = health.filledCount
    ? "Заполнено " + health.filledCount + " из " + health.totalCount + " health markers. Аналитика их не диагностирует, а только хранит как личный контекст."
    : "Пока health markers пустые. Можно начать хотя бы со сна, пульса в покое и давления.";
}

function renderWeeklySnapshot(weeklyAnalytics) {
  if (weeklyAnalytics && weeklyAnalytics.behaviorValue && weeklyAnalytics.stateValue && weeklyAnalytics.healthValue) {
    document.getElementById("weekly-snapshot-sub").textContent = weeklyAnalytics.sub;
    document.getElementById("weekly-snapshot-badge").textContent = weeklyAnalytics.badge;
    document.getElementById("weekly-behavior-value").textContent = weeklyAnalytics.behaviorValue;
    document.getElementById("weekly-behavior-copy").textContent = weeklyAnalytics.behaviorCopy;
    document.getElementById("weekly-state-value").textContent = weeklyAnalytics.stateValue;
    document.getElementById("weekly-state-copy").textContent = weeklyAnalytics.stateCopy;
    document.getElementById("weekly-health-value").textContent = weeklyAnalytics.healthValue;
    document.getElementById("weekly-health-copy").textContent = weeklyAnalytics.healthCopy;
    return;
  }
  var summary = weeklyAnalytics.summary || {};
  var wellbeing = weeklyAnalytics.wellbeing || {};
  var health = weeklyAnalytics.health || {};
  var observedDays = Number(summary.observedDays) || 0;

  document.getElementById("weekly-snapshot-sub").textContent = observedDays >= 4
    ? "Самое важное за последние 7 дней одним взглядом."
    : "Неделя ещё собирает основу, но первые сигналы уже можно замечать.";
  document.getElementById("weekly-snapshot-badge").textContent = observedDays >= 4
    ? "есть ритм"
    : "ранний период";

  document.getElementById("weekly-behavior-value").textContent =
    "Индекс " + summary.dependencyIndex + " · " + riskLabel(summary.riskLevel);
  document.getElementById("weekly-behavior-copy").textContent =
    "Главный триггер: " + String(summary.mainTrigger || "Другое").toLowerCase() + ". Окно внимания: " + (summary.riskWindow || "—") + ".";

  if (wellbeing.stateEntryCount) {
    var stress = wellbeing.averages && wellbeing.averages.stress ? wellbeing.averages.stress.toFixed(1) : "0.0";
    var energy = wellbeing.averages && wellbeing.averages.energy ? wellbeing.averages.energy.toFixed(1) : "0.0";
    document.getElementById("weekly-state-value").textContent =
      "Стресс " + stress + "/5 · энергия " + energy + "/5";
    document.getElementById("weekly-state-copy").textContent =
      "Записей состояния: " + wellbeing.stateEntryCount + " · " + compactTrendLabel(wellbeing.trend && wellbeing.trend.direction) +
      (wellbeing.contextLabel ? " · чаще фон связан с \"" + wellbeing.contextLabel + "\"." : ".");
  } else {
    document.getElementById("weekly-state-value").textContent = "Данных пока мало";
    document.getElementById("weekly-state-copy").textContent = "Когда появятся записи состояния, здесь станет видно фон недели и его ритм.";
  }

  document.getElementById("weekly-health-value").textContent =
    (health.filledCount || 0) + " из " + (health.totalCount || 0) + " маркеров";
  document.getElementById("weekly-health-copy").textContent =
    compactHealthLabel(health.trendDirection) + " · " + shortenHealthSummary(health.trendSummary);
}

function renderSetup(state) {
  var setup = buildSetupModel(state);
  var card = document.getElementById("setup-card");
  var copy = document.getElementById("setup-copy");
  var list = document.getElementById("setup-list");
  var action = document.getElementById("setup-action-btn");
  var fill = document.getElementById("setup-progress-fill");

  if (setup.completed >= setup.total) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  fill.style.width = setup.progress + "%";
  copy.textContent = setup.completed === 0
    ? "Три коротких шага, чтобы приложение стало по-настоящему личным и полезным."
    : "Готово " + setup.completed + " из " + setup.total + ". Остался следующий шаг, и аналитика станет заметно точнее.";

  list.innerHTML = setup.steps.map(function (step) {
    return '<div class="setup-item"><div class="setup-mark ' + (step.done ? 'done' : 'pending') + '">' + (step.done ? '✓' : (step.id === 'first_event' ? '1' : step.id === 'assessment' ? '2' : '3')) + '</div><div class="setup-copy"><div class="setup-step-title">' + step.title + '</div><div class="setup-step-sub">' + step.sub + '</div></div></div>';
  }).join("");

  if (setup.nextStep) {
    action.style.display = "block";
    action.textContent = setup.nextStep.id === "first_event"
      ? "Сделать первую запись"
      : setup.nextStep.id === "assessment"
        ? "Пройти опрос"
        : "Добавить контекст";
  } else {
    action.style.display = "none";
  }
}

function saveAiResponse() {
  var state = window.HabitStore.getState();
  var text = document.getElementById("ai-response-input").value.trim();
  if (!text) {
    document.getElementById("ai-response-input").focus();
    return;
  }

  var review = window.HabitAiReviewStore.saveReview(state.currentHabit.id, {
    promptText: currentAiPrompt || "",
    responseText: text
  });

  document.getElementById("ai-response-input").value = "";
  closeAiResponseSheet();
  renderProfile();
  setExportStatusKey("ai_response_saved");
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "demo:ai-review-ready",
        text: review && review.summary ? review.summary : "Новый AI-разбор уже сохранён в профиле."
      }, "*");
    }
  } catch (error) {}
}

function initExportControls() {
  document.getElementById("privacy-hide-name").addEventListener("change", function (event) {
    exportSettings.includeName = !event.target.checked;
    setProfileDetailSummaries(window.HabitStore.getState(), window.HabitAnalytics.getInsightViewModel("30d"));
    setExportStatus(describeExportSettings(getExportSettings()), "neutral");
  });
  document.querySelectorAll("[data-setting]").forEach(function (button) {
    button.addEventListener("click", function () {
      exportSettings[button.dataset.setting] = button.dataset.value;
      renderExportSettings();
      setProfileDetailSummaries(window.HabitStore.getState(), window.HabitAnalytics.getInsightViewModel("30d"));
      setExportStatus(describeExportSettings(getExportSettings()), "neutral");
    });
  });

  renderExportSettings();
  setProfileDetailSummaries(window.HabitStore.getState(), window.HabitAnalytics.getInsightViewModel("30d"));
  setExportStatus(describeExportSettings(getExportSettings()), "neutral");
}

function renderProfile() {
  var state = window.HabitStore.getState();
  var analytics = window.HabitAnalytics.getInsightViewModel("30d");
  var weeklyAnalytics = window.HabitAnalytics.getInsightViewModel("7d");
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildProfileScreenModel
    ? window.HabitScreenModels.buildProfileScreenModel(state, { analytics30: analytics, analytics7: weeklyAnalytics })
    : null;

  if (vm && window.HabitScreenDom && window.HabitScreenDom.applyProfileScreenViewModel) {
    window.HabitScreenDom.applyProfileScreenViewModel(vm);
  } else {
    document.getElementById("profile-avatar").textContent = state.profile.initials;
    document.getElementById("profile-name").textContent = state.profile.userName;
    document.getElementById("profile-habit").textContent = state.currentHabit.name + " · поведенческий индекс";
    document.getElementById("profile-index").textContent = analytics.summary.dependencyIndex;
    document.getElementById("profile-index-meta").textContent = riskLabel(analytics.summary.riskLevel);
    document.getElementById("today-slips").textContent = state.slips.filter(function (item) { return item.localDate === window.HabitStore.helpers.formatDateKey(new Date()); }).length;
    document.getElementById("today-resisted").textContent = state.resisted.filter(function (item) { return item.localDate === window.HabitStore.helpers.formatDateKey(new Date()); }).length;
    document.getElementById("main-trigger").textContent = analytics.summary.mainTrigger;
    document.getElementById("risk-window").textContent = analytics.summary.riskWindow;
    document.getElementById("profile-message").textContent = analytics.summary.narrative;
  }
  document.getElementById("active-habit-name").textContent = state.currentHabit.name;
  renderGuidanceTone(state, vm);
  renderSetup(state);
  renderFirstWeek(state);
  if (!vm) {
    renderWeeklySnapshot(weeklyAnalytics);
    renderFinanceHealth(state, analytics);
  }
  if (state.currentHabit.assessmentComplete) {
    document.getElementById("assessment-copy").innerHTML = "<strong>Опрос заполнен</strong> Стартовый профиль для привычки <b>" + state.currentHabit.name + "</b>: " + state.currentHabit.assessmentSummary + ". Можешь обновить ответы в любой момент.";
    document.getElementById("assessment-btn").textContent = "Обновить";
  } else {
    document.getElementById("assessment-copy").innerHTML = "<strong>Опрос не заполнен</strong> Ответь на 4 коротких вопроса, чтобы аналитика точнее считала стартовую нагрузку для привычки <b>" + state.currentHabit.name + "</b>.";
    document.getElementById("assessment-btn").textContent = "Заполнить";
  }
  document.getElementById("active-habit-meta").textContent = "Сейчас приложение считает и анализирует только эту привычку";
  renderAiReview(state);
  setProfileDetailSummaries(state, analytics);
  Object.keys(profileDetailState).forEach(function (cardId) {
    updateDetailCard(cardId, profileDetailState[cardId]);
  });
}

function renderFirstWeek(state) {
  var model = getFirstWeekModel(state);
  var support = getFirstWeekSupport(state);
  var root = document.getElementById("first-week-card");
  if (!model.active) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("first-week-kicker").textContent = "Первая неделя · день " + model.dayNumber;
  document.getElementById("first-week-title").textContent = model.headline;
  document.getElementById("first-week-badge").textContent = model.stageLabel;
  document.getElementById("first-week-copy").textContent = model.narrative;
  document.getElementById("first-week-progress").style.width = model.progress + "%";
  document.getElementById("first-week-meta").textContent = model.completed + " из " + model.total + " опор уже есть";
  document.getElementById("first-week-chips").innerHTML = model.milestones.map(function (item) {
    return '<div class="week-chip ' + (item.done ? "done" : "") + '">' + item.shortTitle + '</div>';
  }).join("");
  if (support.review) {
    document.getElementById("first-week-review-title").textContent = support.review.headline;
    document.getElementById("first-week-review-copy").textContent = support.review.text;
    document.getElementById("first-week-review-meta").textContent = "Сигналов: " + support.review.signals + " · дней с активностью: " + support.review.days + " · удержаний: " + support.review.resisted;
  }
}

document.getElementById("change-habit-btn").addEventListener("click", openHabitSheet);
document.getElementById("setup-action-btn").addEventListener("click", openSetupNextStep);
document.getElementById("cancel-habit-btn").addEventListener("click", closeHabitSheet);
document.getElementById("close-habit-screen-btn").addEventListener("click", closeHabitSheet);
document.getElementById("save-habit-btn").addEventListener("click", saveHabitSelection);
document.getElementById("open-finance-health-btn").addEventListener("click", openFinanceHealthSheet);
document.getElementById("reset-health-hint-btn").addEventListener("click", openFinanceHealthSheet);
document.getElementById("cancel-finance-health-btn").addEventListener("click", closeFinanceHealthSheet);
document.getElementById("close-finance-health-screen-btn").addEventListener("click", closeFinanceHealthSheet);
document.getElementById("save-finance-health-btn").addEventListener("click", saveFinanceHealth);
document.getElementById("assessment-btn").addEventListener("click", openAssessmentSheet);
document.getElementById("cancel-assessment-btn").addEventListener("click", closeAssessmentSheet);
document.getElementById("close-assessment-screen-btn").addEventListener("click", closeAssessmentSheet);
document.getElementById("save-assessment-btn").addEventListener("click", saveAssessment);
document.getElementById("open-ai-response-btn").addEventListener("click", openAiResponseSheet);
document.getElementById("reopen-ai-prompt-btn").addEventListener("click", openAiExportSheet);
document.getElementById("open-ai-review-screen-btn").addEventListener("click", openAiReviewScreen);
document.getElementById("cancel-ai-response-btn").addEventListener("click", closeAiResponseSheet);
document.getElementById("save-ai-response-btn").addEventListener("click", saveAiResponse);
document.getElementById("export-json-btn").addEventListener("click", downloadExportJson);
document.getElementById("export-report-btn").addEventListener("click", downloadExportReport);
document.getElementById("toggle-manual-ai-export-btn").addEventListener("click", toggleManualAiExport);
document.getElementById("toggle-manual-ai-review-btn").addEventListener("click", toggleManualAiReview);
document.getElementById("open-ai-export-btn").addEventListener("click", openAiExportSheet);
document.getElementById("download-ai-prompt-inline-btn").addEventListener("click", downloadAiPrompt);
document.getElementById("close-ai-export-screen-btn").addEventListener("click", closeAiExportSheet);
document.getElementById("close-ai-response-screen-btn").addEventListener("click", closeAiResponseSheet);
document.getElementById("open-gemini-sheet-btn").addEventListener("click", openGeminiSheet);
document.getElementById("close-gemini-screen-btn").addEventListener("click", closeGeminiSheet);
document.getElementById("close-gemini-sheet-btn").addEventListener("click", closeGeminiSheet);
document.getElementById("toggle-gemini-preview-btn").addEventListener("click", toggleGeminiPromptPreview);
document.getElementById("run-gemini-btn").addEventListener("click", runGeminiReview);
document.getElementById("backup-state-btn").addEventListener("click", downloadStateBackup);
document.getElementById("restore-state-btn").addEventListener("click", openRestorePicker);
document.getElementById("restore-state-input").addEventListener("change", restoreStateFromFile);
document.getElementById("open-reset-habit-btn").addEventListener("click", openResetHabitSheet);
document.getElementById("cancel-reset-habit-btn").addEventListener("click", closeResetHabitSheet);
document.getElementById("close-reset-habit-screen-btn").addEventListener("click", closeResetHabitSheet);
document.getElementById("confirm-reset-habit-btn").addEventListener("click", confirmResetHabitData);
document.getElementById("copy-ai-prompt-btn").addEventListener("click", copyAiPrompt);
document.getElementById("download-ai-prompt-btn").addEventListener("click", downloadAiPrompt);
document.getElementById("close-ai-export-btn").addEventListener("click", closeAiExportSheet);
document.getElementById("guidance-tone-options").addEventListener("click", function (event) {
  var button = event.target.closest("[data-guidance-tone]");
  if (!button) return;
  window.HabitStore.setGuidanceTone(button.dataset.guidanceTone);
});
document.querySelectorAll("[data-gemini-model]").forEach(function (button) {
  button.addEventListener("click", function () {
    currentGeminiSettings.model = button.dataset.geminiModel || "gemini-flash-latest";
    renderGeminiSettings(currentGeminiSettings);
  });
});
document.querySelectorAll("[data-detail-card]").forEach(function (button) {
  button.addEventListener("click", function () {
    var cardId = button.dataset.detailCard;
    profileDetailState[cardId] = !profileDetailState[cardId];
    updateDetailCard(cardId, profileDetailState[cardId]);
  });
});

window.HabitStore.subscribe(renderProfile);
window.DemoNavigation.initBottomTabs();
initExportControls();
renderGeminiSettings();
renderManualAiPanels();
renderProfile();
consumeOnboardingIntent();

