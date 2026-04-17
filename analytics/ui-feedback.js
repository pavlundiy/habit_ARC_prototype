(function () {
  var toastTimers = typeof WeakMap === "function" ? new WeakMap() : null;

  function getStatusMessage(key, payload) {
    if (window.HabitStore && window.HabitStore.helpers && typeof window.HabitStore.helpers.getStatusMessage === "function") {
      return window.HabitStore.helpers.getStatusMessage(key, payload || {});
    }
    return "";
  }

  function getStatusTone(key) {
    if (window.HabitStore && window.HabitStore.helpers && typeof window.HabitStore.helpers.getStatusTone === "function") {
      return window.HabitStore.helpers.getStatusTone(key);
    }
    return "neutral";
  }

  function applyStatus(target, message, tone) {
    var node = typeof target === "string" ? document.querySelector(target) : target;
    if (!node) return false;
    node.textContent = message || "";
    node.dataset.tone = tone || "neutral";
    return true;
  }

  function applyStatusKey(target, key, payload) {
    return applyStatus(target, getStatusMessage(key, payload), getStatusTone(key));
  }

  function showToast(target, message, options) {
    var node = typeof target === "string" ? document.querySelector(target) : target;
    var opts = options || {};
    var hiddenClass = opts.hiddenClass || "hidden";
    var duration = typeof opts.duration === "number" ? opts.duration : 3000;
    var timer = null;
    if (!node) return false;

    node.textContent = message || "";
    node.classList.remove(hiddenClass);

    if (toastTimers) {
      timer = toastTimers.get(node);
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        node.classList.add(hiddenClass);
      }, duration);
      toastTimers.set(node, timer);
      return true;
    }

    if (node.__habitToastTimer) clearTimeout(node.__habitToastTimer);
    node.__habitToastTimer = setTimeout(function () {
      node.classList.add(hiddenClass);
    }, duration);
    return true;
  }

  function getUiCopy(key) {
    var copy = {
      onboarding_first_event: "Начни с первой записи. Одной из двух кнопок ниже уже достаточно."
    };
    return copy[key] || "";
  }

  window.HabitUiFeedback = {
    getStatusMessage: getStatusMessage,
    getStatusTone: getStatusTone,
    applyStatus: applyStatus,
    applyStatusKey: applyStatusKey,
    showToast: showToast,
    getUiCopy: getUiCopy
  };
})();
