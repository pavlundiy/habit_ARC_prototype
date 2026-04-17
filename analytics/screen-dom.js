(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = byId(id);
    if (!node) return;
    node.textContent = value == null ? "" : String(value);
  }

  function setHtml(id, value) {
    var node = byId(id);
    if (!node) return;
    node.innerHTML = value == null ? "" : String(value);
  }

  function setValue(id, value) {
    var node = byId(id);
    if (!node) return;
    node.value = value == null ? "" : String(value);
  }

  function setDisplay(id, visible, displayValue) {
    var node = byId(id);
    if (!node) return;
    node.style.display = visible ? (displayValue || "") : "none";
  }

  function setWidth(id, value) {
    var node = byId(id);
    if (!node) return;
    node.style.width = value;
  }

  function setStyle(id, key, value) {
    var node = byId(id);
    if (!node) return;
    node.style[key] = value;
  }

  function setClass(id, className, enabled) {
    var node = byId(id);
    if (!node) return;
    node.classList.toggle(className, !!enabled);
  }

  function setNodeText(selector, value) {
    var node = document.querySelector(selector);
    if (!node) return;
    node.textContent = value == null ? "" : String(value);
  }

  function setData(id, key, value) {
    var node = byId(id);
    if (!node) return;
    if (value == null || value === "") {
      delete node.dataset[key];
      return;
    }
    node.dataset[key] = String(value);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderRitualCarryoverOptions(choices) {
    return (choices || []).map(function (choice) {
      return '<button class="ritual-choice-btn" type="button" data-carryover-option="' +
        escapeHtml(choice.id) +
        '">' +
        escapeHtml(choice.label) +
        "</button>";
    }).join("");
  }

  function renderRitualEchoArcs(echo) {
    var arcs = (echo && echo.arcs) || [];
    if (!arcs.length) return "";

    function buildPath(arc) {
      var x = Number(arc.x || 0);
      var y = Number(arc.y || 0);
      var w = Number(arc.width || 0);
      var h = Number(arc.height || 0);
      var startX = x + w * 0.06;
      var startY = y + h * 0.8;
      var c1x = x + w * 0.18;
      var c1y = y + h * 0.18;
      var c2x = x + w * 0.74;
      var c2y = y + h * 0.06;
      var endX = x + w * 0.92;
      var endY = y + h * 0.56;
      return "M " + startX.toFixed(2) + " " + startY.toFixed(2) +
        " C " + c1x.toFixed(2) + " " + c1y.toFixed(2) +
        ", " + c2x.toFixed(2) + " " + c2y.toFixed(2) +
        ", " + endX.toFixed(2) + " " + endY.toFixed(2);
    }

    var paths = arcs.map(function (arc) {
      return '<path class="ritual-echo-path' +
        (arc.resonating ? ' resonating' : '') +
        '" data-tone="' + escapeHtml(arc.tone || "soft") +
        '" d="' + buildPath(arc) +
        '" style="--opacity:' + String(arc.opacity == null ? 0.18 : arc.opacity) +
        ';--rot:' + Number(arc.rotation || 0) + 'deg;"></path>';
    }).join("");

    return '<svg class="ritual-echo-svg" viewBox="0 0 320 220" preserveAspectRatio="none" aria-hidden="true">' + paths + "</svg>";
  }

  function renderRitualEchoMeta(echo) {
    if (!echo || !echo.visible || !echo.resonating || !(echo.helper || echo.label)) return "";
    return '<div class="ritual-echo-meta' +
      (echo.resonating ? ' resonating' : '') +
      '"><span class="ritual-echo-pill">' +
      escapeHtml(echo.label || "Эхо-память") +
      '</span><span class="ritual-echo-helper">' +
      escapeHtml(echo.helper || "") +
      "</span></div>";
  }

  function applyRitualPhaseDots(ritual) {
    var morning = byId("ritual-phase-morning");
    var day = byId("ritual-phase-day");
    var evening = byId("ritual-phase-evening");
    var chip = byId("ritual-phase-chip");
    if (!morning || !day || !evening || !chip) return;

    [morning, day, evening].forEach(function (dot) {
      dot.classList.remove("is-on", "is-soft");
    });

    if (!ritual) {
      chip.style.display = "none";
      return;
    }

    chip.style.display = "inline-flex";

    if (ritual.mode === "carryover") {
      morning.classList.add("is-soft");
      day.classList.add("is-soft");
      evening.classList.add("is-soft");
      return;
    }

    if (ritual.type === "morning") {
      morning.classList.add("is-on");
      return;
    }

    if (ritual.type === "evening") {
      morning.classList.add("is-soft");
      day.classList.add("is-soft");
      evening.classList.add("is-on");
      return;
    }

    morning.classList.add("is-soft");
  }

  function renderMemoryItems(items) {
    return (items || []).map(function (item) {
      return '<div class="memory-item" data-tone="' +
        escapeHtml(item.tone || "neutral") +
        '"><div class="memory-dot"></div><div class="memory-copy"><div class="memory-text">' +
        escapeHtml(item.text || "") +
        '</div><div class="memory-meta">' +
        escapeHtml(item.meta || "") +
        "</div></div></div>";
    }).join("");
  }

  function getMemoryPreview(items) {
    var first = (items || [])[0];
    if (!first) return "";
    var text = first.text || "";
    if (first.meta) {
      return text + " · " + first.meta;
    }
    return text;
  }

  function getMemoryPreview(items) {
    var first = (items || [])[0];
    if (!first) return "";
    var text = first.text || "";
    if (first.meta) {
      return text + " · " + first.meta;
    }
    return text;
  }

  function applyMainScreenViewModel(vm) {
    if (!vm) return;

    setText("user-greeting", vm.hero && vm.hero.greeting);
    setText("user-name", vm.hero && vm.hero.userName);
    setText("avatar", vm.hero && vm.hero.initials);
    setText("hero-habit", vm.hero && vm.hero.habitLabel);
    setText("count", vm.hero && vm.hero.count);
    setText("hero-sub", vm.hero && vm.hero.sub);
    setWidth("goal-fill", ((vm.hero && vm.hero.goalPct) || 0) + "%");
    setStyle("goal-fill", "background", vm.hero && vm.hero.goalColor || "");
    setText("goal-label", vm.hero && vm.hero.goalLabel);
    setStyle("hero-goal", "display", vm.hero && vm.hero.showProgress ? "flex" : "none");
    if (byId("record-btn-title")) {
      setText("record-btn-title", vm.hero && vm.hero.recordLabel);
    } else {
      setText("record-btn", vm.hero && vm.hero.recordLabel);
    }
    setText("resisted-btn", vm.hero && vm.hero.resistedLabel);
    setData("record-btn", "toast", vm.hero && vm.hero.slipToast);
    setData("resisted-btn", "toast", vm.hero && vm.hero.successToast);
    setText("streak-badge", vm.hero && vm.hero.badge);
    setNodeText("#record-btn .record-cta-sub", "\u0431\u044b\u0441\u0442\u0440\u043e \u00b7 \u0434\u0432\u0430 \u043a\u0430\u0441\u0430\u043d\u0438\u044f");
    setNodeText("#record-btn .record-cta-arrow", "\u203a");
    var moodBadge = vm.focusModeLabel ? '<span class="mood-inline-badge">' + escapeHtml(vm.focusModeLabel) + '</span>' : "";
    setHtml("mood-text", moodBadge + "<strong>" + ((vm.focus && vm.focus.title) || (vm.hero && vm.hero.moodTitle) || "") + "</strong>" + ((vm.focus && vm.focus.body) || (vm.hero && vm.hero.moodText) || ""));

    setDisplay("ritual-card", !!vm.ritual, "block");
    setText("ritual-kicker", vm.ritual && vm.ritual.kicker);
    setText("ritual-title", vm.ritual && vm.ritual.title);
    var ritualCopy = '<div class="ritual-copy-main">' + escapeHtml(vm.ritual && vm.ritual.copy || "") + "</div>";
    if (vm.ritual && vm.ritual.contextText) {
      ritualCopy += '<div class="ritual-context"><div class="ritual-context-label">' +
        escapeHtml(vm.ritual.contextLabel || "") +
        '</div><div class="ritual-context-text">' +
        escapeHtml(vm.ritual.contextText || "") +
        "</div></div>";
    }
    setHtml("ritual-copy", ritualCopy);
    setHtml("ritual-echo-layer", renderRitualEchoArcs(vm.ritual && vm.ritual.echo));
    setClass("ritual-card", "echo-active", !!(vm.ritual && vm.ritual.echo && vm.ritual.echo.visible));
    setClass("ritual-card", "echo-resonating", !!(vm.ritual && vm.ritual.echo && vm.ritual.echo.resonating));
    applyRitualPhaseDots(vm.ritual);
    setText("ritual-note", vm.ritual && vm.ritual.note);
    setText("ritual-save-btn", vm.ritual && vm.ritual.actionLabel);
    setData("ritual-save-btn", "mode", vm.ritual && vm.ritual.mode);
    setData("ritual-save-btn", "type", vm.ritual && vm.ritual.type);
    setData("ritual-save-btn", "toast", vm.ritual && vm.ritual.toast);
    setData("ritual-save-btn", "carryoverDate", vm.ritual && vm.ritual.carryoverDate);
    setValue("ritual-input", vm.ritual && vm.ritual.value);
    var ritualInput = byId("ritual-input");
    if (ritualInput) {
      ritualInput.placeholder = vm.ritual && vm.ritual.placeholder || "";
    }
    setText("ritual-carryover-note-label", "\u041e\u0434\u043d\u043e \u043d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435, \u0435\u0441\u043b\u0438 \u0445\u043e\u0447\u0435\u0442\u0441\u044f \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c");
    setDisplay("ritual-entry-block", !vm.ritual || vm.ritual.mode !== "carryover", "block");
    setDisplay("ritual-carryover-block", !!(vm.ritual && vm.ritual.mode === "carryover"), "block");
    setText("ritual-carryover-question", vm.ritual && vm.ritual.carryoverQuestion);
    setHtml("ritual-carryover-options", renderRitualCarryoverOptions(vm.ritual && vm.ritual.carryoverChoices));
    setText("ritual-carryover-feedback", "");
    setValue("ritual-carryover-note", "");
    setDisplay("ritual-carryover-note-wrap", false, "block");

    var missionVisible = !!(vm.mission && (!vm.liveEvent) && !(vm.setup && vm.setup.nextStep) && !(vm.ritual && vm.ritual.mode === "carryover"));
    setDisplay("mission-card", missionVisible, "block");
    setNodeText("#mission-card .mission-kicker", "\u041c\u0430\u043b\u0435\u043d\u044c\u043a\u0438\u0439 \u0448\u0430\u0433 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f");
    setNodeText("#mission-card .mission-chip", "\u0441\u0435\u0433\u043e\u0434\u043d\u044f");
    setText("mission-title", vm.mission && vm.mission.title);
    setText("mission-copy", vm.mission && vm.mission.body);
    setText("mission-btn", vm.mission && vm.mission.ctaLabel);
    setData("mission-btn", "route", vm.mission && vm.mission.route);
    setData("mission-btn", "copy", vm.mission && (vm.mission.body || vm.focus && vm.focus.nextStep));

    setDisplay("live-event-card", !!vm.liveEvent && !(vm.ritual && vm.ritual.mode === "carryover"), "block");
    setNodeText("#live-event-card .mission-kicker", "\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0434\u0438\u0442");
    setText("live-event-badge", vm.liveEvent && vm.liveEvent.badge);
    setText("live-event-title", vm.liveEvent && vm.liveEvent.title);
    setText("live-event-copy", vm.liveEvent && vm.liveEvent.body);
    setData("live-event-card", "tone", vm.liveEvent && vm.liveEvent.tone);

    setText("quick-money", vm.quickStats && vm.quickStats.money);
    setText("quick-money-sub", vm.quickStats && vm.quickStats.moneySub);
    setText("quick-time", vm.quickStats && vm.quickStats.time);
    setText("quick-time-sub", vm.quickStats && vm.quickStats.timeSub);
    setText("quick-health", vm.quickStats && vm.quickStats.health);
    setText("quick-health-sub", vm.quickStats && vm.quickStats.healthSub);
    setText("day-cost-summary", vm.quickStats && vm.quickStats.summary);
    setNodeText("#day-cost-card .detail-title", "\u0426\u0435\u043d\u0430 \u043f\u0440\u0438\u0432\u044b\u0447\u043a\u0438 \u0441\u0435\u0433\u043e\u0434\u043d\u044f");
    setNodeText("#week-rhythm-title", "\u0420\u0438\u0442\u043c \u043d\u0435\u0434\u0435\u043b\u0438");
    setNodeText("#tips-title", "\u041e\u043f\u043e\u0440\u0430 \u043d\u0430 \u0441\u0435\u0439\u0447\u0430\u0441");
    setNodeText("#recent-log-card .detail-title", "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0437\u0430\u043f\u0438\u0441\u0438");
    setNodeText("#tip-btn-1 .tip-label", "\u041f\u0440\u0438 \u043a\u0443\u0440\u0435\u043d\u0438\u0438");
    setNodeText("#tip-btn-2 .tip-label", "\u041f\u0440\u0438 \u0430\u043b\u043a\u043e\u0433\u043e\u043b\u0435");
    setNodeText("#tip-btn-3 .tip-label", "\u041d\u0435 \u0431\u0440\u043e\u0441\u0430\u0442\u044c");
    var quickLabels = document.querySelectorAll("#day-cost-card .quick-label");
    if (quickLabels[0]) quickLabels[0].textContent = "\u0414\u0435\u043d\u044c\u0433\u0438";
    if (quickLabels[1]) quickLabels[1].textContent = "\u0412\u0440\u0435\u043c\u044f";
    if (quickLabels[2]) quickLabels[2].textContent = "Health";

    setDisplay("memory-card", !!(vm.memory && vm.memory.items && vm.memory.items.length), "block");
    setText("memory-title", vm.memory && vm.memory.title || "\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043f\u043e\u043c\u043d\u0438\u0442");
    setText("memory-preview", vm.memory && vm.memory.preview || getMemoryPreview(vm.memory && vm.memory.items));
    setHtml("memory-list", renderMemoryItems(vm.memory && vm.memory.items));
    setText("memory-open-btn", vm.memory && vm.memory.actionLabel || "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0434\u043d\u0435\u0432\u043d\u0438\u043a");

    setDisplay("week-snapshot-card", !!(vm.layout && vm.layout.showWeekSnapshot), "block");
    setText("week-snapshot-sub", vm.weekSnapshot && vm.weekSnapshot.sub);
    setText("week-snapshot-badge", vm.weekSnapshot && vm.weekSnapshot.badge);
    setText("week-snapshot-behavior-value", vm.weekSnapshot && vm.weekSnapshot.behaviorValue);
    setText("week-snapshot-behavior-copy", vm.weekSnapshot && vm.weekSnapshot.behaviorCopy);
    setText("week-snapshot-state-value", vm.weekSnapshot && vm.weekSnapshot.stateValue);
    setText("week-snapshot-state-copy", vm.weekSnapshot && vm.weekSnapshot.stateCopy);
    setText("week-snapshot-health-value", vm.weekSnapshot && vm.weekSnapshot.healthValue);
    setText("week-snapshot-health-copy", vm.weekSnapshot && vm.weekSnapshot.healthCopy);
    setDisplay("week-rhythm-title", !!(vm.layout && vm.layout.showWeekRhythm), "block");
    setDisplay("week-row", !!(vm.layout && vm.layout.showWeekRhythm), "flex");
    setDisplay("day-cost-card", !!(vm.layout && vm.layout.showQuickStats), "block");
    setDisplay("tips-title", !!(vm.layout && vm.layout.showTips), "block");
    setDisplay("tips-row", !!(vm.layout && vm.layout.showTips), "flex");
    setDisplay("recent-log-card", !!(vm.layout && vm.layout.showRecentLog), "block");
    setDisplay("first-week-card", !!(vm.layout && vm.layout.showFirstWeek), "block");
    setDisplay("celebration-card", !!(vm.layout && vm.layout.showCelebration), "block");
  }

  function applyDiaryScreenViewModel(vm) {
    if (!vm) return;

    setText("diary-title", "\u0414\u043d\u0435\u0432\u043d\u0438\u043a");
    setText("compose-name", vm.compose && vm.compose.userName);
    setText("compose-avatar", vm.compose && vm.compose.initials);
    setText("compose-time", vm.compose && vm.compose.time);
    setText("diary-subtitle", vm.compose && vm.compose.subtitle);
    setText("diary-pill-label", "\u041c\u044b\u0441\u043b\u0438");
    setText("log-pill-label", vm.compose && vm.compose.logTabLabel);
    setText("setup-kicker", "\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0448\u0430\u0433");
    setText("compose-hint", vm.compose && vm.compose.hint);
    setText("entry-filter-summary", vm.summary && vm.summary.text);
    setText("entry-filter-all-label", "\u0412\u0441\u0435");
    setText("entry-filter-habit-label", "\u041f\u0440\u0438\u0432\u044b\u0447\u043a\u0430");
    setText("entry-filter-state-label", "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435");
    setText("mode-habit-btn", vm.compose && vm.compose.modeHabitLabel);
    setText("mode-state-btn", vm.compose && vm.compose.modeStateLabel);
    setText("habit-tags-label", vm.compose && vm.compose.habitTagsLabel);
    setText("body-signals-label", vm.compose && vm.compose.bodySignalsLabel);
    setText("save-entry-btn", vm.compose && vm.compose.saveLabel);
    setText("compose-anchor-kicker", vm.compose && vm.compose.anchorTitle);
    setText("compose-anchor-text", vm.compose && vm.compose.anchorText);
    setDisplay("habit-tags-row", !!(vm.compose && vm.compose.showHabitTags), "flex");
    setDisplay("habit-tags-label", !!(vm.compose && vm.compose.showHabitTags), "block");
    setDisplay("state-controls", !!(vm.compose && vm.compose.showStateControls), "block");
    setDisplay("compose-anchor", !!(vm.compose && vm.compose.anchorVisible), "block");
    setDisplay("starter-card", !!(vm.starter && vm.starter.visible), "block");

    var textarea = byId("compose-text");
    if (textarea) {
      textarea.placeholder = vm.compose && vm.compose.placeholder || "";
    }
  }

  function applyProfileScreenViewModel(vm) {
    if (!vm) return;

    setText("profile-avatar", vm.hero && vm.hero.initials);
    setText("profile-name", vm.hero && vm.hero.userName);
    setText("profile-habit", vm.hero && vm.hero.habitLabel);
    setText("profile-index", vm.hero && vm.hero.index);
    setText("profile-index-meta", vm.hero && vm.hero.indexMeta);

    setText("today-slips", vm.today && vm.today.slips);
    setText("today-resisted", vm.today && vm.today.resisted);
    setText("main-trigger", vm.today && vm.today.mainTrigger);
    setText("risk-window", vm.today && vm.today.riskWindow);
    setText("profile-message", vm.today && vm.today.message);

    setText("guidance-detail-summary", vm.details && vm.details.guidanceSummary);
    setText("guidance-tone-preview", vm.details && vm.details.guidancePreview);
    setText("finance-detail-summary", vm.details && vm.details.financeSummary);
    setText("assessment-detail-summary", vm.details && vm.details.assessmentSummary);
    setText("ai-review-detail-summary", vm.details && vm.details.aiReviewSummary);

    setText("weekly-snapshot-sub", vm.weeklySnapshot && vm.weeklySnapshot.sub);
    setText("weekly-snapshot-badge", vm.weeklySnapshot && vm.weeklySnapshot.badge);
    setText("weekly-behavior-value", vm.weeklySnapshot && vm.weeklySnapshot.behaviorValue);
    setText("weekly-behavior-copy", vm.weeklySnapshot && vm.weeklySnapshot.behaviorCopy);
    setText("weekly-state-value", vm.weeklySnapshot && vm.weeklySnapshot.stateValue);
    setText("weekly-state-copy", vm.weeklySnapshot && vm.weeklySnapshot.stateCopy);
    setText("weekly-health-value", vm.weeklySnapshot && vm.weeklySnapshot.healthValue);
    setText("weekly-health-copy", vm.weeklySnapshot && vm.weeklySnapshot.healthCopy);

    setText("finance-month-spent", vm.financeHealth && vm.financeHealth.monthSpent);
    setText("finance-month-projection", vm.financeHealth && vm.financeHealth.monthProjection);
    setText("finance-month-hours", vm.financeHealth && vm.financeHealth.monthHours);
    setText("finance-episode-meta", vm.financeHealth && vm.financeHealth.episodeMeta);
    setText("health-sleep", vm.financeHealth && vm.financeHealth.sleep);
    setText("health-resting-hr", vm.financeHealth && vm.financeHealth.restingHr);
    setText("health-bp", vm.financeHealth && vm.financeHealth.bp);
    setText("health-body", vm.financeHealth && vm.financeHealth.body);
    setText("finance-health-note", vm.financeHealth && vm.financeHealth.note);
  }

  function applyInsightsScreenViewModel(vm) {
    if (!vm) return;

    setText("insights-subtitle", vm.subtitle);
    setText("setup-meta", vm.setup && vm.setup.meta);
    setText("setup-title", vm.setup && vm.setup.title);
    setText("setup-copy", vm.setup && vm.setup.copy);
    setText("setup-btn", vm.setup && vm.setup.buttonLabel);

    if (vm.firstWeek && vm.firstWeek.visible) {
      setText("first-week-kicker", "\u0420\u0430\u043d\u043d\u0438\u0439 \u043f\u0435\u0440\u0438\u043e\u0434 \u00b7 \u0434\u0435\u043d\u044c " + (vm.firstWeek.model && vm.firstWeek.model.dayNumber || 1));
      setText("first-week-badge", vm.firstWeek.model && vm.firstWeek.model.stageLabel);
      setText("first-week-title", vm.firstWeek.model && vm.firstWeek.model.headline);
      setText("first-week-copy", "\u0418\u043d\u0441\u0430\u0439\u0442\u044b \u0443\u0436\u0435 \u043d\u0430\u0447\u0438\u043d\u0430\u044e\u0442 \u0441\u043e\u0431\u0438\u0440\u0430\u0442\u044c \u0442\u0432\u043e\u0439 \u0440\u0438\u0442\u043c. " + (vm.firstWeek.model && vm.firstWeek.model.narrative || ""));
      setWidth("first-week-progress", ((vm.firstWeek.model && vm.firstWeek.model.progress) || 0) + "%");
      setText(
        "first-week-meta",
        ((vm.firstWeek.model && vm.firstWeek.model.completed) || 0) + " из " + ((vm.firstWeek.model && vm.firstWeek.model.total) || 0) + " опор первой недели уже есть"
      );
      if (vm.firstWeek.support && vm.firstWeek.support.review) {
        setText("first-week-review-title", vm.firstWeek.support.review.headline);
        setText("first-week-review-copy", vm.firstWeek.support.review.text);
      }
    }

    setText("index-detail-summary", vm.detailSummaries && vm.detailSummaries.index);
    setText("finance-detail-summary", vm.detailSummaries && vm.detailSummaries.finance);
    setText("period-detail-summary", vm.detailSummaries && vm.detailSummaries.period);
  }

  function patchInsightsMeta(vm, metaRoot) {
    if (!vm || !metaRoot) return;
    var metaCards = metaRoot.querySelectorAll(".meta-card");
    if (metaCards[0]) {
      var copy0 = metaCards[0].querySelector(".meta-copy");
      if (copy0) copy0.textContent = vm.meta && vm.meta.financialLoadText || "";
    }
    if (metaCards[1]) {
      var value1 = metaCards[1].querySelector(".meta-value");
      var copy1 = metaCards[1].querySelector(".meta-copy");
      if (value1) value1.textContent = vm.meta && vm.meta.periodSpent || "";
      if (copy1) copy1.textContent = vm.meta && vm.meta.periodSpentCopy || "";
    }
    if (metaCards[2]) {
      var copy2 = metaCards[2].querySelector(".meta-copy");
      if (copy2) copy2.textContent = vm.meta && vm.meta.healthText || "";
    }
    if (metaCards[3]) {
      var value3 = metaCards[3].querySelector(".meta-value");
      var copy3 = metaCards[3].querySelector(".meta-copy");
      if (value3) value3.textContent = vm.meta && vm.meta.physicalValue || "";
      if (copy3) copy3.textContent = vm.meta && vm.meta.physicalText || "";
    }
  }

  window.HabitScreenDom = {
    applyMainScreenViewModel: applyMainScreenViewModel,
    applyDiaryScreenViewModel: applyDiaryScreenViewModel,
    applyProfileScreenViewModel: applyProfileScreenViewModel,
    applyInsightsScreenViewModel: applyInsightsScreenViewModel,
    patchInsightsMeta: patchInsightsMeta
  };
})();
