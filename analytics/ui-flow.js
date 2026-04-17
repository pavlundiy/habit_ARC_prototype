(function () {
  var ONBOARDING_INTENT_KEY = "habit_onboarding_intent_v1";

  function getStoreHelperResult(name, state, fallback) {
    if (window.HabitStore && window.HabitStore.helpers && typeof window.HabitStore.helpers[name] === "function") {
      return window.HabitStore.helpers[name](state);
    }
    return fallback;
  }

  function getSetupModel(state) {
    return getStoreHelperResult("getSetupProgress", state, { completed: 0, total: 3, progress: 0, nextStep: null });
  }

  function getFirstWeekModel(state) {
    return getStoreHelperResult("getFirstWeekJourney", state, { active: false, completed: 0, total: 4, progress: 0 });
  }

  function getFirstWeekSupport(state) {
    return getStoreHelperResult("getFirstWeekSupport", state, { review: null });
  }

  function setOnboardingIntent(intent) {
    try {
      localStorage.setItem(ONBOARDING_INTENT_KEY, intent);
      return true;
    } catch (error) {
      return false;
    }
  }

  function consumeOnboardingIntent() {
    try {
      var intent = localStorage.getItem(ONBOARDING_INTENT_KEY);
      if (!intent) return null;
      localStorage.removeItem(ONBOARDING_INTENT_KEY);
      return intent;
    } catch (error) {
      return null;
    }
  }

  function navigate(route) {
    if (window.DemoNavigation && typeof window.DemoNavigation.navigate === "function") {
      window.DemoNavigation.navigate(route);
      return true;
    }
    return false;
  }

  function openSetupNextStep(options) {
    options = options || {};
    var state = options.state || (window.HabitStore && typeof window.HabitStore.getState === "function"
      ? window.HabitStore.getState()
      : null);
    var setup = options.setup || getSetupModel(state);
    if (!setup.nextStep) return false;

    if (setup.nextStep.id === "first_event") {
      if (typeof options.onFirstEvent === "function") {
        options.onFirstEvent(setup, state);
        return true;
      }
      return navigate(options.firstEventRoute || "main");
    }

    var intent = setup.nextStep.id === "assessment" ? "assessment" : "context";

    if (typeof options.onIntent === "function") {
      options.onIntent(intent, setup, state);
      return true;
    }

    setOnboardingIntent(intent);
    return navigate(options.intentRoute || "profile");
  }

  function openProfileSetupNextStep(options) {
    options = options || {};
    return openSetupNextStep({
      state: options.state,
      firstEventRoute: options.firstEventRoute || "main",
      onFirstEvent: options.onFirstEvent,
      onIntent: function (intent) {
        if (intent === "assessment" && typeof options.openAssessment === "function") {
          options.openAssessment();
          return;
        }
        if (intent === "context" && typeof options.openContext === "function") {
          options.openContext();
          return;
        }
        if (intent === "habit" && typeof options.openHabit === "function") {
          options.openHabit();
          return;
        }
        setOnboardingIntent(intent);
        navigate(options.intentRoute || "profile");
      }
    });
  }

  function applyProfileOnboardingIntent(options) {
    options = options || {};
    var intent = consumeOnboardingIntent();
    if (!intent) return null;
    if (intent === "assessment" && typeof options.openAssessment === "function") {
      options.openAssessment();
    } else if (intent === "context" && typeof options.openContext === "function") {
      options.openContext();
    } else if (intent === "habit" && typeof options.openHabit === "function") {
      options.openHabit();
    }
    return intent;
  }

  window.HabitUiFlow = {
    ONBOARDING_INTENT_KEY: ONBOARDING_INTENT_KEY,
    getStoreHelperResult: getStoreHelperResult,
    getSetupModel: getSetupModel,
    getFirstWeekModel: getFirstWeekModel,
    getFirstWeekSupport: getFirstWeekSupport,
    setOnboardingIntent: setOnboardingIntent,
    consumeOnboardingIntent: consumeOnboardingIntent,
    openSetupNextStep: openSetupNextStep,
    openProfileSetupNextStep: openProfileSetupNextStep,
    applyProfileOnboardingIntent: applyProfileOnboardingIntent
  };
})();
