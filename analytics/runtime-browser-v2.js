(function () {
  var HEATMAP_HOURS = [7, 9, 11, 13, 15, 17, 19, 21, 23];
  var HEATMAP_LABELS = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"];
  var DAY_SHORTS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  var DAY_NAMES = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
  var NEGATIVE_TRIGGER_TAGS = {
    stress: true,
    boredom: true,
    fatigue: true,
    loneliness: true,
    anxiety: true
  };
  var TRIGGER_LABELS = {
    stress: "Стресс",
    boredom: "Скука",
    company: "Компания",
    after_food: "После еды",
    fatigue: "Усталость",
    loneliness: "Одиночество",
    anxiety: "Тревога",
    ritual: "Ритуал",
    craving: "Тяга",
    other: "Другое",
    unknown: "Другое"
  };
  var TRIGGER_COLORS = {
    stress: "#D85A30",
    boredom: "#EF9F27",
    company: "#7F77DD",
    after_food: "#5DCAA5",
    fatigue: "#B4B2A9",
    loneliness: "#7F77DD",
    anxiety: "#D85A30",
    ritual: "#0C447C",
    craving: "#1D9E75",
    other: "#B4B2A9",
    unknown: "#B4B2A9"
  };
  var EMOTION_KEYWORDS = [
    "стресс",
    "трев",
    "устал",
    "давлен",
    "одино",
    "пусто",
    "раздраж",
    "тяжел",
    "сорвал",
    "напряж"
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 10) / 10;
  }

  function normalized(value, min, max) {
    if (max <= min) return 0;
    return clamp((value - min) / (max - min), 0, 1);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function shiftDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  function periodDays(periodKey) {
    if (periodKey === "7d") return 7;
    if (periodKey === "90d") return 90;
    return 30;
  }

  function getPeriodBounds(days, offsetDays) {
    var now = new Date();
    var end = shiftDays(startOfDay(now), -offsetDays + 1);
    end = new Date(end.getTime() - 1);
    var start = shiftDays(startOfDay(now), -(days - 1) - offsetDays);
    return { start: start, end: end };
  }

  function filterByBounds(items, bounds) {
    return items.filter(function (item) {
      var timestamp = new Date(item.timestamp);
      return timestamp >= bounds.start && timestamp <= bounds.end;
    });
  }

  function getDaysLabel(days) {
    if (days === 7) return "7 дней";
    if (days === 90) return "3 месяца";
    return "30 дней";
  }

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

  function localHourBucket(hour) {
    var bucketIndex = 0;
    for (var index = 0; index < HEATMAP_HOURS.length; index += 1) {
      if (hour >= HEATMAP_HOURS[index]) bucketIndex = index;
    }
    return bucketIndex;
  }

  function dayIndex(localDate) {
    var date = new Date(localDate + "T12:00:00");
    var value = date.getDay();
    return value === 0 ? 6 : value - 1;
  }

  function buildDateRange(start, days) {
    var items = [];
    for (var index = 0; index < days; index += 1) {
      items.push(window.HabitStore.helpers.formatDateKey(shiftDays(start, index)));
    }
    return items;
  }

  function average(values) {
    if (!values.length) return 0;
    var total = values.reduce(function (sum, value) { return sum + value; }, 0);
    return total / values.length;
  }

  function topEntries(mapObject, limit) {
    return Object.keys(mapObject)
      .map(function (key) { return [key, mapObject[key]]; })
      .sort(function (left, right) { return right[1] - left[1]; })
      .slice(0, limit);
  }

  function buildHeatmap(slips) {
    var matrix = HEATMAP_HOURS.map(function () { return [0, 0, 0, 0, 0, 0, 0]; });
    slips.forEach(function (slip) {
      var row = localHourBucket(slip.localHour);
      var col = dayIndex(slip.localDate);
      matrix[row][col] += 1;
    });
    return {
      hours: HEATMAP_LABELS,
      days: DAY_SHORTS,
      values: matrix
    };
  }

  function inferContext(event) {
    var isWorkHour = event.localHour >= 9 && event.localHour <= 18;
    var isAfterFood = (event.triggerTags || []).indexOf("after_food") !== -1 || event.triggerTag === "after_food" || (event.localHour >= 12 && event.localHour <= 15);
    var withPeople = (event.triggerTags || []).indexOf("company") !== -1 || event.triggerTag === "company";
    return {
      alone: !withPeople,
      withPeople: withPeople,
      afterFood: isAfterFood,
      atWork: isWorkHour && dayIndex(event.localDate) <= 4,
      atHome: !isWorkHour
    };
  }

  function buildTriggerBreakdown(slips, resisted) {
    var counts = {};
    var total = 0;

    slips.forEach(function (slip) {
      (slip.triggerTags && slip.triggerTags.length ? slip.triggerTags : [slip.triggerTag || "other"]).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
        total += 1;
      });
    });

    resisted.forEach(function (event) {
      (event.triggerTags || ["other"]).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
        total += 1;
      });
    });

    return Object.keys(counts)
      .map(function (tag) {
        return {
          key: tag,
          label: TRIGGER_LABELS[tag] || "Другое",
          count: counts[tag],
          share: total ? counts[tag] / total : 0,
          color: TRIGGER_COLORS[tag] || "#B4B2A9"
        };
      })
      .sort(function (left, right) { return right.count - left.count; });
  }

  function calculateEmotionKeywordScore(entries) {
    if (!entries.length) return 0;
    var hits = 0;
    entries.forEach(function (entry) {
      var text = String(entry.text || "").toLowerCase();
      EMOTION_KEYWORDS.forEach(function (keyword) {
        if (text.indexOf(keyword) !== -1) hits += 1;
      });
    });
    return clamp(hits / Math.max(entries.length * 2, 1), 0, 1);
  }

  function averageStateMetric(entries, key) {
    var values = entries
      .map(function (entry) { return Number(entry[key]) || 0; })
      .filter(function (value) { return value > 0; });
    return values.length ? average(values) : 0;
  }

  function getTopStateContext(entries) {
    var counts = {};
    entries.forEach(function (entry) {
      (entry.contextTags || []).forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    var best = Object.keys(counts).sort(function (left, right) {
      return counts[right] - counts[left];
    })[0];
    return best || null;
  }

  function getStateContextLabel(tag) {
    var labels = {
      sleep: "сон",
      work: "работа",
      conflict: "конфликт",
      loneliness: "одиночество",
      fatigue: "усталость",
      calm: "спокойное состояние"
    };
    return labels[tag] || "общее состояние";
  }

  function countSlipClusters(slips) {
    if (slips.length < 2) return 0;
    var sorted = slips.slice().sort(function (left, right) {
      return new Date(left.timestamp) - new Date(right.timestamp);
    });
    var clusters = 0;
    for (var index = 1; index < sorted.length; index += 1) {
      var gapMinutes = (new Date(sorted[index].timestamp) - new Date(sorted[index - 1].timestamp)) / 60000;
      if (gapMinutes <= 180) clusters += 1;
    }
    return clusters;
  }

  function calculateRecoveryDays(orderedDates, dailySlipCounts, dailyLimit) {
    var badDayIndexes = orderedDates
      .map(function (date, index) { return { date: date, index: index }; })
      .filter(function (item) { return (dailySlipCounts[item.date] || 0) > dailyLimit; });

    if (!badDayIndexes.length) return 0;

    var values = badDayIndexes.map(function (item) {
      for (var nextIndex = item.index + 1; nextIndex < Math.min(item.index + 8, orderedDates.length); nextIndex += 1) {
        var candidate = orderedDates[nextIndex];
        if ((dailySlipCounts[candidate] || 0) <= dailyLimit) return nextIndex - item.index;
      }
      return 7;
    });

    return average(values);
  }

  function calculateResistedAfterSlipRate(badDays, resisted) {
    if (!badDays.length) return 1;
    var recovered = 0;
    badDays.forEach(function (dateValue) {
      var start = new Date(dateValue + "T00:00:00").getTime();
      var end = start + 48 * 60 * 60 * 1000;
      var hasResisted = resisted.some(function (event) {
        var timestamp = new Date(event.timestamp).getTime();
        return timestamp > start && timestamp <= end;
      });
      if (hasResisted) recovered += 1;
    });
    return recovered / badDays.length;
  }

  function calculateInverseTrend(currentPerDay, previousPerDay) {
    if (currentPerDay === 0 && previousPerDay === 0) return 0;
    if (previousPerDay === 0) return currentPerDay > 0 ? 1 : 0;
    var deltaRatio = (currentPerDay - previousPerDay) / previousPerDay;
    return clamp(0.5 + deltaRatio * 0.5, 0, 1);
  }

  function computeAssessmentModifier(assessment) {
    if (!assessment || typeof assessment.score !== "number") return 0;
    return assessment.score;
  }

  function aggregateMetrics(state, days) {
    var currentBounds = getPeriodBounds(days, 0);
    var previousBounds = getPeriodBounds(days, days);
    var slips = filterByBounds(state.slips, currentBounds);
    var resisted = filterByBounds(state.resisted, currentBounds);
    var diaryEntries = filterByBounds(state.diaryEntries, currentBounds);
    var habitDiaryEntries = diaryEntries.filter(function (entry) { return entry.entryScope !== "state"; });
    var stateEntries = diaryEntries.filter(function (entry) { return entry.entryScope === "state"; });
    var previousSlips = filterByBounds(state.slips, previousBounds);
    var previousDiaryEntries = filterByBounds(state.diaryEntries, previousBounds);
    var previousStateEntries = previousDiaryEntries.filter(function (entry) { return entry.entryScope === "state"; });
    var orderedDates = buildDateRange(currentBounds.start, days);
    var dailySlipCounts = {};
    var uniqueEventDates = {};
    var hourlyCounts = {};
    var patternCounts = {};

    slips.forEach(function (event) {
      dailySlipCounts[event.localDate] = (dailySlipCounts[event.localDate] || 0) + 1;
      uniqueEventDates[event.localDate] = true;
      var hourBucket = localHourBucket(event.localHour);
      hourlyCounts[hourBucket] = (hourlyCounts[hourBucket] || 0) + 1;
      var trigger = (event.triggerTags && event.triggerTags[0]) || event.triggerTag || "other";
      var context = inferContext(event);
      var contextKey = [
        context.atWork ? "work" : "",
        context.afterFood ? "food" : "",
        context.withPeople ? "social" : "",
        context.alone ? "alone" : ""
      ].filter(Boolean).join("_");
      var key = hourBucket + ":" + trigger + ":" + (contextKey || "neutral");
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    });

    resisted.forEach(function (event) {
      uniqueEventDates[event.localDate] = true;
    });
    diaryEntries.forEach(function (entry) {
      uniqueEventDates[window.HabitStore.helpers.formatDateKey(new Date(entry.timestamp))] = true;
    });

    var daysAboveLimit = orderedDates.filter(function (dateValue) {
      return (dailySlipCounts[dateValue] || 0) > state.currentHabit.dailyLimit;
    });
    var allCravingLevels = slips.concat(resisted).map(function (event) {
      return event.cravingLevel || 0;
    });
    var triggerBreakdown = buildTriggerBreakdown(slips, resisted);
    var topTrigger = triggerBreakdown[0] ? triggerBreakdown[0].key : "unknown";
    var topTriggerShare = triggerBreakdown[0] ? triggerBreakdown[0].share : 0;
    var topHourEntries = topEntries(hourlyCounts, 2);
    var topHourCount = topHourEntries.reduce(function (sum, entry) { return sum + entry[1]; }, 0);
    var peakHourConcentration = slips.length ? topHourCount / slips.length : 0;
    var topPatternEntries = topEntries(patternCounts, 1);
    var routinePatternScore = slips.length ? (topPatternEntries[0] ? topPatternEntries[0][1] : 0) / slips.length : 0;
    var negativeEmotionShare = slips.length ? slips.filter(function (event) {
      var tags = event.triggerTags && event.triggerTags.length ? event.triggerTags : [event.triggerTag || "other"];
      return tags.some(function (tag) { return NEGATIVE_TRIGGER_TAGS[tag]; });
    }).length / slips.length : 0;
    var stressTriggerShare = slips.length ? slips.filter(function (event) {
      return (event.triggerTags || []).indexOf("stress") !== -1 || event.triggerTag === "stress";
    }).length / slips.length : 0;
    var stateStressAverage = averageStateMetric(stateEntries, "stressScore");
    var stateEnergyAverage = averageStateMetric(stateEntries, "energyScore");
    var stateMoodAverage = averageStateMetric(stateEntries, "moodScore");
    var previousStateStressAverage = averageStateMetric(previousStateEntries, "stressScore");
    var previousStateEnergyAverage = averageStateMetric(previousStateEntries, "energyScore");
    var previousStateMoodAverage = averageStateMetric(previousStateEntries, "moodScore");
    var statePressureScore = stateEntries.length
      ? clamp((
        normalized(stateStressAverage, 1, 5) +
        (1 - normalized(stateEnergyAverage || 3, 1, 5)) +
        (1 - normalized(stateMoodAverage || 3, 1, 5))
      ) / 3, 0, 1)
      : 0;
    var currentPerDay = slips.length / Math.max(days, 1);
    var previousPerDay = previousSlips.length / Math.max(days, 1);
    var topHourBucket = topEntries(hourlyCounts, 1)[0];
    var riskHour = topHourBucket ? HEATMAP_HOURS[Number(topHourBucket[0])] : 13;

    return {
      slips: slips,
      resisted: resisted,
      diaryEntries: diaryEntries,
      habitDiaryEntries: habitDiaryEntries,
      stateEntries: stateEntries,
      triggerBreakdown: triggerBreakdown,
      heatmap: buildHeatmap(slips),
      slipCount: slips.length,
      resistedCount: resisted.length,
      slipsPerDayAvg: round(currentPerDay),
      slipsPerWeekAvg: round(currentPerDay * 7),
      maxSlipsInDay: orderedDates.reduce(function (max, dateValue) {
        return Math.max(max, dailySlipCounts[dateValue] || 0);
      }, 0),
      daysAboveLimitPercent: round(daysAboveLimit.length / Math.max(days, 1)),
      avgCravingLevel: round(average(allCravingLevels)),
      highCravingShare: round(allCravingLevels.length ? allCravingLevels.filter(function (value) { return value >= 4; }).length / allCravingLevels.length : 0),
      cravingEventsPerDay: round((slips.length + resisted.length) / Math.max(days, 1)),
      cravingToSlipRate: round(slips.length + resisted.length ? slips.length / (slips.length + resisted.length) : 0),
      peakHourConcentration: round(peakHourConcentration),
      topTriggerShare: round(topTriggerShare),
      routinePatternScore: round(routinePatternScore),
      stressTriggerShare: round(stressTriggerShare),
      negativeEmotionShare: round(negativeEmotionShare),
      emotionKeywordScore: round(calculateEmotionKeywordScore(habitDiaryEntries)),
      statePressureScore: round(statePressureScore),
      stateAverages: {
        stress: round(stateStressAverage),
        energy: round(stateEnergyAverage),
        mood: round(stateMoodAverage)
      },
      previousStateAverages: {
        stress: round(previousStateStressAverage),
        energy: round(previousStateEnergyAverage),
        mood: round(previousStateMoodAverage)
      },
      topStateContext: getTopStateContext(stateEntries),
      previousTopStateContext: getTopStateContext(previousStateEntries),
      stateEntryCount: stateEntries.length,
      previousStateEntryCount: previousStateEntries.length,
      limitBreakRate: round(daysAboveLimit.length / Math.max(days, 1)),
      consecutiveSlipClusters: countSlipClusters(slips),
      recoveryDaysAfterBadDay: round(calculateRecoveryDays(orderedDates, dailySlipCounts, state.currentHabit.dailyLimit)),
      resistedAfterSlipRate: round(calculateResistedAfterSlipRate(daysAboveLimit, resisted)),
      inversePositiveTrend: round(calculateInverseTrend(currentPerDay, previousPerDay)),
      topTrigger: topTrigger,
      riskWindow: formatWindow(riskHour),
      riskHour: riskHour,
      observedDays: Object.keys(uniqueEventDates).length,
      previousSlipCount: previousSlips.length,
      dayCounts: DAY_NAMES.map(function (dayName, index) {
        return {
          key: dayName,
          count: slips.filter(function (slip) { return dayIndex(slip.localDate) === index; }).length
        };
      })
    };
  }

  function calculateSubscores(metrics) {
    var cravingScore = 100 * (
      0.4 * normalized(metrics.avgCravingLevel, 1, 5) +
      0.35 * metrics.highCravingShare +
      0.25 * normalized(metrics.cravingEventsPerDay, 0, 8)
    );
    var automaticityScore = 100 * (
      0.35 * metrics.peakHourConcentration +
      0.35 * metrics.topTriggerShare +
      0.3 * metrics.routinePatternScore
    );
    var lossOfControlScore = 100 * (
      0.4 * metrics.limitBreakRate +
      0.35 * metrics.cravingToSlipRate +
      0.25 * normalized(metrics.consecutiveSlipClusters, 0, 10)
    );
    var emotionalRelianceScore = 100 * (
      0.3 * metrics.negativeEmotionShare +
      0.3 * metrics.stressTriggerShare +
      0.2 * metrics.emotionKeywordScore +
      0.2 * metrics.statePressureScore
    );
    var recoveryScore = 100 * (
      0.45 * normalized(metrics.recoveryDaysAfterBadDay, 0, 7) +
      0.3 * (1 - metrics.resistedAfterSlipRate) +
      0.25 * metrics.inversePositiveTrend
    );

    return {
      cravingScore: round(cravingScore),
      automaticityScore: round(automaticityScore),
      lossOfControlScore: round(lossOfControlScore),
      emotionalRelianceScore: round(emotionalRelianceScore),
      recoveryScore: round(recoveryScore)
    };
  }

  function calculateDependencyIndex(subscores, assessment, observedDays) {
    var baseIndex = round(
      0.3 * subscores.cravingScore +
      0.2 * subscores.automaticityScore +
      0.2 * subscores.lossOfControlScore +
      0.2 * subscores.emotionalRelianceScore +
      0.1 * subscores.recoveryScore
    );
    var baselineModifier = computeAssessmentModifier(assessment);
    var finalIndex = observedDays <= 14
      ? 0.7 * baseIndex + 0.3 * baselineModifier
      : 0.9 * baseIndex + 0.1 * baselineModifier;
    return round(clamp(finalIndex, 0, 100));
  }

  function deriveRiskLevel(index) {
    if (index >= 75) return "very_high";
    if (index >= 50) return "high";
    if (index >= 25) return "moderate";
    return "low";
  }

  function getTopSubscoreName(subscores) {
    var entries = [
      { key: "craving", value: subscores.cravingScore, title: "Сильнее всего сейчас работает тяга" },
      { key: "automaticity", value: subscores.automaticityScore, title: "Поведение стало слишком автоматичным" },
      { key: "control", value: subscores.lossOfControlScore, title: "Сложнее всего сейчас удерживать контроль" },
      { key: "emotional", value: subscores.emotionalRelianceScore, title: "Эмоции сильнее всего подпитывают привычку" },
      { key: "recovery", value: subscores.recoveryScore, title: "После плохих дней сложнее восстанавливаться" }
    ];
    entries.sort(function (left, right) { return right.value - left.value; });
    return entries[0];
  }

  function buildForecast(metrics, dependencyIndex) {
    var dayCounts = metrics.dayCounts.slice().sort(function (left, right) { return right.count - left.count; });
    var topDayLoad = dayCounts[0] ? dayCounts[0].count : 0;
    var dayConcentration = metrics.slipCount ? topDayLoad / metrics.slipCount : 0;
    var forecastScore = round(clamp(
      dependencyIndex * 0.65 +
      metrics.peakHourConcentration * 20 +
      metrics.topTriggerShare * 10 +
      dayConcentration * 5,
      0,
      100
    ));
    var forecastLevel = deriveRiskLevel(forecastScore);
    var triggerLabel = TRIGGER_LABELS[metrics.topTrigger] || "другой фактор";
    return {
      score: forecastScore,
      level: forecastLevel,
      window: metrics.riskWindow,
      text: "В ближайшие 24 часа риск выше всего в окне " + metrics.riskWindow + ", особенно если снова сработает триггер «" + triggerLabel.toLowerCase() + "»."
    };
  }

  function buildConfidence(metrics, days, diaryEntriesLength) {
    var evidenceScore = 100 * (
      0.4 * normalized(metrics.slipCount + metrics.resistedCount, 3, 45) +
      0.2 * normalized(diaryEntriesLength, 1, 12) +
      0.2 * normalized(metrics.observedDays, 3, Math.min(days, 21)) +
      0.2 * clamp((metrics.topTriggerShare + metrics.peakHourConcentration) / 2, 0, 1)
    );
    var score = round(clamp(evidenceScore, 0, 100));
    var label = score >= 75 ? "высокая" : score >= 45 ? "средняя" : "низкая";
    var text = label === "высокая"
      ? "Данных уже достаточно, чтобы уверенно видеть повторяющийся сценарий."
      : label === "средняя"
        ? "Паттерн уже читается, но выводы ещё могут заметно уточняться."
        : "Пока данных немного, поэтому выводы лучше воспринимать как ранние гипотезы.";
    return {
      score: score,
      label: label,
      text: text
    };
  }

  function getDiaryMention(diaryEntries, triggerKey) {
    return diaryEntries.find(function (entry) {
      return entry.tag === triggerKey;
    }) || diaryEntries[0] || null;
  }

  function getHabitSummaryCopy(habitId, metrics, topSubscore, forecast, confidence, diaryMention) {
    var triggerLabel = TRIGGER_LABELS[metrics.topTrigger] || "другой фактор";
    var headline = topSubscore.title + " — " + metrics.riskWindow;
    var narrative = "Главный драйвер сейчас — " + triggerLabel.toLowerCase() + ". Поведение сильнее всего собирается в окне " + metrics.riskWindow + ".";

    if (habitId === "smoking") {
      headline = topSubscore.key === "automaticity"
        ? "Курение включается слишком автоматически — " + metrics.riskWindow
        : "Пик риска для курения — " + metrics.riskWindow;
      narrative = "Курение сейчас чаще всего запускается через " + triggerLabel.toLowerCase() + " и особенно сгущается в окне " + metrics.riskWindow + ".";
    } else if (habitId === "alcohol") {
      headline = "Риск по алкоголю выше всего в окне " + metrics.riskWindow;
      narrative = "Эпизоды по алкоголю сейчас чаще собираются через " + triggerLabel.toLowerCase() + " и повторяются ближе к окну " + metrics.riskWindow + ".";
    } else if (habitId === "sweets") {
      headline = "Тяга к сладкому чаще всего усиливается в " + metrics.riskWindow;
      narrative = "Тяга к сладкому сейчас сильнее всего связана с фактором " + triggerLabel.toLowerCase() + " и повторяется в окне " + metrics.riskWindow + ".";
    } else if (habitId === "social") {
      headline = "Соцсети сильнее всего затягивают в " + metrics.riskWindow;
      narrative = "Залипы в соцсетях сейчас чаще запускаются через " + triggerLabel.toLowerCase() + " и сгущаются в окне " + metrics.riskWindow + ".";
    } else if (habitId === "overeating") {
      headline = "Риск переедания выше всего в " + metrics.riskWindow;
      narrative = "Переедание сейчас сильнее всего связано с фактором " + triggerLabel.toLowerCase() + " и чаще повторяется в окне " + metrics.riskWindow + ".";
    }

    if (diaryMention) {
      var excerpt = String(diaryMention.text || "").slice(0, 88);
      narrative += " В дневнике это тоже звучит: «" + excerpt + (String(diaryMention.text || "").length > 88 ? "…" : "") + "».";
    }

    if (metrics.stateEntryCount) {
      narrative += " Фон состояния тоже заметен: стресс " + (metrics.stateAverages.stress || "—") + "/5, энергия " + (metrics.stateAverages.energy || "—") + "/5";
      if (metrics.topStateContext) {
        narrative += ", чаще всего рядом всплывает " + getStateContextLabel(metrics.topStateContext) + ".";
      } else {
        narrative += ".";
      }
    }

    narrative += " Прогноз на 24 часа: " + forecast.text;
    narrative += " Уверенность модели сейчас " + confidence.label + ".";

    return {
      headline: headline,
      narrative: narrative,
      badge: triggerLabel.toLowerCase()
    };
  }

  function buildStats(metrics, habitId, confidence, forecast) {
    var delta = metrics.slipCount - metrics.previousSlipCount;
    var trendText = delta <= 0 ? "↓ " + delta + " к прошлому периоду" : "↑ +" + delta + " к прошлому периоду";
    var trendColor = delta <= 0 ? "#1D9E75" : "#D85A30";
    return [
      {
        value: String(metrics.slipCount),
        label: "всего " + getHabitEventLabel(habitId),
        trend: trendText,
        trendColor: trendColor
      },
      {
        value: String(metrics.slipsPerDayAvg),
        label: "в среднем в день",
        trend: metrics.resistedCount ? "удержаний: " + metrics.resistedCount : "без удержаний",
        trendColor: metrics.resistedCount ? "#1D9E75" : "#EF9F27"
      },
      {
        value: String(confidence.score) + "%",
        label: "уверенность модели",
        trend: metrics.stateEntryCount ? "фон: " + (metrics.stateAverages.stress ? "стресс " + metrics.stateAverages.stress + "/5" : "есть записи состояния") : "24ч: " + forecast.window,
        trendColor: confidence.score >= 75 ? "#1D9E75" : confidence.score >= 45 ? "#EF9F27" : "#8a8880"
      }
    ];
  }

  function getHabitDayPatternCopy(habitId, dayName) {
    var copy = {
      text: "Наибольшая плотность эпизодов приходится на " + dayName + ". Это хороший кандидат для точечной профилактики.",
      highlight: "Поставь напоминание перед окном риска и заранее подготовь замену привычному ритуалу."
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

  function buildDayPattern(metrics, habitId) {
    var sortedDays = metrics.dayCounts.slice().sort(function (left, right) {
      return right.count - left.count;
    });
    var worst = sortedDays[0] || { key: "будний день", count: 0 };
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

  function buildWellbeingInsight(metrics, habitId) {
    if (!metrics.stateEntryCount) return null;
    var contextLabel = getStateContextLabel(metrics.topStateContext);
    var stress = metrics.stateAverages.stress || 0;
    var energy = metrics.stateAverages.energy || 0;
    var mood = metrics.stateAverages.mood || 0;
    var title = "Перед сложными днями чаще видно напряжение";
    var text = "В записях состояния перед сложными днями чаще появляется высокий стресс и меньше внутреннего ресурса.";
    var highlight = "Если замечаешь такой фон заранее, лучше снижать автоматизм до пика тяги, а не во время него.";
    var badge = "состояние";

    if (energy && energy <= 2.5 && stress >= 3.5) {
      title = "Трудные дни чаще растут из усталости и напряжения";
      text = "Перед сложными днями у тебя чаще сочетаются высокий стресс и низкая энергия. Это не про слабость, а про перегруженный фон.";
      highlight = "Лучше всего заранее защищать такие дни коротким восстановлением: вода, пауза, еда, движение или более простой режим.";
    } else if (mood && mood <= 2.5) {
      title = "Сложные дни чаще приходят на фоне тяжёлого настроения";
      text = "По записям состояния видно, что тяжёлое настроение часто идёт рядом с более уязвимыми окнами по привычке.";
      highlight = "Полезно замечать не только саму тягу, но и фон дня за 1–2 часа до неё: тогда у тебя появляется пространство для манёвра.";
    } else if (metrics.topStateContext) {
      title = "Перед сложными днями часто всплывает: " + contextLabel;
      text = "Состояние дня подсказывает контекст риска: записи чаще собираются вокруг темы \"" + contextLabel + "\" ещё до самих эпизодов.";
      highlight = "Смотри на этот фон как на ранний сигнал. Чем раньше замечаешь контекст, тем легче сместить сценарий.";
    }

    if (habitId === "social" && energy && energy <= 2.5) {
      highlight = "Когда энергия проседает, лучше заранее ограничить доступ к ленте и упростить среду, а не надеяться только на силу воли.";
    } else if (habitId === "smoking" && stress >= 3.5) {
      highlight = "Если фон дня уже напряжённый, лучше заранее подготовить замену сигарете именно к окну риска, а не после него.";
    }

    return {
      title: title,
      text: text,
      highlight: highlight,
      badge: badge,
      badgeBg: "#E6F1FB",
      badgeColor: "#0C447C"
    };
  }

  function buildWellbeingTrend(metrics) {
    if (!metrics.previousStateEntryCount) return null;
    var stressDelta = round((metrics.stateAverages.stress || 0) - (metrics.previousStateAverages.stress || 0));
    var energyDelta = round((metrics.stateAverages.energy || 0) - (metrics.previousStateAverages.energy || 0));
    var moodDelta = round((metrics.stateAverages.mood || 0) - (metrics.previousStateAverages.mood || 0));
    var direction = "stable";
    var text = "По сравнению с прошлым периодом фон состояния почти не изменился.";

    if (stressDelta >= 0.5 || energyDelta <= -0.5 || moodDelta <= -0.5) {
      direction = "harder";
      text = "По сравнению с прошлым периодом фон стал тяжелее: напряжение выше, а энергии или устойчивости меньше.";
    } else if (stressDelta <= -0.5 || energyDelta >= 0.5 || moodDelta >= 0.5) {
      direction = "lighter";
      text = "По сравнению с прошлым периодом фон стал мягче: напряжение ниже, а энергии или устойчивости больше.";
    } else if (metrics.topStateContext && metrics.previousTopStateContext && metrics.topStateContext !== metrics.previousTopStateContext) {
      text = "Уровень фона похож на прошлый период, но контекст сместился: теперь чаще рядом тема \"" + getStateContextLabel(metrics.topStateContext) + "\".";
    }

    return {
      direction: direction,
      text: text,
      stressDelta: stressDelta,
      energyDelta: energyDelta,
      moodDelta: moodDelta
    };
  }

  function buildSummary(state, metrics, dependencyIndex, subscores, forecast, confidence) {
    var topSubscore = getTopSubscoreName(subscores);
    var diaryMention = getDiaryMention(metrics.diaryEntries, metrics.topTrigger);
    var copy = getHabitSummaryCopy(state.currentHabit.id, metrics, topSubscore, forecast, confidence, diaryMention);
    return {
      dependencyIndex: dependencyIndex,
      riskLevel: deriveRiskLevel(dependencyIndex),
      mainTrigger: TRIGGER_LABELS[metrics.topTrigger] || "Другое",
      riskWindow: metrics.riskWindow,
      headline: copy.headline,
      narrative: copy.narrative,
      badge: copy.badge,
      forecastText: forecast.text,
      confidenceLabel: confidence.label,
      confidenceText: confidence.text,
      forecastLevel: forecast.level,
      subscores: subscores
    };
  }

  function formatWindow(hour) {
    var start = String(hour).padStart(2, "0") + ":00";
    var end = String(Math.min(hour + 3, 24)).padStart(2, "0") + ":00";
    return start + "-" + end;
  }

  function roundMoney(value) {
    return Math.round((value || 0) * 100) / 100;
  }

  function roundHours(value) {
    return Math.round((value || 0) * 10) / 10;
  }

  function getFinancialBaseline(habitId, finance) {
    var defaults = {
      smoking: { monthly: 6000, weekly: 1800, episode: 30, monthlyHours: 8, weeklyHours: 2.5, episodeMinutes: 8 },
      alcohol: { monthly: 12000, weekly: 3500, episode: 700, monthlyHours: 24, weeklyHours: 8, episodeMinutes: 180 },
      sweets: { monthly: 5000, weekly: 1500, episode: 250, monthlyHours: 10, weeklyHours: 3, episodeMinutes: 20 },
      social: { monthly: 0, weekly: 0, episode: 0, monthlyHours: 26, weeklyHours: 7, episodeMinutes: 25 },
      overeating: { monthly: 7000, weekly: 2000, episode: 350, monthlyHours: 16, weeklyHours: 4.5, episodeMinutes: 45 },
      custom: { monthly: 4000, weekly: 1200, episode: 200, monthlyHours: 12, weeklyHours: 3.5, episodeMinutes: 20 }
    };
    var baseline = defaults[habitId] || defaults.custom;
    var mode = (finance.costPerEpisode || 0) > 0 ? "money" : "time";
    return {
      monthly: baseline.monthly,
      weekly: baseline.weekly,
      episode: baseline.episode,
      monthlyHours: baseline.monthlyHours,
      weeklyHours: baseline.weeklyHours,
      episodeMinutes: baseline.episodeMinutes,
      mode: mode
    };
  }

  function getFinancialLoadLabel(score) {
    if (score >= 75) return { key: "severe", title: "тяжёлая", color: "#D85A30", bg: "#FCEBEB" };
    if (score >= 50) return { key: "high", title: "высокая", color: "#B35B12", bg: "#FAEEDA" };
    if (score >= 25) return { key: "noticeable", title: "заметная", color: "#0F6E56", bg: "#E1F5EE" };
    return { key: "low", title: "низкая", color: "#1D9E75", bg: "#E1F5EE" };
  }

  function buildFinancialLoad(state, metrics, finance) {
    var baseline = getFinancialBaseline(state.currentHabit.id, finance);
    var frequencyScore = 100 * normalized(metrics.slipsPerDayAvg, 0, Math.max(state.currentHabit.dailyLimit || 1, 1));
    var monthlyScore = baseline.mode === "money"
      ? 100 * normalized(finance.monthProjection, 0, baseline.monthly)
      : 100 * normalized(finance.monthHours, 0, baseline.monthlyHours);
    var weeklyBurstScore = baseline.mode === "money"
      ? 100 * normalized(finance.weekSpent, 0, baseline.weekly)
      : 100 * normalized(finance.weekHours, 0, baseline.weeklyHours);
    var episodeScore = baseline.mode === "money"
      ? 100 * normalized(finance.costPerEpisode, 0, baseline.episode)
      : 100 * normalized(finance.minutesPerEpisode, 0, baseline.episodeMinutes);

    var score = round(
      0.4 * monthlyScore +
      0.25 * frequencyScore +
      0.2 * weeklyBurstScore +
      0.15 * episodeScore
    );
    var label = getFinancialLoadLabel(score);
    var drivers = [
      {
        key: "monthly",
        title: baseline.mode === "money" ? "месячная стоимость" : "время за месяц",
        value: monthlyScore
      },
      {
        key: "frequency",
        title: "частота эпизодов",
        value: frequencyScore
      },
      {
        key: "burst",
        title: baseline.mode === "money" ? "быстрая утечка за 7 дней" : "плотность времени за 7 дней",
        value: weeklyBurstScore
      },
      {
        key: "episode",
        title: baseline.mode === "money" ? "цена одного эпизода" : "длина одного эпизода",
        value: episodeScore
      }
    ].sort(function (left, right) { return right.value - left.value; });
    var driver = drivers[0];
    var headline = baseline.mode === "money"
      ? "Финансовая нагрузка сейчас " + label.title
      : "Нагрузка по времени сейчас " + label.title;
    var narrative = baseline.mode === "money"
      ? "Главный драйвер сейчас — " + driver.title + ". За 30 дней привычка уже даёт " + finance.monthSpent + " " + finance.currencySymbol + ", а прогноз на месяц держится около " + finance.monthProjection + " " + finance.currencySymbol + "."
      : "Главный драйвер сейчас — " + driver.title + ". За 30 дней привычка уже забирает около " + finance.monthHours + " ч, а один эпизод в среднем тянется на " + finance.minutesPerEpisode + " мин.";

    return {
      score: score,
      label: label.title,
      level: label.key,
      color: label.color,
      bg: label.bg,
      headline: headline,
      narrative: narrative,
      driver: driver.title,
      components: {
        monthlyScore: round(monthlyScore),
        frequencyScore: round(frequencyScore),
        weeklyBurstScore: round(weeklyBurstScore),
        episodeScore: round(episodeScore)
      }
    };
  }

  function buildFinancialLoadTrend(state, metrics, finance, financialLoad, days) {
    var baseline = getFinancialBaseline(state.currentHabit.id, finance);
    var previousPerDay = metrics.previousSlipCount / Math.max(days, 1);
    var prevFrequencyScore = 100 * normalized(previousPerDay, 0, Math.max(state.currentHabit.dailyLimit || 1, 1));
    var prevMonthProjection = baseline.mode === "money"
      ? roundMoney(previousPerDay * 30 * (finance.costPerEpisode || 0))
      : roundHours(previousPerDay * 30 * (finance.minutesPerEpisode || 0) / 60);
    var prevWeekEquivalent = baseline.mode === "money"
      ? roundMoney(previousPerDay * 7 * (finance.costPerEpisode || 0))
      : roundHours(previousPerDay * 7 * (finance.minutesPerEpisode || 0) / 60);
    var prevMonthlyScore = baseline.mode === "money"
      ? 100 * normalized(prevMonthProjection, 0, baseline.monthly)
      : 100 * normalized(prevMonthProjection, 0, baseline.monthlyHours);
    var prevWeeklyBurstScore = baseline.mode === "money"
      ? 100 * normalized(prevWeekEquivalent, 0, baseline.weekly)
      : 100 * normalized(prevWeekEquivalent, 0, baseline.weeklyHours);
    var prevEpisodeScore = baseline.mode === "money"
      ? 100 * normalized(finance.costPerEpisode, 0, baseline.episode)
      : 100 * normalized(finance.minutesPerEpisode, 0, baseline.episodeMinutes);
    var previousScore = round(
      0.4 * prevMonthlyScore +
      0.25 * prevFrequencyScore +
      0.2 * prevWeeklyBurstScore +
      0.15 * prevEpisodeScore
    );
    var delta = round(financialLoad.score - previousScore);
    var direction = Math.abs(delta) < 3 ? "stable" : delta > 0 ? "up" : "down";
    var text = direction === "stable"
      ? "Почти без изменений к прошлому периоду."
      : direction === "up"
        ? "Нагрузка выросла на " + Math.abs(Math.round(delta)) + " пунктов к прошлому периоду."
        : "Нагрузка снизилась на " + Math.abs(Math.round(delta)) + " пунктов к прошлому периоду.";

    return {
      previousScore: previousScore,
      delta: delta,
      direction: direction,
      text: text
    };
  }

  function buildFinanceSummary(state, metrics) {
    var config = state.habitConfig || state.currentHabit.config || {};
    var slips = state.slips || [];
    var costPerEpisode = Number(config.costPerEpisode) || 0;
    var minutesPerEpisode = Number(config.minutesPerEpisode) || 0;
    var currencySymbol = config.currencySymbol || "₽";
    var todayKey = window.HabitStore.helpers.formatDateKey(new Date());
    var sevenDayBounds = getPeriodBounds(7, 0);
    var thirtyDayBounds = getPeriodBounds(30, 0);

    function countWithin(bounds) {
      return slips.filter(function (item) {
        var stamp = new Date(item.timestamp);
        return stamp >= bounds.start && stamp <= bounds.end;
      }).length;
    }

    var todayCount = slips.filter(function (item) { return item.localDate === todayKey; }).length;
    var weekCount = countWithin(sevenDayBounds);
    var monthCount = countWithin(thirtyDayBounds);
    var allCount = slips.length;

    return {
      costPerEpisode: roundMoney(costPerEpisode),
      minutesPerEpisode: roundHours(minutesPerEpisode),
      currencySymbol: currencySymbol,
      todaySpent: roundMoney(todayCount * costPerEpisode),
      weekSpent: roundMoney(weekCount * costPerEpisode),
      monthSpent: roundMoney(monthCount * costPerEpisode),
      allTimeSpent: roundMoney(allCount * costPerEpisode),
      monthProjection: roundMoney((metrics.slipsPerDayAvg || 0) * 30 * costPerEpisode),
      weekHours: roundHours((weekCount * minutesPerEpisode) / 60),
      monthHours: roundHours((monthCount * minutesPerEpisode) / 60),
      allTimeHours: roundHours((allCount * minutesPerEpisode) / 60)
    };
  }

  function buildHealthSummary(state) {
    var config = state.habitConfig || state.currentHabit.config || {};
    var markers = config.healthMarkers || {};
    var history = Array.isArray(config.healthHistory) ? config.healthHistory : [];
    var filled = Object.keys(markers).filter(function (key) {
      return markers[key] !== null && markers[key] !== undefined && markers[key] !== "";
    });
    var previous = history.length >= 2 ? history[history.length - 2].markers || {} : null;
    var trends = [];

    function pushTrend(key, label, suffix, lowerIsBetter) {
      if (!previous) return;
      var currentValue = markers[key];
      var previousValue = previous[key];
      if (currentValue == null || previousValue == null || currentValue === previousValue) return;
      var delta = round(currentValue - previousValue);
      var improved = lowerIsBetter ? delta < 0 : delta > 0;
      trends.push({
        key: key,
        label: label,
        delta: delta,
        improved: improved,
        suffix: suffix
      });
    }

    pushTrend("sleepHours", "сон", "ч", false);
    pushTrend("restingHeartRate", "пульс", "уд/мин", true);
    pushTrend("bloodPressureSystolic", "верхнее давление", "", true);
    pushTrend("bloodPressureDiastolic", "нижнее давление", "", true);
    pushTrend("weightKg", "вес", "кг", true);
    pushTrend("waistCm", "талия", "см", true);
    pushTrend("hba1c", "HbA1c", "", true);

    var summary = "Пока нет прошлого замера для сравнения.";
    var trendDirection = "none";
    if (trends.length) {
      var positive = trends.filter(function (item) { return item.improved; }).length;
      var negative = trends.length - positive;
      var primary = trends[0];
      if (positive > negative) {
        trendDirection = "up";
        summary = "Есть позитивный сдвиг: " + primary.label + " " + (primary.delta > 0 ? "↑" : "↓") + " " + Math.abs(primary.delta) + (primary.suffix ? " " + primary.suffix : "") + ".";
      } else if (negative > positive) {
        trendDirection = "down";
        summary = "Часть маркеров просела: " + primary.label + " " + (primary.delta > 0 ? "↑" : "↓") + " " + Math.abs(primary.delta) + (primary.suffix ? " " + primary.suffix : "") + ".";
      } else {
        trendDirection = "stable";
        summary = "Маркеры меняются разнонаправленно, пока без явного общего тренда.";
      }
    } else if (history.length >= 2) {
      trendDirection = "stable";
      summary = "Последние два замера почти без изменений.";
    }

    return {
      markers: markers,
      filledCount: filled.length,
      totalCount: Object.keys(markers).length,
      historyLength: history.length,
      trendDirection: trendDirection,
      trendSummary: summary,
      trends: trends
    };
  }

  function getInsightViewModel(periodKey) {
    var days = periodDays(periodKey);
    var state = window.HabitStore.getState();
    var metrics = aggregateMetrics(state, days);
    var subscores = calculateSubscores(metrics);
    var dependencyIndex = calculateDependencyIndex(subscores, state.assessment, metrics.observedDays);
    var forecast = buildForecast(metrics, dependencyIndex);
    var confidence = buildConfidence(metrics, days, metrics.diaryEntries.length);
    var finance = buildFinanceSummary(state, metrics);
    var financialLoad = buildFinancialLoad(state, metrics, finance);
    financialLoad.trend = buildFinancialLoadTrend(state, metrics, finance, financialLoad, days);
    var health = buildHealthSummary(state);

    return {
      period: periodKey,
      summary: buildSummary(state, metrics, dependencyIndex, subscores, forecast, confidence),
      heatmap: metrics.heatmap,
      triggers: metrics.triggerBreakdown,
      stats: buildStats(metrics, state.currentHabit.id, confidence, forecast),
      dayPattern: buildDayPattern(metrics, state.currentHabit.id),
      daysLabel: getDaysLabel(days),
      assessment: state.assessment,
      finance: finance,
      financialLoad: financialLoad,
      health: health,
      wellbeing: {
        stateEntryCount: metrics.stateEntryCount,
        previousStateEntryCount: metrics.previousStateEntryCount,
        topContext: metrics.topStateContext,
        contextLabel: getStateContextLabel(metrics.topStateContext),
        averages: metrics.stateAverages,
        previousAverages: metrics.previousStateAverages,
        insight: buildWellbeingInsight(metrics, state.currentHabit.id),
        trend: buildWellbeingTrend(metrics)
      },
      forecast: forecast,
      confidence: confidence
    };
  }

  window.HabitAnalytics = {
    getInsightViewModel: getInsightViewModel
  };
})();
