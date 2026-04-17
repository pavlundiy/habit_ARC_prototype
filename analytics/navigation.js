(function () {
  function navigate(route) {
    var resolvedRoute = window.HabitAppCore && window.HabitAppCore.normalizeRoute
      ? window.HabitAppCore.normalizeRoute(route)
      : route;
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: "demo:navigate", route: resolvedRoute }, "*");
      } catch (error) {
        // Ignore navigation bridge errors in standalone mode.
      }
    }
  }

  function initBottomTabs() {
    var tabs = Array.from(document.querySelectorAll(".tab[data-route]"));
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        navigate(tab.dataset.route);
      });
    });
  }

  window.DemoNavigation = {
    navigate: navigate,
    initBottomTabs: initBottomTabs
  };
})();
