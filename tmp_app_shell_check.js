
        const frameTrack = document.getElementById("frameTrack");
        const shellTabsRoot = document.getElementById("shellTabs");
        const title = document.getElementById("deviceTitle");
        const welcomeOverlay = document.getElementById("welcomeOverlay");
        const welcomeStatus = document.getElementById("welcomeStatus");
        const welcomeRestoreInput = document.getElementById("welcomeRestoreInput");
        const welcomeMode = document.getElementById("welcomeMode");
        const onboardingMode = document.getElementById("onboardingMode");
        const onboardingBackBtn = document.getElementById("onboardingBackBtn");
        const onboardingSkipBtn = document.getElementById("onboardingSkipBtn");
        const onboardingProgressBars = Array.from(document.querySelectorAll("#onboardingProgress .onboarding-progress-bar"));
        const onboardingIcon = document.getElementById("onboardingIcon");
        const onboardingTitle = document.getElementById("onboardingTitle");
        const onboardingCopy = document.getElementById("onboardingCopy");
        const onboardingCopySecondary = document.getElementById("onboardingCopySecondary");
        const onboardingStep1Body = document.getElementById("onboardingStep1Body");
        const onboardingHabitOptions = document.getElementById("onboardingHabitOptions");
        const onboardingGoalOptions = document.getElementById("onboardingGoalOptions");
        const onboardingRitualBlock = document.getElementById("onboardingRitualBlock");
        const onboardingRitualInput = document.getElementById("onboardingRitualInput");
        const onboardingRitualMeta = document.getElementById("onboardingRitualMeta");
        const onboardingNextBtn = document.getElementById("onboardingNextBtn");
        const onboardingMeta = document.getElementById("onboardingMeta");
        const shellActivePill = document.getElementById("shellActivePill");
        const shellNotice = document.getElementById("shellNotice");
        const shellNoticeText = document.getElementById("shellNoticeText");
        const shellNoticeBtn = document.getElementById("shellNoticeBtn");
        const AI_NOTICE_KEY = "habit_ai_notice_v1";
        const ONBOARDING_HABITS = [
            { id: "smoking", label: "Курение", meta: "сигареты, вейп" },
            { id: "alcohol", label: "Алкоголь", meta: "пиво, вино, крепкое" },
            { id: "social", label: "Телефон", meta: "соцсети, скроллинг" },
            { id: "custom", label: "Другое", meta: "название можно уточнить позже" }
        ];
        const ONBOARDING_GOALS = [
            {
                id: "understand_triggers",
                label: "Понять свои триггеры",
                meta: "Самый мягкий старт: сначала увидеть повторяющийся сценарий."
            },
            {
                id: "reduce_count",
                label: "Снизить количество",
                meta: "Без жёстких обещаний — просто сделать тяжёлых дней меньше."
            },
            {
                id: "take_control",
                label: "Взять под контроль",
                meta: "Подойдёт, если хочется быстрее почувствовать опору и границы."
            },
            {
                id: "stay_honest",
                label: "Быть честным с собой",
                meta: "Если пока важнее ясная картина, а не цель — это тоже хороший вход."
            }
        ];
        const ONBOARDING_STEPS = [
            {
                title: "Это не трекер.",
                copy: "Это дневник с памятью.",
                secondary: "Большинство приложений просто считают. Это — помнит твои слова, паттерны и рабочие ходы в нужный момент.",
                cta: "Понятно, продолжим",
                icon: "01"
            },
            {
                title: "С какой привычкой работаем?",
                copy: "Выбери одну — другие можно добавить позже.",
                secondary: "",
                cta: "Продолжить",
                icon: "02"
            },
            {
                title: "Какая цель на первый месяц?",
                copy: "Не нужно сразу бросать. Начни с малого — это работает лучше.",
                secondary: "",
                cta: "Продолжить",
                icon: "03"
            },
            {
                title: "Первый ориентир.",
                copy: "Что важно сохранить уже сегодня?",
                secondary: "Напиши своими словами — одно предложение. Так первый день начнётся уже не с пустого экрана, а с живой дуги.",
                cta: "Начать с этим ориентиром",
                icon: "04"
            }
        ];
        const routes = window.HabitAppCore && window.HabitAppCore.getRoutes
            ? window.HabitAppCore.getRoutes()
            : [];
        const routeMap = routes.reduce((acc, route, index) => {
            acc[route.id] = { title: route.title, index, src: route.src, tab: route.tab };
            return acc;
        }, {});
        renderFrameTrack();
        renderShellTabs();
        const shellTabs = Array.from(document.querySelectorAll(".shell-tab"));
        let currentRoute = null;
        let onboardingStep = 0;
        let onboardingSelection = {
            habitId: "smoking",
            goalId: "understand_triggers",
            ritualText: ""
        };

        function readAiNotice() {
            try {
                const raw = localStorage.getItem(AI_NOTICE_KEY);
                if (!raw) return { unread: false, text: "", createdAt: null };
                const parsed = JSON.parse(raw);
                return {
                    unread: !!parsed.unread,
                    text: String(parsed.text || ""),
                    createdAt: parsed.createdAt || null
                };
            } catch (error) {
                return { unread: false, text: "", createdAt: null };
            }
        }

        function writeAiNotice(nextState) {
            localStorage.setItem(AI_NOTICE_KEY, JSON.stringify(nextState));
            return nextState;
        }

        function applyAiNotice() {
            const notice = readAiNotice();
            const profileTab = shellTabs.find((button) => button.dataset.route === "profile");
            if (profileTab) {
                profileTab.classList.toggle("has-notification", !!notice.unread);
            }
            if (notice.unread && notice.text && currentRoute !== "profile" && currentRoute !== "ai-review") {
                shellNoticeText.textContent = notice.text;
                shellNotice.classList.add("open");
            } else {
                shellNotice.classList.remove("open");
            }
        }

        function markAiNoticeRead() {
            const notice = readAiNotice();
            if (!notice.unread) return;
            writeAiNotice({
                unread: false,
                text: notice.text,
                createdAt: notice.createdAt
            });
            applyAiNotice();
        }

        function pushAiNotice(text) {
            writeAiNotice({
                unread: true,
                text: text || "Новый AI-разбор уже сохранён в профиле.",
                createdAt: new Date().toISOString()
            });
            applyAiNotice();
        }

        function getRequestedRoute() {
            if (window.HabitAppCore && window.HabitAppCore.getInitialRoute) {
                return window.HabitAppCore.getInitialRoute(window.location.href);
            }
            return "main";
        }

        function renderFrameTrack() {
            frameTrack.style.width = `${Math.max(routes.length, 1) * 100}%`;
            frameTrack.innerHTML = routes.map((route) => {
                return `<div class="frame-pane" style="flex:0 0 ${100 / Math.max(routes.length, 1)}%;width:${100 / Math.max(routes.length, 1)}%;"><iframe id="screenFrame${route.id.replace(/(^|-)([a-z])/g, (_, dash, char) => char.toUpperCase())}" class="screen-frame" src="${route.src}" title="${route.title}"></iframe></div>`;
            }).join("");
        }

        function renderShellTabs() {
            const tabsMarkup = (window.HabitAppCore && window.HabitAppCore.getPrimaryTabs
                ? window.HabitAppCore.getPrimaryTabs()
                : []
            ).map((route, index) => {
                return `<button class="shell-tab${index === 0 ? " active" : ""}" type="button" data-route="${route.id}">${route.icon || ""}<span>${route.title}</span><span class="shell-tab-badge"></span></button>`;
            }).join("");
            shellTabsRoot.insertAdjacentHTML("beforeend", tabsMarkup);
        }

        function syncRouteInUrl(route) {
            const resolvedRoute = window.HabitAppCore && window.HabitAppCore.normalizeRoute
                ? window.HabitAppCore.normalizeRoute(route)
                : route;
            if (!routeMap[resolvedRoute]) {
                return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set("screen", resolvedRoute);
            url.hash = resolvedRoute;
            window.history.replaceState({}, "", url.toString());
        }

        function updateShellTabs(route) {
            shellTabs.forEach((button) => {
                button.classList.toggle("active", button.dataset.route === route);
            });
            requestAnimationFrame(syncActivePill);
        }

        function syncActivePill() {
            if (!shellActivePill) {
                return;
            }

            const activeTab = shellTabs.find((button) => button.classList.contains("active"));
            if (!activeTab) {
                shellActivePill.style.opacity = "0";
                return;
            }

            const pillInset = 4;
            const rootRect = shellTabsRoot.getBoundingClientRect();
            const tabRect = activeTab.getBoundingClientRect();
            const pillWidth = Math.max(0, tabRect.width - pillInset * 2);
            const x = (tabRect.left - rootRect.left) + ((tabRect.width - pillWidth) / 2);

            shellActivePill.style.opacity = "1";
            shellActivePill.style.width = `${pillWidth}px`;
            shellActivePill.style.transform = `translateX(${x}px)`;
        }

        function getStatusMessage(key, payload = {}) {
            if (window.HabitUiFeedback && window.HabitUiFeedback.getStatusMessage) {
                return window.HabitUiFeedback.getStatusMessage(key, payload);
            }
            return "";
        }

        function getStatusTone(key) {
            if (window.HabitUiFeedback && window.HabitUiFeedback.getStatusTone) {
                return window.HabitUiFeedback.getStatusTone(key);
            }
            return "neutral";
        }

        function setWelcomeStatus(message, tone = "neutral") {
            if (window.HabitUiFeedback && window.HabitUiFeedback.applyStatus) {
                window.HabitUiFeedback.applyStatus(welcomeStatus, message, tone);
                return;
            }
            welcomeStatus.textContent = message;
            welcomeStatus.dataset.tone = tone;
        }

        function setWelcomeStatusKey(key, payload = {}) {
            setWelcomeStatus(getStatusMessage(key, payload), getStatusTone(key));
        }

        function applyTrackPosition(route, immediate) {
            const screen = routeMap[route] || routeMap.main;
            if (immediate) {
                const previousTransition = frameTrack.style.transition;
                frameTrack.style.transition = "none";
                frameTrack.style.transform = `translate3d(-${screen.index * (100 / Math.max(routes.length, 1))}%, 0, 0)`;
                requestAnimationFrame(() => {
                    frameTrack.style.transition = previousTransition || "transform .5s cubic-bezier(.22,.8,.2,1)";
                });
                return;
            }

            frameTrack.style.transform = `translate3d(-${screen.index * (100 / Math.max(routes.length, 1))}%, 0, 0)`;
        }

        function setScreen(route, options = {}) {
            const resolvedRoute = routeMap[route] ? route : "main";
            const immediate = !!options.immediate;

            if (currentRoute === resolvedRoute && !immediate) {
                syncRouteInUrl(resolvedRoute);
                return;
            }

            currentRoute = resolvedRoute;
            title.textContent = routeMap[resolvedRoute].title;
            syncRouteInUrl(resolvedRoute);
            updateShellTabs(resolvedRoute);
            applyTrackPosition(resolvedRoute, immediate);
            if (resolvedRoute === "profile") {
                markAiNoticeRead();
            } else {
                applyAiNotice();
            }
        }

        function shouldShowWelcome() {
            if (!window.HabitStore || !window.HabitStore.getState) {
                return false;
            }
            const state = window.HabitStore.getState();
            const meta = state.meta || {};
            return meta.installMode === "fresh" && !meta.onboardingCompletedAt;
        }

        function switchOverlayMode(mode) {
            const showWelcome = mode === "welcome";
            welcomeMode.classList.toggle("open", showWelcome);
            onboardingMode.classList.toggle("open", !showWelcome);
        }

        function renderOnboardingStep() {
            const stepIndex = Math.max(0, Math.min(onboardingStep, ONBOARDING_STEPS.length - 1));
            const step = ONBOARDING_STEPS[stepIndex];
            switchOverlayMode("onboarding");

            onboardingBackBtn.hidden = stepIndex === 0;
            onboardingTitle.textContent = step.title;
            onboardingCopy.textContent = step.copy;
            onboardingCopySecondary.textContent = step.secondary;
            onboardingCopySecondary.style.display = step.secondary ? "block" : "none";
            onboardingIcon.textContent = step.icon;
            onboardingMeta.textContent = `${stepIndex + 1} из 4 · займёт около 2 минут`;
            onboardingNextBtn.textContent = step.cta;

            onboardingProgressBars.forEach((bar, index) => {
                bar.classList.toggle("done", index < stepIndex);
                bar.classList.toggle("active", index === stepIndex);
            });

            onboardingStep1Body.classList.toggle("open", stepIndex === 0);
            onboardingHabitOptions.classList.toggle("open", stepIndex === 1);
            onboardingGoalOptions.classList.toggle("open", stepIndex === 2);
            onboardingRitualBlock.classList.toggle("open", stepIndex === 3);

            onboardingNextBtn.disabled =
                (stepIndex === 1 && !onboardingSelection.habitId) ||
                (stepIndex === 2 && !onboardingSelection.goalId) ||
                (stepIndex === 3 && !String(onboardingSelection.ritualText || "").trim());
        }

        function renderOnboardingHabitOptions() {
            onboardingHabitOptions.innerHTML = ONBOARDING_HABITS.map((habit) => {
                const active = habit.id === onboardingSelection.habitId ? " active" : "";
                return `
                    <button class="onboarding-option${active}" type="button" data-onboarding-habit="${habit.id}">
                        <div class="onboarding-option-copy">
                            <div class="onboarding-option-title">${habit.label}</div>
                            <div class="onboarding-option-meta">${habit.meta}</div>
                        </div>
                        <span class="onboarding-option-mark"></span>
                    </button>
                `;
            }).join("");

            onboardingHabitOptions.querySelectorAll("[data-onboarding-habit]").forEach((button) => {
                button.addEventListener("click", () => {
                    onboardingSelection.habitId = button.dataset.onboardingHabit || "smoking";
                    renderOnboardingHabitOptions();
                    renderOnboardingStep();
                });
            });
        }

        function renderOnboardingGoalOptions() {
            onboardingGoalOptions.innerHTML = ONBOARDING_GOALS.map((goal) => {
                const active = goal.id === onboardingSelection.goalId ? " active" : "";
                return `
                    <button class="onboarding-option${active}" type="button" data-onboarding-goal="${goal.id}">
                        <div class="onboarding-option-copy">
                            <div class="onboarding-option-title">${goal.label}</div>
                            <div class="onboarding-option-meta">${goal.meta}</div>
                        </div>
                        <span class="onboarding-option-mark"></span>
                    </button>
                `;
            }).join("");

            onboardingGoalOptions.querySelectorAll("[data-onboarding-goal]").forEach((button) => {
                button.addEventListener("click", () => {
                    onboardingSelection.goalId = button.dataset.onboardingGoal || "understand_triggers";
                    renderOnboardingGoalOptions();
                    renderOnboardingStep();
                });
            });
        }

        function updateOnboardingRitualMeta() {
            onboardingRitualMeta.textContent = `${String(onboardingSelection.ritualText || "").length} / 120`;
        }

        function resetOnboardingState() {
            onboardingStep = 0;
            onboardingSelection = {
                habitId: "smoking",
                goalId: "understand_triggers",
                ritualText: ""
            };
            onboardingRitualInput.value = "";
            updateOnboardingRitualMeta();
            renderOnboardingHabitOptions();
            renderOnboardingGoalOptions();
            renderOnboardingStep();
        }

        function beginOnboarding() {
            resetOnboardingState();
        }

        function finishOnboarding() {
            const selectedGoal = ONBOARDING_GOALS.find((item) => item.id === onboardingSelection.goalId) || ONBOARDING_GOALS[0];
            if (window.HabitStore && window.HabitStore.selectHabit) {
                window.HabitStore.selectHabit(onboardingSelection.habitId || "smoking", "");
            }
            if (window.HabitStore && window.HabitStore.setStarterGoal) {
                window.HabitStore.setStarterGoal({
                    id: selectedGoal.id,
                    label: selectedGoal.label
                });
            }
            if (window.HabitStore && window.HabitStore.saveRitualEntry) {
                window.HabitStore.saveRitualEntry({
                    type: "morning",
                    text: String(onboardingSelection.ritualText || "").trim()
                });
            }
            if (window.HabitStore && window.HabitStore.completeOnboarding) {
                window.HabitStore.completeOnboarding({ installMode: "active" });
            } else if (window.HabitStore && window.HabitStore.setInstallMode) {
                window.HabitStore.setInstallMode("active");
            }
            closeWelcome();
            setScreen("main");
        }

        function advanceOnboarding() {
            if (onboardingStep >= ONBOARDING_STEPS.length - 1) {
                finishOnboarding();
                return;
            }
            onboardingStep += 1;
            renderOnboardingStep();
        }

        function retreatOnboarding() {
            if (onboardingStep <= 0) {
                switchOverlayMode("welcome");
                return;
            }
            onboardingStep -= 1;
            renderOnboardingStep();
        }

        function skipOnboarding() {
            if (window.HabitStore && window.HabitStore.completeOnboarding) {
                window.HabitStore.completeOnboarding({ installMode: "active" });
            } else if (window.HabitStore && window.HabitStore.setInstallMode) {
                window.HabitStore.setInstallMode("active");
            }
            closeWelcome();
            setScreen("main");
        }

        function openWelcome() {
            switchOverlayMode("welcome");
            welcomeOverlay.classList.add("open");
        }

        function closeWelcome() {
            welcomeOverlay.classList.remove("open");
        }

        function startFreshSetup() {
            beginOnboarding();
        }

        function openRestorePicker() {
            welcomeRestoreInput.value = "";
            welcomeRestoreInput.click();
        }

        function restoreFromBackup(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parsed = JSON.parse(String(reader.result || "{}"));
                    if (!window.HabitStore || !window.HabitStore.tryReplaceState) {
                        throw new Error("Store unavailable");
                    }
                    const result = window.HabitStore.tryReplaceState(parsed);
                    if (!result.ok) {
                        setWelcomeStatusKey(
                            result.errorCode === "invalid_backup" ? "restore_invalid_backup" : "restore_failed"
                        );
                        return;
                    }
                    closeWelcome();
                    setScreen("main");
                } catch (error) {
                    setWelcomeStatusKey("restore_parse_failed");
                }
            };
            reader.onerror = () => {
                setWelcomeStatusKey("restore_read_failed");
            };
            reader.readAsText(file, "utf-8");
        }

        window.addEventListener("message", (event) => {
            if (!event.data) {
                return;
            }

            if (event.data.type === "demo:ai-review-ready") {
                pushAiNotice(event.data.text || "Новый AI-разбор уже сохранён в профиле.");
                return;
            }

            if (event.data.type !== "demo:navigate") {
                return;
            }

            setScreen(event.data.route);
        });

        window.addEventListener("hashchange", () => {
            setScreen(getRequestedRoute());
        });

        shellTabs.forEach((button) => {
            button.addEventListener("click", () => setScreen(button.dataset.route));
        });
        window.addEventListener("resize", syncActivePill);

        document.getElementById("welcomeStartBtn").addEventListener("click", startFreshSetup);
        document.getElementById("welcomeRestoreBtn").addEventListener("click", openRestorePicker);
        welcomeRestoreInput.addEventListener("change", restoreFromBackup);
        onboardingBackBtn.addEventListener("click", retreatOnboarding);
        onboardingSkipBtn.addEventListener("click", skipOnboarding);
        onboardingNextBtn.addEventListener("click", advanceOnboarding);
        onboardingRitualInput.addEventListener("input", () => {
            onboardingSelection.ritualText = onboardingRitualInput.value.slice(0, 120);
            if (onboardingRitualInput.value !== onboardingSelection.ritualText) {
                onboardingRitualInput.value = onboardingSelection.ritualText;
            }
            updateOnboardingRitualMeta();
            renderOnboardingStep();
        });
        document.querySelectorAll("[data-ritual-text]").forEach((button) => {
            button.addEventListener("click", () => {
                onboardingSelection.ritualText = button.dataset.ritualText || "";
                onboardingRitualInput.value = onboardingSelection.ritualText;
                updateOnboardingRitualMeta();
                renderOnboardingStep();
            });
        });
        shellNoticeBtn.addEventListener("click", () => setScreen("profile"));

        renderOnboardingHabitOptions();
        renderOnboardingGoalOptions();
        updateOnboardingRitualMeta();
        setScreen(getRequestedRoute(), { immediate: true });
        requestAnimationFrame(syncActivePill);
        applyAiNotice();

        if (shouldShowWelcome()) {
            openWelcome();
        }
    
