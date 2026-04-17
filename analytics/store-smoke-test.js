const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createLocalStorage(seed) {
  const store = new Map(Object.entries(seed || {}));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function loadStore(seedStorage) {
  const localStorage = createLocalStorage(seedStorage);
  const windowObject = {
    addEventListener() {},
    removeEventListener() {}
  };

  const context = {
    window: windowObject,
    localStorage,
    BroadcastChannel: undefined,
    console,
    JSON,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isFinite,
    setTimeout,
    clearTimeout
  };

  windowObject.window = windowObject;
  context.global = context;
  context.globalThis = context;

  const source = fs.readFileSync(path.join(__dirname, "store.js"), "utf8");
  vm.runInNewContext(source, context, { filename: "store.js" });

  return {
    HabitStore: context.window.HabitStore,
    localStorage
  };
}

function testFreshStateNormalization() {
  const env = loadStore();
  const snapshot = env.HabitStore.getState();

  assert.equal(snapshot.version, 5, "fresh state should use version 5");
  assert.equal(snapshot.meta.stateVersion, 5, "meta.stateVersion should be 5");
  assert.equal(snapshot.currentHabit.id, "smoking", "default active habit should be smoking");
}

function testBrokenJsonFallback() {
  const env = loadStore({
    habit_mvp_shared_state_v3: "{bad json"
  });
  const snapshot = env.HabitStore.getState();

  assert.equal(snapshot.version, 5, "broken JSON should fall back to normalized state");
  assert.equal(snapshot.meta.stateVersion, 5, "fallback state should still be stamped");
}

function testReplaceStateRejectsInvalidPayload() {
  const env = loadStore();
  assert.throws(
    () => env.HabitStore.replaceState({ foo: "bar" }),
    /Invalid habit state payload/,
    "replaceState should reject unrelated JSON payloads"
  );
}

function testTryReplaceStateReturnsStructuredError() {
  const env = loadStore();
  const result = env.HabitStore.tryReplaceState({ foo: "bar" });

  assert.equal(result.ok, false, "tryReplaceState should fail gracefully on unrelated JSON");
  assert.equal(result.errorCode, "invalid_backup", "tryReplaceState should expose invalid_backup code");
}

function testReplaceStateNormalizesPartialBackup() {
  const env = loadStore();
  const snapshot = env.HabitStore.replaceState({
    version: 1,
    profile: {
      userName: "Тест",
      initials: "ТЕ",
      activeHabitId: "social"
    },
    habitTracks: {
      social: {
        slips: [],
        resisted: [],
        diaryEntries: []
      }
    }
  });

  assert.equal(snapshot.currentHabit.id, "social", "partial backup should preserve active habit");
  assert.equal(snapshot.version, 5, "partial backup should be migrated to current version");
  assert.equal(snapshot.meta.stateVersion, 5, "migrated backup should be stamped");
}

function testExportRawStateStampsVersion() {
  const env = loadStore();
  const exported = env.HabitStore.exportRawState();

  assert.equal(exported.version, 5, "exported state should be versioned");
  assert.equal(exported.meta.stateVersion, 5, "exported state should carry meta.stateVersion");
}

function testDiarySummarySelector() {
  const env = loadStore();
  env.HabitStore.addDiaryEntry({
    entryType: "free_note",
    entryScope: "habit",
    text: "Первая мысль"
  });
  env.HabitStore.addDiaryEntry({
    entryType: "state_note",
    entryScope: "state",
    text: "Мало сна",
    moodScore: 2,
    energyScore: 2,
    stressScore: 4
  });

  const summary = env.HabitStore.helpers.getDiarySummary(env.HabitStore.getState());
  assert.equal(summary.totalCount, 2, "diary summary should count all entries");
  assert.equal(summary.habitCount, 1, "diary summary should count habit entries");
  assert.equal(summary.stateCount, 1, "diary summary should count state entries");
}

function testBackupRestoreRoundTrip() {
  const source = loadStore();
  source.HabitStore.recordSlip({ triggerTag: "stress", triggerTags: ["stress"] });
  source.HabitStore.addDiaryEntry({
    entryType: "state_note",
    entryScope: "state",
    text: "Сложный день",
    moodScore: 2,
    energyScore: 2,
    stressScore: 5
  });

  const backup = source.HabitStore.exportRawState();
  const target = loadStore();
  const restored = target.HabitStore.replaceState(backup);
  const summary = target.HabitStore.helpers.getDiarySummary(restored);

  assert.equal(restored.slips.length, 1, "round-trip restore should preserve slips");
  assert.equal(summary.stateCount, 1, "round-trip restore should preserve state diary entries");
  assert.equal(restored.meta.stateVersion, 5, "round-trip restore should keep stamped version");
}

function testRitualClosureRoundTrip() {
  const source = loadStore();
  source.HabitStore.saveRitualEntry({
    type: "morning",
    text: "РЎРїРѕРєРѕР№РЅРѕ РїСЂРѕР№С‚Рё РїРѕСЃР»Рµ РѕР±РµРґР°"
  });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const localDate = source.HabitStore.helpers.formatDateKey(yesterday);
  source.HabitStore.replaceState({
    ...source.HabitStore.exportRawState(),
    habitTracks: {
      smoking: {
        slips: [],
        resisted: [],
        diaryEntries: [],
        ritualEntries: [
          {
            id: "ritual_yesterday",
            type: "morning",
            text: "РЎРїРѕРєРѕР№СЃС‚РІРёРµ РїРѕСЃР»Рµ РѕР±РµРґР°",
            timestamp: yesterday.toISOString(),
            localDate
          }
        ],
        ritualClosures: []
      }
    }
  });
  source.HabitStore.saveRitualClosure({
    localDate,
    status: "partial",
    note: "Р”РµРЅСЊ Р±С‹Р» РЅРµСЂРѕРІРЅС‹Рј"
  });

  const backup = source.HabitStore.exportRawState();
  const target = loadStore();
  const restored = target.HabitStore.replaceState(backup);

  assert.equal(restored.ritualClosures.length, 1, "ritual closure should survive round-trip restore");
  assert.equal(restored.ritualClosures[0].status, "partial", "ritual closure should preserve status");
}

testFreshStateNormalization();
testBrokenJsonFallback();
testReplaceStateRejectsInvalidPayload();
testTryReplaceStateReturnsStructuredError();
testReplaceStateNormalizesPartialBackup();
testExportRawStateStampsVersion();
testDiarySummarySelector();
testBackupRestoreRoundTrip();
testRitualClosureRoundTrip();

console.log("store smoke tests passed");
