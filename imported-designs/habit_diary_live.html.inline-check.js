
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded-shell");
}
var composeMode = "habit";
var entryFilter = "all";

function switchTab(tab) {
  document.querySelectorAll(".pill").forEach(function (pill) {
    pill.classList.toggle("active", pill.dataset.tab === tab);
  });
  document.querySelectorAll(".panel").forEach(function (panel) {
    panel.classList.toggle("active", panel.id === "panel-" + tab);
  });
}

document.querySelectorAll(".pill").forEach(function (pill) {
  pill.addEventListener("click", function () { switchTab(pill.dataset.tab); });
});

document.querySelectorAll(".tag-chip").forEach(function (chip) {
  chip.addEventListener("click", function () { chip.classList.toggle("sel"); });
});

document.querySelectorAll("[data-compose-mode]").forEach(function (button) {
  button.addEventListener("click", function () {
    setComposeMode(button.getAttribute("data-compose-mode"), window.HabitStore.getState());
  });
});

document.querySelectorAll("[data-entry-filter]").forEach(function (button) {
  button.addEventListener("click", function () {
    entryFilter = button.getAttribute("data-entry-filter") || "all";
    updateEntryFilterUI();
    renderDiaryEntries(window.HabitStore.getState());
  });
});

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

function renderSetupCard(state) {
  var setup = getSetupModel(state);
  var root = document.getElementById("setup-card");
  if (!setup.nextStep) {
    root.classList.remove("open");
    return;
  }

  root.classList.add("open");
  document.getElementById("setup-progress-fill").style.width = setup.progress + "%";
  document.getElementById("setup-meta").textContent = "Готово " + setup.completed + " из " + setup.total + " шагов";

  if (setup.nextStep.id === "first_event") {
    document.getElementById("setup-title").textContent = "Начни с первой записи";
    document.getElementById("setup-copy").textContent = "Одна мысль, один срыв или одно удержание уже дадут дневнику контекст и сделают записи осмысленными.";
    document.getElementById("setup-btn").textContent = "Перейти на главную";
  } else if (setup.nextStep.id === "assessment") {
    document.getElementById("setup-title").textContent = "Теперь полезно пройти опрос";
    document.getElementById("setup-copy").textContent = "Дневник уже оживает. Следом стоит уточнить стартовую нагрузку, чтобы инсайты были точнее.";
    document.getElementById("setup-btn").textContent = "Открыть опрос";
  } else {
    document.getElementById("setup-title").textContent = "Добавь личный контекст";
    document.getElementById("setup-copy").textContent = "Цена эпизода, время и health markers помогут связать записи с реальной жизнью, а не только с эмоциями.";
    document.getElementById("setup-btn").textContent = "Открыть настройку";
  }
}

function renderCompose(state) {
  document.getElementById("compose-name").textContent = state.profile.userName;
  document.getElementById("compose-avatar").textContent = state.profile.initials;
  document.getElementById("compose-time").textContent = window.HabitStore.helpers.formatTime(new Date());
  document.getElementById("diary-subtitle").textContent = "Мысли о привычке и общее состояние: " + state.currentHabit.name;
  document.getElementById("log-pill-label").textContent = getDiaryLogCopy(state.currentHabit.id).tabLabel;
  applyComposeMode(state);
}

function getDiaryPlaceholder(habitId, habitName) {
  if (habitId === "smoking") return "Что случилось перед сигаретой? Что важно заметить?";
  if (habitId === "alcohol") return "Что подтолкнуло к алкоголю именно сейчас?";
  if (habitId === "sweets") return "Что стояло за тягой к сладкому?";
  if (habitId === "social") return "Что было перед тем, как ты снова открыл ленту?";
  if (habitId === "overeating") return "Это был голод, усталость или автоматический сценарий?";
  return "Что происходило вокруг привычки \"" + habitName + "\"?";
}

function getStatePlaceholder() {
  return "Как ты сейчас? Что сильнее всего влияет на день?";
}

function setComposeMode(mode, state) {
  composeMode = mode === "state" ? "state" : "habit";
  applyComposeMode(state || window.HabitStore.getState());
}

function applyComposeMode(state) {
  document.querySelectorAll("[data-compose-mode]").forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-compose-mode") === composeMode);
  });
  document.getElementById("habit-tags-row").style.display = composeMode === "habit" ? "flex" : "none";
  document.getElementById("state-controls").classList.toggle("open", composeMode === "state");
  document.getElementById("compose-hint").textContent = composeMode === "state"
    ? "Пара слов о сне, энергии или напряжении часто объясняют сложные дни лучше любых цифр."
    : "Достаточно 1–2 фраз: что случилось, что ты почувствовал и что хочется заметить на будущее.";
  document.getElementById("compose-text").placeholder = composeMode === "state"
    ? getStatePlaceholder()
    : getDiaryPlaceholder(state.currentHabit.id, state.currentHabit.name);
}

function renderStarterCard(state) {
  var root = document.getElementById("starter-card");
  if (!root) return;
  var summary = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getDiarySummary
    ? window.HabitStore.helpers.getDiarySummary(state)
    : { hasEntries: Array.isArray(state.diaryEntries) && state.diaryEntries.length > 0 };
  var hasEntries = !!summary.hasEntries;
  root.style.display = hasEntries ? "none" : "block";
}

function getDiaryLogCopy(habitId) {
  if (habitId === "smoking") {
    return {
      tabLabel: "Записи срывов",
      notePlaceholder: "Что произошло перед сигаретой? Почему именно сейчас?",
      noteButton: "Добавить мысль к этому моменту"
    };
  }
  if (habitId === "social") {
    return {
      tabLabel: "Записи эпизодов",
      notePlaceholder: "Что было перед этим заходом в ленту? Что можно изменить в следующий раз?",
      noteButton: "Добавить мысль к этому моменту"
    };
  }
  return {
    tabLabel: "Записи эпизодов",
    notePlaceholder: "Что происходило в этот момент? Почему именно сейчас?",
    noteButton: "Добавить мысль к этому моменту"
  };
}

function renderDiaryEntries(state) {
  var root = document.getElementById("diary-entries");
  var entries = state.diaryEntries.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  if (entryFilter !== "all") {
    entries = entries.filter(function (entry) {
      return (entry.entryScope === "state" ? "state" : "habit") === entryFilter;
    });
  }
  if (!entries.length) {
    if (entryFilter === "all" && (!state.diaryEntries || !state.diaryEntries.length)) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = '<div class="empty">' + getDiaryEmptyText(state) + '</div>';
    return;
  }

  root.innerHTML = entries.map(function (entry) {
    var date = new Date(entry.timestamp);
    var isStateEntry = entry.entryScope === "state";
    var tagHtml = "";
    if (isStateEntry) {
      tagHtml = '<div class="entry-kind state">Состояние</div>';
    } else if (entry.tag) {
      tagHtml = '<div class="de-tag" style="background:#E1F5EE;color:#085041;">' + window.HabitStore.helpers.triggerLabel(entry.tag) + '</div>';
    } else {
      tagHtml = '<div class="entry-kind">Привычка</div>';
    }
    var related = entry.relatedSlipId ? state.slips.find(function (slip) { return slip.id === entry.relatedSlipId; }) : null;
    var relatedHtml = related
      ? '<div class="de-habit-ref"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#1D9E75" stroke-width="1.2"/><path d="M6 3.5V6.5l1.5 1" stroke="#1D9E75" stroke-width="1.1" stroke-linecap="round"/></svg><div class="de-habit-label">' + state.currentHabit.name + ' · ' + window.HabitStore.helpers.formatTime(new Date(related.timestamp)) + ' ·</div><div class="de-habit-count">' + window.HabitStore.helpers.triggerLabel(related.triggerTag) + '</div></div>'
      : "";
    var stateSummary = isStateEntry
      ? '<div class="state-summary">' +
        '<div class="state-chip">настроение ' + (entry.moodScore || "—") + '/5</div>' +
        '<div class="state-chip">энергия ' + (entry.energyScore || "—") + '/5</div>' +
        '<div class="state-chip">стресс ' + (entry.stressScore || "—") + '/5</div>' +
        (entry.contextTags || []).map(function (tag) {
          return '<div class="state-chip">' + getStateTagLabel(tag) + '</div>';
        }).join("") +
      '</div>'
      : "";
    return '<div class="diary-entry"><div class="de-header"><div class="de-avatar">' + state.profile.initials + '</div><div class="de-meta"><div class="de-name">' + state.profile.userName + '</div><div class="de-time">' + window.HabitStore.helpers.todayLabel(date) + '</div></div>' + tagHtml + '</div>' + stateSummary + '<div class="de-text">' + entry.text.replace(/</g, "&lt;") + '</div>' + relatedHtml + '<div class="de-footer"><div class="de-reaction">' + (isStateEntry ? "Фон дня" : "Это честно") + '</div><div class="de-reaction">' + (isStateEntry ? "Полезно для инсайтов" : "Хорошее наблюдение") + '</div></div></div>';
  }).join("");
}

function getDiaryEmptyText(state) {
  if (entryFilter === "habit") {
    return 'Пока нет записей о привычке. Здесь будут мысли рядом с эпизодами, тягой и удержанием по привычке "' + state.currentHabit.name + '".';
  }
  if (entryFilter === "state") {
    return "Пока нет записей о состоянии. Здесь будут короткие заметки про сон, стресс, энергию и фон дня.";
  }
  return "Пока здесь тихо. Здесь можно вести и заметки о привычке, и короткие записи о состоянии дня — именно вместе они потом лучше объясняют паттерн.";
}

function updateEntryFilterUI() {
  document.querySelectorAll("[data-entry-filter]").forEach(function (button) {
    button.classList.toggle("active", button.getAttribute("data-entry-filter") === entryFilter);
  });
}

function renderEntrySummary(state) {
  var habitCount = state.diaryEntries.filter(function (entry) {
    return entry.entryScope !== "state";
  }).length;
  var stateCount = state.diaryEntries.filter(function (entry) {
    return entry.entryScope === "state";
  }).length;
  document.getElementById("entry-filter-summary").textContent =
    "О привычке: " + habitCount + " · Состояние: " + stateCount + " · Всего: " + state.diaryEntries.length;
}

function getStateTagLabel(tag) {
  var labels = {
    sleep: "сон",
    work: "работа",
    conflict: "конфликт",
    loneliness: "одиночество",
    fatigue: "усталость",
    calm: "спокойно"
  };
  return labels[tag] || tag;
}

function renderEntrySummary(state) {
  var summary = window.HabitStore && window.HabitStore.helpers && window.HabitStore.helpers.getDiarySummary
    ? window.HabitStore.helpers.getDiarySummary(state)
    : {
        habitCount: state.diaryEntries.filter(function (entry) {
          return entry.entryScope !== "state";
        }).length,
        stateCount: state.diaryEntries.filter(function (entry) {
          return entry.entryScope === "state";
        }).length,
        totalCount: state.diaryEntries.length
      };
  document.getElementById("entry-filter-summary").textContent =
    "О привычке: " + (summary.habitCount || 0) + " · Состояние: " + (summary.stateCount || 0) + " · Всего: " + (summary.totalCount || 0);
}

function renderSlipLog(state) {
  var root = document.getElementById("log-entries");
  var slips = state.slips.slice().sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); }).slice(0, 12);
  var logCopy = getDiaryLogCopy(state.currentHabit.id);
  if (!slips.length) {
    root.innerHTML = '<div class="empty">Записей эпизодов пока нет. Когда появится первый срыв или первый зафиксированный момент, здесь можно будет добавить мысль именно к нему.</div>';
    return;
  }
  root.innerHTML = slips.map(function (slip) {
    var noteBlock = slip.slipNote
      ? '<div class="log-note-saved">✓ Сохранено: «' + slip.slipNote.replace(/</g, "&lt;") + '»</div>'
      : '';
    return '<div class="log-item" data-slip-id="' + slip.id + '"><div class="log-row"><div class="log-dot" style="background:' + window.HabitStore.helpers.triggerColor(slip.triggerTag) + ';"></div><div class="log-text">' + window.HabitStore.helpers.triggerLabel(slip.triggerTag) + ' · ' + (slip.note || "Без комментария") + '</div><div class="log-time">' + window.HabitStore.helpers.formatTime(new Date(slip.timestamp)) + '</div></div><div class="log-note-btn" data-default-label="' + logCopy.noteButton + '" onclick="toggleNote(this)">' + logCopy.noteButton + '</div><div class="log-note-area"><textarea class="log-note-input" rows="3" placeholder="' + logCopy.notePlaceholder + '"></textarea><button class="log-note-save" onclick="saveNote(this)">Сохранить</button></div>' + noteBlock + '</div>';
  }).join("");
}

function saveEntry() {
  var input = document.getElementById("compose-text");
  var text = input.value.trim();
  if (!text) return;
  if (composeMode === "state") {
    window.HabitStore.addDiaryEntry({
      entryType: "state_note",
      entryScope: "state",
      text: text,
      contextTags: Array.prototype.slice.call(document.querySelectorAll(".state-tag-chip.sel")).map(function (chip) {
        return chip.dataset.stateTag;
      }),
      moodScore: document.getElementById("state-mood").value,
      energyScore: document.getElementById("state-energy").value,
      stressScore: document.getElementById("state-stress").value
    });
  } else {
    var selectedTags = Array.prototype.slice.call(document.querySelectorAll("#habit-tags-row .tag-chip.sel")).map(function (chip) {
      return chip.dataset.tag;
    });
    window.HabitStore.addDiaryEntry({
      entryType: "free_note",
      entryScope: "habit",
      text: text,
      tag: selectedTags[0] || null,
      triggerTags: selectedTags
    });
  }
  input.value = "";
  document.querySelectorAll(".tag-chip.sel").forEach(function (chip) { chip.classList.remove("sel"); });
  document.getElementById("state-mood").value = "3";
  document.getElementById("state-energy").value = "3";
  document.getElementById("state-stress").value = "3";
}

function toggleNote(btn) {
  var area = btn.nextElementSibling;
  area.classList.toggle("open");
  btn.textContent = area.classList.contains("open") ? "Скрыть" : btn.dataset.defaultLabel;
}

function saveNote(btn) {
  var item = btn.closest(".log-item");
  var input = item.querySelector(".log-note-input");
  var text = input.value.trim();
  if (!text) return;
  window.HabitStore.addSlipNote(item.dataset.slipId, text);
}

function renderSlipLog(state) {
  var root = document.getElementById("log-entries");
  var slips = state.slips.slice().sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); }).slice(0, 12);
  var logCopy = getDiaryLogCopy(state.currentHabit.id);
  if (!slips.length) {
    root.innerHTML = '<div class="empty">Р—Р°РїРёСЃРµР№ СЌРїРёР·РѕРґРѕРІ РїРѕРєР° РЅРµС‚. РљРѕРіРґР° РїРѕСЏРІРёС‚СЃСЏ РїРµСЂРІС‹Р№ СЃСЂС‹РІ РёР»Рё РїРµСЂРІС‹Р№ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Р№ РјРѕРјРµРЅС‚, Р·РґРµСЃСЊ РјРѕР¶РЅРѕ Р±СѓРґРµС‚ РґРѕР±Р°РІРёС‚СЊ РјС‹СЃР»СЊ РёРјРµРЅРЅРѕ Рє РЅРµРјСѓ.</div>';
    return;
  }
  root.innerHTML = slips.map(function (slip) {
    var noteBlock = slip.slipNote
      ? '<div class="log-note-saved">вњ“ РЎРѕС…СЂР°РЅРµРЅРѕ: В«' + slip.slipNote.replace(/</g, "&lt;") + 'В»</div>'
      : '';
    return '<div class="log-item" data-slip-id="' + slip.id + '"><div class="log-row"><div class="log-dot" style="background:' + window.HabitStore.helpers.triggerColor(slip.triggerTag) + ';"></div><div class="log-text">' + window.HabitStore.helpers.triggerLabel(slip.triggerTag) + ' В· ' + (slip.note || "Р‘РµР· РєРѕРјРјРµРЅС‚Р°СЂРёСЏ") + '</div><div class="log-time">' + window.HabitStore.helpers.formatTime(new Date(slip.timestamp)) + '</div></div><button class="log-note-btn" type="button" data-default-label="' + logCopy.noteButton + '" data-action="toggle-slip-note">' + logCopy.noteButton + '</button><div class="log-note-area"><textarea class="log-note-input" rows="3" placeholder="' + logCopy.notePlaceholder + '"></textarea><button class="log-note-save" type="button" data-action="save-slip-note">РЎРѕС…СЂР°РЅРёС‚СЊ</button></div>' + noteBlock + '</div>';
  }).join("");
}

document.getElementById("log-entries").addEventListener("click", function (event) {
  var toggleButton = event.target.closest('[data-action="toggle-slip-note"]');
  if (toggleButton) {
    toggleNote(toggleButton);
    return;
  }

  var saveButton = event.target.closest('[data-action="save-slip-note"]');
  if (saveButton) {
    saveNote(saveButton);
  }
});

function render(state) {
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildDiaryScreenModel
    ? window.HabitScreenModels.buildDiaryScreenModel(state, { composeMode: composeMode, entryFilter: entryFilter })
    : null;
  updateEntryFilterUI();
  if (vm) {
    document.getElementById("compose-name").textContent = vm.compose.userName;
    document.getElementById("compose-avatar").textContent = vm.compose.initials;
    document.getElementById("compose-time").textContent = vm.compose.time;
    document.getElementById("diary-subtitle").textContent = vm.compose.subtitle;
    document.getElementById("log-pill-label").textContent = vm.compose.logTabLabel;
    document.getElementById("compose-hint").textContent = vm.compose.hint;
    document.getElementById("compose-text").placeholder = vm.compose.placeholder;
    document.getElementById("habit-tags-row").style.display = vm.compose.showHabitTags ? "flex" : "none";
    document.getElementById("state-controls").classList.toggle("open", !!vm.compose.showStateControls);
    document.getElementById("entry-filter-summary").textContent = vm.summary.text;
    document.getElementById("starter-card").style.display = vm.starter.visible ? "block" : "none";
  } else {
    renderCompose(state);
    renderEntrySummary(state);
    renderStarterCard(state);
  }
  renderSetupCard(state);
  renderDiaryEntries(state);
  renderSlipLog(state);
}

function render(state) {
  var vm = window.HabitScreenModels && window.HabitScreenModels.buildDiaryScreenModel
    ? window.HabitScreenModels.buildDiaryScreenModel(state, { composeMode: composeMode, entryFilter: entryFilter })
    : null;
  updateEntryFilterUI();
  if (vm && window.HabitScreenDom && window.HabitScreenDom.applyDiaryScreenViewModel) {
    window.HabitScreenDom.applyDiaryScreenViewModel(vm);
  } else {
    renderCompose(state);
    renderEntrySummary(state);
    renderStarterCard(state);
  }
  renderSetupCard(state);
  renderDiaryEntries(state);
  renderSlipLog(state);
}

function renderDiaryEntries(state) {
  var root = document.getElementById("diary-entries");
  var entries = state.diaryEntries.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  if (entryFilter !== "all") {
    entries = entries.filter(function (entry) {
      return (entry.entryScope === "state" ? "state" : "habit") === entryFilter;
    });
  }
  if (!entries.length) {
    if (entryFilter === "all" && (!state.diaryEntries || !state.diaryEntries.length)) {
      root.innerHTML = "";
      return;
    }
    root.innerHTML = '<div class="empty">' + getDiaryEmptyText(state) + '</div>';
    return;
  }

  root.innerHTML = entries.map(function (entry) {
    var date = new Date(entry.timestamp);
    var isStateEntry = entry.entryScope === "state";
    var habitTagList = Array.isArray(entry.triggerTags) && entry.triggerTags.length
      ? entry.triggerTags
      : (entry.tag ? [entry.tag] : []);
    var tagHtml = "";
    if (isStateEntry) {
      tagHtml = '<div class="entry-kind state">РЎРѕСЃС‚РѕСЏРЅРёРµ</div>';
    } else if (habitTagList.length) {
      tagHtml = '<div class="de-tag" style="background:#E1F5EE;color:#085041;">' + window.HabitStore.helpers.triggerLabel(habitTagList[0]) + '</div>';
    } else {
      tagHtml = '<div class="entry-kind">РџСЂРёРІС‹С‡РєР°</div>';
    }
    var related = entry.relatedSlipId ? state.slips.find(function (slip) { return slip.id === entry.relatedSlipId; }) : null;
    var relatedHtml = related
      ? '<div class="de-habit-ref"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="#1D9E75" stroke-width="1.2"/><path d="M6 3.5V6.5l1.5 1" stroke="#1D9E75" stroke-width="1.1" stroke-linecap="round"/></svg><div class="de-habit-label">' + state.currentHabit.name + ' В· ' + window.HabitStore.helpers.formatTime(new Date(related.timestamp)) + ' В·</div><div class="de-habit-count">' + window.HabitStore.helpers.triggerLabel(related.triggerTag) + '</div></div>'
      : "";
    var stateSummary = isStateEntry
      ? '<div class="state-summary">' +
        '<div class="state-chip">РЅР°СЃС‚СЂРѕРµРЅРёРµ ' + (entry.moodScore || "вЂ”") + '/5</div>' +
        '<div class="state-chip">СЌРЅРµСЂРіРёСЏ ' + (entry.energyScore || "вЂ”") + '/5</div>' +
        '<div class="state-chip">СЃС‚СЂРµСЃСЃ ' + (entry.stressScore || "вЂ”") + '/5</div>' +
        (entry.contextTags || []).map(function (tag) {
          return '<div class="state-chip">' + getStateTagLabel(tag) + '</div>';
        }).join("") +
      '</div>'
      : "";
    var habitTagsHtml = !isStateEntry && habitTagList.length > 1
      ? '<div class="habit-tag-row">' + habitTagList.map(function (tag) {
          return '<div class="habit-tag-chip">' + window.HabitStore.helpers.triggerLabel(tag) + '</div>';
        }).join("") + '</div>'
      : "";
    return '<div class="diary-entry"><div class="de-header"><div class="de-avatar">' + state.profile.initials + '</div><div class="de-meta"><div class="de-name">' + state.profile.userName + '</div><div class="de-time">' + window.HabitStore.helpers.todayLabel(date) + '</div></div>' + tagHtml + '</div>' + stateSummary + habitTagsHtml + '<div class="de-text">' + entry.text.replace(/</g, "&lt;") + '</div>' + relatedHtml + '<div class="de-footer"><div class="de-reaction">' + (isStateEntry ? "Р¤РѕРЅ РґРЅСЏ" : "Р­С‚Рѕ С‡РµСЃС‚РЅРѕ") + '</div><div class="de-reaction">' + (isStateEntry ? "РџРѕР»РµР·РЅРѕ РґР»СЏ РёРЅСЃР°Р№С‚РѕРІ" : "РҐРѕСЂРѕС€РµРµ РЅР°Р±Р»СЋРґРµРЅРёРµ") + '</div></div></div>';
  }).join("");
}

document.getElementById("save-entry-btn").addEventListener("click", saveEntry);
document.getElementById("setup-btn").addEventListener("click", function () {
  openSetupNextStep(window.HabitStore.getState());
});
window.HabitStore.subscribe(render);
window.DemoNavigation.initBottomTabs();
render(window.HabitStore.getState());
