(function () {
  var routes = [
    {
      id: "main",
      title: "Главная",
      src: "imported-designs/habit_tracker_live.html",
      tab: true,
      icon:
        '<svg class="shell-tab-icon" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>'
    },
    {
      id: "insights",
      title: "Инсайты",
      src: "imported-designs/insights_screen_connected.html",
      tab: true,
      icon:
        '<svg class="shell-tab-icon" viewBox="0 0 16 16" fill="none"><path d="M8 2a4 4 0 010 8M8 10v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>'
    },
    {
      id: "diary",
      title: "Дневник",
      src: "imported-designs/habit_diary_live.html",
      tab: true,
      icon:
        '<svg class="shell-tab-icon" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 6h4M6 9h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
    },
    {
      id: "profile",
      title: "Профиль",
      src: "imported-designs/profile_live.html",
      tab: true,
      icon:
        '<svg class="shell-tab-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: "ai-review",
      title: "AI-разбор",
      src: "imported-designs/ai_review_live.html",
      tab: false
    }
  ];

  function getRoutes() {
    return routes.slice();
  }

  function getRouteMeta(routeId) {
    return routes.find(function (route) {
      return route.id === routeId;
    }) || routes[0];
  }

  function normalizeRoute(routeId) {
    return getRouteMeta(routeId).id;
  }

  function getRouteIndex(routeId) {
    return routes.findIndex(function (route) {
      return route.id === normalizeRoute(routeId);
    });
  }

  function getPrimaryTabs() {
    return routes.filter(function (route) {
      return route.tab;
    });
  }

  function getInitialRoute(locationLike) {
    var url = new URL(locationLike || window.location.href);
    var fromQuery = url.searchParams.get("screen");
    if (fromQuery) {
      return normalizeRoute(fromQuery);
    }
    var fromHash = String(url.hash || "").replace(/^#/, "");
    if (fromHash) {
      return normalizeRoute(fromHash);
    }
    return routes[0].id;
  }

  window.HabitAppCore = {
    getRoutes: getRoutes,
    getRouteMeta: getRouteMeta,
    getRouteIndex: getRouteIndex,
    getPrimaryTabs: getPrimaryTabs,
    normalizeRoute: normalizeRoute,
    getInitialRoute: getInitialRoute
  };
})();
