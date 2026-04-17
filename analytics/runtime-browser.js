(function () {
  function getHabitEventLabel(habitId) {
    var labels = {
      smoking: "срывов",
      alcohol: "эпизодов",
      sweets: "эпизодов",
      social: "залипов",
      overeating: "эпизодов",
      custom: "эпизодов"
    };
    return labels[habitId] || "эпизодов";
  }

  function getHabitSummaryCopy(habitId, topTrigger, riskHour, diaryMention, assessment) {
    var riskWindow = formatWindow(riskHour);
    var triggerText = topTrigger.label.toLowerCase();
    var copy = {
      headline: "Главное окно риска — " + riskWindow,
      narrative: "Основной фактор сейчас — " + triggerText + ". Большинство эпизодов группируется в окне " + riskWindow + ".",
      badge: topTrigger.label.toLowerCase()
    };

    if (habitId === "smoking") {
      copy.headline = riskHour >= 13 && riskHour <= 16 ? "Пик тяги к сигарете — после 13:00" : "Главное окно риска для курения — " + riskWindow;
      copy.narrative = "Курение сейчас чаще всего запускается через " + triggerText + ". Самое напряжённое окно — " + riskWindow + ".";
    } else if (habitId === "alcohol") {
      copy.headline = "Риск по алкоголю выше в окне " + riskWindow;
      copy.narrative = "Эпизоды с алкоголем сейчас чаще связаны с фактором " + triggerText + " и собираются в окне " + riskWindow + ".";
    } else if (habitId === "sweets") {
      copy.headline = "Пик тяги к сладкому — " + riskWindow;
      copy.narrative = "Тяга к сладкому сейчас чаще запускается через " + triggerText + ". Самое уязвимое окно — " + riskWindow + ".";
    } else if (habitId === "social") {
      copy.headline = "Лента особенно затягивает в окне " + riskWindow;
      copy.narrative = "Залипы в соцсетях чаще всего связаны с фактором " + triggerText + " и повторяются в окне " + riskWindow + ".";
    } else if (habitId === "overeating") {
      copy.headline = "Риск переедания выше в окне " + riskWindow;
      copy.narrative = "Переедание сейчас чаще приходит через " + triggerText + ". Самое сложное окно — " + riskWindow + ".";
    }

    if (diaryMention) {
      copy.narrative += " В дневнике это тоже звучит: «" + diaryMention.text.slice(0, 88) + (diaryMention.text.length > 88 ? "…" : "") + "».";
    }

    if (assessment && typeof assessment.score === "number") {
      copy.narrative += " Стартовый опрос тоже указывает на нагрузку, значит это окно стоит готовить заранее.";
    }

    return copy;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function shiftDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  function filterByPeriod(items, days) {
    var now = new Date();
    var from = shiftDays(startOfDay(now), -(days - 1));
    return items.filter(function (item) {
      return new Date(item.timestamp) >= from;
    });
  }

  function formatWindow(hour) {
    var start = String(hour).padStart(2, "0") + ":00";
    var end = String(Math.min(hour + 3, 24)).padStart(2, "0") + ":00";
    return start + "-" + end;
  }

  function getDaysLabel(days) {
    if (days === 7) return "7 дней";
    if (days === 90) return "3 месяца";
    return "30 дней";
  }

  function dayIndex(localDate) {
    var date = new Date(localDate + "T12:00:00");
    var value = date.getDay();
    return value === 0 ? 6 : value - 1;
  }

  function buildHeatmap(slips) {
    var hourLabels = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"];
    var hours = [7, 9, 11, 13, 15, 17, 19, 21, 23];
    var matrix = hours.map(function () { return [0, 0, 0, 0, 0, 0, 0]; });

    slips.forEach(function (slip) {
      var row = 0;
      for (var i = 0; i < hours.length; i += 1) {
        if (slip.localHour >= hours[i]) row = i;
      }
      matrix[row][dayIndex(slip.localDate)] += 1;
    });

    return {
      hours: hourLabels,
      days: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"],
      values: matrix
    };
  }

  function buildTriggerBreakdown(slips) {
    var counts = {};
    slips.forEach(function (slip) {
      var tag = slip.triggerTag || "other";
      counts[tag] = (counts[tag] || 0) + 1;
    });
    var labels = {
      stress: "Стресс",
      boredom: "Скука",
      company: "Компания",
      after_food: "После еды",
      fatigue: "Усталость",
      ritual: "Ритуал",
      other: "Другое"
    };
    var colors = {
      stress: "#D85A30",
      boredom: "#EF9F27",
      company: "#7F77DD",
      after_food: "#5DCAA5",
      fatigue: "#B4B2A9",
      ritual: "#0C447C",
      other: "#B4B2A9"
    };
    var total = slips.length || 1;
    return Object.keys(counts)
      .map(function (tag) {
        return {
          key: tag,
          label: labels[tag] || "Другое",
          count: counts[tag],
          share: counts[tag] / total,
          color: colors[tag] || "#B4B2A9"
        };
      })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function buildStats(slips, resisted, days, habitId) {
    var total = slips.length;
    var averagePerDay = round(total / days);
    var currentWindow = days;
    var previousSlips = filterByPeriod(window.HabitStore.getState().slips, currentWindow * 2).slice(0, 0);
    previousSlips = window.HabitStore.getState().slips.filter(function (item) {
      var now = new Date();
      var periodStart = shiftDays(startOfDay(now), -(days - 1));
      var previousStart = shiftDays(periodStart, -days);
      return new Date(item.timestamp) >= previousStart && new Date(item.timestamp) < periodStart;
    });

    var previousTotal = previousSlips.length;
    var delta = total - previousTotal;
    var trendText = delta <= 0 ? "↓ " + delta : "↑ +" + delta;

    var streakMap = {};
    slips.forEach(function (slip) {
      streakMap[slip.localDate] = (streakMap[slip.localDate] || 0) + 1;
    });
    var bestDays = Object.keys(streakMap).filter(function (key) {
      return streakMap[key] <= 2;
    }).length;

    return [
      {
        value: String(total),
        label: "всего " + getHabitEventLabel(habitId),
        trend: trendText + " к прошлому периоду",
        trendColor: delta <= 0 ? "#1D9E75" : "#D85A30"
      },
      {
        value: String(averagePerDay),
        label: "в среднем в день",
        trend: resisted.length ? "есть удержания" : "без удержаний",
        trendColor: resisted.length ? "#1D9E75" : "#EF9F27"
      },
      {
        value: String(bestDays),
        label: "спокойных дней",
        trend: bestDays >= 3 ? "есть прогресс" : "можно усилить опору",
        trendColor: bestDays >= 3 ? "#EF9F27" : "#8a8880"
      }
    ];
  }

  function getHabitDayPatternCopy(habitId, dayName) {
    var copy = {
      text: "Наибольшая плотность срывов приходится на " + dayName + ". Это хороший кандидат для точечной профилактики.",
      highlight: "Поставь напоминание перед окном риска и заранее подготовь замену ритуалу."
    };

    if (habitId === "smoking") {
      copy.text = "Больше всего эпизодов по курению приходится на " + dayName + ". Похоже, именно здесь привычный ритуал включается легче всего.";
      copy.highlight = "Перед этим днём подготовь замену сигарете заранее: воду, короткую прогулку или паузу для рук.";
    } else if (habitId === "alcohol") {
      copy.text = "На " + dayName + " приходится больше всего алкогольных эпизодов. Похоже, в этот день сильнее срабатывают компания, усталость или сценарий расслабления.";
      copy.highlight = "На этот день заранее выбери безалкогольный сценарий и продумай, как выйти из триггерной ситуации раньше.";
    } else if (habitId === "sweets") {
      copy.text = "Именно " + dayName + " чаще всего усиливает тягу к сладкому. Значит, в этот день особенно важно не оставлять решение на автомат.";
      copy.highlight = "Подготовь плотный перекус и отдельный ритуал после еды, чтобы не заходить в сладкое по привычке.";
    } else if (habitId === "social") {
      copy.text = "На " + dayName + " приходится больше всего залипов в соцсети. Вероятно, в этот день выше утомление и сильнее включается автопрокрутка.";
      copy.highlight = "Перед этим днём включай таймер входа в ленту и убирай телефон из зоны быстрого доступа в часы усталости.";
    } else if (habitId === "overeating") {
      copy.text = "Больше всего эпизодов переедания приходится на " + dayName + ". Это хороший сигнал заранее подстраховать стресс и вечерние окна риска.";
      copy.highlight = "На этот день лучше заранее собрать план еды, воды и короткой паузы после напряжения, чтобы не входить в автоматический сценарий.";
    }

    return copy;
  }

  function buildDayPattern(slips, habitId) {
    var days = [
      { key: "понедельник", short: "пн", count: 0 },
      { key: "вторник", short: "вт", count: 0 },
      { key: "среда", short: "ср", count: 0 },
      { key: "четверг", short: "чт", count: 0 },
      { key: "пятница", short: "пт", count: 0 },
      { key: "суббота", short: "сб", count: 0 },
      { key: "воскресенье", short: "вс", count: 0 }
    ];
    slips.forEach(function (slip) {
      days[dayIndex(slip.localDate)].count += 1;
    });
    days.sort(function (a, b) { return b.count - a.count; });
    var worst = days[0];
    var copy = getHabitDayPatternCopy(habitId, worst.key);
    return {
      title: worst.key.charAt(0).toUpperCase() + worst.key.slice(1) + " — самый трудный день",
      badge: "риск",
      badgeBg: "#FCEBEB",
      badgeColor: "#791F1F",
      text: copy.text,
      highlight: copy.highlight
    };
  }

  function buildSummary(slips, diaryEntries, triggers, dependencyIndex, habitId, assessment) {
    var topTrigger = triggers[0] || { key: "other", label: "Другое" };
    var hourCounts = {};
    slips.forEach(function (slip) {
      hourCounts[slip.localHour] = (hourCounts[slip.localHour] || 0) + 1;
    });
    var topHour = Object.keys(hourCounts).sort(function (a, b) {
      return hourCounts[b] - hourCounts[a];
    })[0];
    var riskHour = topHour ? Number(topHour) : 13;
    var diaryMention = diaryEntries.find(function (entry) {
      return entry.tag === topTrigger.key;
    });

    var copy = getHabitSummaryCopy(habitId, topTrigger, riskHour, diaryMention, assessment);

    return {
      dependencyIndex: dependencyIndex,
      riskLevel: dependencyIndex >= 75 ? "very_high" : dependencyIndex >= 50 ? "high" : dependencyIndex >= 25 ? "moderate" : "low",
      mainTrigger: topTrigger.label,
      riskWindow: formatWindow(riskHour),
      headline: copy.headline,
      narrative: copy.narrative,
      badge: copy.badge
    };
  }

  function computeAssessmentModifier(assessment) {
    if (!assessment || typeof assessment.score !== "number") {
      return 0;
    }
    return assessment.score * 0.22;
  }

  function computeDependencyIndex(slips, resisted, diaryEntries, days, assessment) {
    var averagePerDay = slips.length / Math.max(days, 1);
    var highStressShare = slips.length
      ? slips.filter(function (slip) { return slip.triggerTag === "stress" || (slip.triggerTags || []).indexOf("stress") >= 0; }).length / slips.length
      : 0;
    var resistedFactor = resisted.length / Math.max(slips.length + resisted.length, 1);
    var diaryFactor = diaryEntries.length ? Math.min(1, diaryEntries.length / 8) : 0;
    var raw = 35 * clamp(averagePerDay / 6, 0, 1) + 30 * highStressShare + 20 * (1 - resistedFactor) + 15 * (1 - diaryFactor * 0.4) + computeAssessmentModifier(assessment);
    return round(clamp(raw, 0, 100));
  }

  function getInsightViewModel(periodKey) {
    var days = periodKey === "7d" ? 7 : periodKey === "90d" ? 90 : 30;
    var state = window.HabitStore.getState();
    var slips = filterByPeriod(state.slips, days);
    var resisted = filterByPeriod(state.resisted, days);
    var diaryEntries = filterByPeriod(state.diaryEntries, days);
    var triggers = buildTriggerBreakdown(slips);
    var dependencyIndex = computeDependencyIndex(slips, resisted, diaryEntries, days, state.assessment);

    return {
      period: periodKey,
      summary: buildSummary(slips, diaryEntries, triggers, dependencyIndex, state.currentHabit.id, state.assessment),
      heatmap: buildHeatmap(slips),
      triggers: triggers,
      stats: buildStats(slips, resisted, days, state.currentHabit.id),
      dayPattern: buildDayPattern(slips, state.currentHabit.id),
      daysLabel: getDaysLabel(days),
      assessment: state.assessment
    };
  }

  window.HabitAnalytics = {
    getInsightViewModel: getInsightViewModel
  };
})();
