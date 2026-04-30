(function () {
  function buildStandaloneUrl(route) {
    var meta = window.HabitAppCore && window.HabitAppCore.getRouteMeta
      ? window.HabitAppCore.getRouteMeta(route)
      : null;
    if (!meta || !meta.src) return null;
    var src = String(meta.src);
    var fileName = src.split("/").pop();
    var href = String(window.location && window.location.href || "");
    if (href.indexOf("/imported-designs/") >= 0) {
      return new URL("./" + fileName, href).toString();
    }
    return new URL("./" + src, href).toString();
  }

  function navigate(route, options) {
    var resolvedRoute = window.HabitAppCore && window.HabitAppCore.normalizeRoute
      ? window.HabitAppCore.normalizeRoute(route)
      : route;
    var navOptions = options || {};
    if (window.parent && window.parent !== window) {
      try {
        if (window.parent.HabitShellSetScreen) {
          window.parent.HabitShellSetScreen(resolvedRoute, navOptions);
          return;
        }
        window.parent.postMessage({ type: "demo:navigate", route: resolvedRoute, options: navOptions }, "*");
      } catch (error) {
        // Ignore navigation bridge errors in standalone mode.
      }
      return;
    }
    var standaloneUrl = buildStandaloneUrl(resolvedRoute);
    if (standaloneUrl) {
      window.location.href = standaloneUrl;
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
