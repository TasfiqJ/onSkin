import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const payloadRoot = resolve(root, 'scripts/phase5/expo-widgets-57.0.8');

function source(name) {
  return readFileSync(resolve(payloadRoot, name), 'utf8');
}

function section(value, start, end) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0, `missing section start: ${start}`);
  assert.ok(endIndex > startIndex, `missing section end: ${end}`);
  return value.slice(startIndex, endIndex);
}

test('native authority is cross-process serialized, durable, and ABA-resistant', () => {
  const store = source('LayerwellWidgetLifecycleStore.swift');
  for (const contract of [
    'flock(handle.fileDescriptor, LOCK_EX | LOCK_NB)',
    'var attemptsRemaining = 25',
    'usleep(10_000)',
    'BEGIN IMMEDIATE',
    'PRAGMA journal_mode=DELETE',
    'PRAGMA synchronous=FULL',
    'PRAGMA secure_delete=ON',
    'authority_nonce TEXT NOT NULL',
    'expectedAuthorityNonce',
    'freshOpaqueUuid(excluding:',
    'UPDATE authority SET schema_version=1, authority_nonce=?, enabled=0',
    'FileProtectionType.completeUntilFirstUserAuthentication',
  ]) {
    assert.ok(store.includes(contract), contract);
  }
  assert.equal(store.includes('var statement'), false);
  assert.equal(store.match(/sqlite3_prepare_v2/g)?.length, 1);
  assert.equal(store.includes('sqlite3_close_v2'), true);
  assert.equal(store.includes('removeItem(atPath: urls.database'), false);
  assert.equal(store.includes('maximumSafeInteger: Int64 = 9_007_199_254_740_991'), true);

  const schema = section(store, 'private static let schema =', 'private static var configuration');
  assert.equal(schema.includes('PRAGMA user_version=1'), false);
});

test('unconditional cleanup closes authority before clearing derived presentation and activities', () => {
  const store = source('LayerwellWidgetLifecycleStore.swift');
  const module = source('WidgetsModule.swift');
  const cleanup = section(
    store,
    'static func invalidateAndPurge()',
    'private static func authorizedLiveActivityProps',
  );
  assert.ok(cleanup.includes('try purgeDerivedTables(connection)'));
  assert.ok(store.includes('privacy-closing-v1'));
  assert.ok(cleanup.includes('writePrivacyClosedReceipt('));
  assert.ok(cleanup.includes('persistPrivacyClosingSentinel(urls.privacyClosing)'));
  assert.ok(store.includes('privacy-closed-v1.json'));
  assert.ok(store.includes('contents: Data()'));
  assert.ok(store.includes('try handle.synchronize()'));
  assert.ok(store.includes('try synchronizeDirectory(url.deletingLastPathComponent())'));
  assert.ok(cleanup.includes('try removeDatabaseFamily(urls.database)'));
  assert.ok(cleanup.includes('allowPrivacyClosed: true'));
  assert.ok(cleanup.includes('allowPrivacyClosing: true'));
  assert.ok(cleanup.includes('enabled=0'));
  assert.ok(cleanup.includes('owner_generation=NULL'));
  assert.ok(cleanup.includes('WidgetsStorage.removeObject(forKey: widgetTimelineKey)'));
  assert.ok(cleanup.includes('WidgetsStorage.removeObject(forKey: activityURLKey)'));
  assert.ok(cleanup.includes('WidgetCenter.shared.reloadAllTimelines()'));
  assert.equal(cleanup.includes('decodeWidgetProps'), false);
  assert.equal(cleanup.includes('dictionary(from:'), false);

  const serialization = section(
    store,
    'private struct LayerwellAuthorityReceipt',
    'private final class LayerwellStoreLock',
  );
  assert.ok(serialization.includes('try container.encodeNil(forKey: .ownerGeneration)'));
  const coordination = section(
    store,
    'private static func withExclusiveStore',
    'private static func openDatabase',
  );
  assert.equal(
    coordination.match(/FileManager\.default\.fileExists\(atPath: urls\.privacyClosed\.path\)/g)
      ?.length,
    3,
  );
  assert.equal(
    coordination.match(/FileManager\.default\.fileExists\(atPath: urls\.privacyClosing\.path\)/g)
      ?.length,
    3,
  );
  const activation = section(
    store,
    'static func activateOwner(',
    'private static func validatedPublication',
  );
  assert.ok(activation.includes('readPrivacyClosedReceipt(urls.privacyClosed)'));
  assert.ok(activation.includes('current.authorityNonce == closed.authorityNonce'));
  assert.ok(activation.includes('current.authorityNonce == expectedNonce'));
  assert.ok(activation.includes('!current.enabled'));
  assert.equal(activation.includes('closed != nil || current.authorityNonce'), false);
  assert.ok(activation.includes('currentMarker.authorityNonce == closed.authorityNonce'));
  assert.ok(activation.includes('FileManager.default.removeItem(at: urls.privacyClosed)'));
  assert.ok(
    activation.indexOf('FileManager.default.removeItem(at: urls.privacyClosed)') <
      activation.indexOf('synchronizeDirectory(urls.directory)'),
  );
  assert.equal(activation.includes('allowPrivacyClosing: true'), false);

  const closingWrite = cleanup.indexOf('persistPrivacyClosingSentinel(urls.privacyClosing)');
  const exclusiveReset = cleanup.indexOf('withExclusiveStore(');
  const closedWrite = cleanup.indexOf('writePrivacyClosedReceipt(');
  const databaseReset = cleanup.indexOf('removeDatabaseFamily(urls.database)');
  const closedVerification = cleanup.indexOf('verifiedMarker.authorityNonce');
  const closingRemoval = cleanup.indexOf('removeItem(at: urls.privacyClosing)');
  assert.ok(closingWrite >= 0 && closingWrite < exclusiveReset);
  assert.ok(exclusiveReset < closedWrite && closedWrite < databaseReset);
  assert.ok(databaseReset < closedVerification && closedVerification < closingRemoval);
  assert.equal(store.match(/allowPrivacyClosing: true/g)?.length, 2);

  const authorityRead = section(
    store,
    'static func readAuthorityJSON()',
    'static func activateOwner(',
  );
  assert.ok(
    authorityRead.indexOf('urls.privacyClosing.path') <
      authorityRead.indexOf('readPrivacyClosedReceipt(urls.privacyClosed)'),
  );
  assert.ok(activation.includes('withExclusiveStore(allowPrivacyClosed: true)'));

  const bridgeCleanup = section(
    module,
    'AsyncFunction("layerwellClearNativeState")',
    'AsyncFunction("layerwellReconcileActivities")',
  );
  assert.ok(bridgeCleanup.indexOf('invalidateAndPurge()') >= 0);
  assert.ok(bridgeCleanup.indexOf('endAllActivitiesImmediately()') >= 0);
  assert.ok(
    bridgeCleanup.indexOf('endAllActivitiesImmediately()') > bridgeCleanup.indexOf('catch'),
  );
  assert.ok(bridgeCleanup.includes('if let storageError { throw storageError }'));

  const closeAdmission = section(
    store,
    'static func closeAdmissionJSON()',
    'static func invalidateAndPurge()',
  );
  const sentinelWrite = closeAdmission.indexOf(
    'persistPrivacyClosingSentinel(urls.privacyClosing)',
  );
  const activityTask = closeAdmission.indexOf('Task(priority: .userInitiated)');
  const closeReceipt = closeAdmission.indexOf('return try canonicalJSON([');
  assert.ok(sentinelWrite >= 0 && sentinelWrite < activityTask);
  assert.ok(activityTask < closeReceipt);
  assert.ok(closeAdmission.includes('_ = await endAllActivitiesImmediately()'));
  assert.ok(closeAdmission.includes('WidgetCenter.shared.reloadTimelines(ofKind: widgetName)'));
  assert.equal(closeAdmission.includes('withExclusiveStore'), false);

  const quiescence = section(
    store,
    'static func quiesceAdmissionJSON(',
    'static func closeAdmissionJSON()',
  );
  const quiescenceLock = quiescence.indexOf('withExclusiveStore(allowPrivacyClosing: true)');
  const quiescenceSentinel = quiescence.indexOf(
    'persistPrivacyQuiescenceReceipt(quiescence, to: urls.privacyClosing)',
  );
  const quiescenceCapture = quiescence.indexOf(
    'outboxPayload(connection: connection, authority: verified)',
  );
  const emptyReceiptRevocation = quiescence.indexOf('if records.isEmpty {', quiescenceCapture);
  assert.ok(quiescenceLock >= 0 && quiescenceLock < quiescenceSentinel);
  assert.ok(quiescenceSentinel < quiescenceCapture);
  assert.ok(quiescenceCapture < emptyReceiptRevocation);
  assert.ok(
    quiescence.indexOf(
      'persistPrivacyClosingSentinel(urls.privacyClosing)',
      emptyReceiptRevocation,
    ) > emptyReceiptRevocation,
  );
  assert.ok(quiescence.includes('expectedNonce: expectedNonce'));
  assert.ok(quiescence.includes('ownerGeneration: expectedOwner'));
  assert.ok(quiescence.includes('"ownerGeneration": expectedOwner'));
  assert.ok(quiescence.includes('"quiescenceNonce": capturedOutbox.quiescenceNonce'));
  assert.ok(quiescence.includes('"status": "quiesced"'));

  const bridgeAdmission = section(
    module,
    'Function("layerwellCloseAdmissionJSON")',
    'AsyncFunction("layerwellClearNativeState")',
  );
  assert.ok(bridgeAdmission.includes('closeAdmissionJSON()'));
  assert.equal(bridgeAdmission.includes('AsyncFunction'), false);
});

test('SQLite is the sole Layerwell timeline authority with a killed-app redaction entry', () => {
  const store = source('LayerwellWidgetLifecycleStore.swift');
  const object = source('WidgetObject.swift');
  const utils = source('Utils.swift');
  const provider = source('TimelineProvider.swift');
  const entryView = source('EntryView.swift');

  const publication = section(
    store,
    'private static func validatedPublication',
    'static func publishTimelineJSON',
  );
  assert.ok(publication.includes('entries.count == 2'));
  assert.ok(publication.includes('staleTimestamp == current.staleAtMs'));
  assert.ok(publication.includes('stale.status == "stale"'));
  assert.ok(publication.includes('stale.pendingActionTokens.isEmpty'));
  assert.ok(store.includes('current_props_json TEXT NOT NULL'));
  assert.ok(store.includes('stale_props_json TEXT NOT NULL'));
  assert.ok(store.includes('if nowMs >= staleAtMs { return [staleEntry] }'));
  assert.ok(store.includes('LayerwellWidgetDeepLink'));
  assert.ok(store.includes('deepLink == configuredDeepLink'));
  assert.equal(store.includes('allowedDeepLinks'), false);
  const publish = section(
    store,
    'static func publishTimelineJSON',
    'static func publishTimelineEntries',
  );
  assert.ok(publish.includes('return "outbox_pending"'));
  assert.ok(publish.includes('return "published"'));
  assert.ok(publish.indexOf('return "outbox_pending"') < publish.indexOf('try purgeDerivedTables'));

  assert.ok(object.includes('LayerwellWidgetLifecycleStore.publishTimelineEntries'));
  assert.ok(object.includes('LayerwellWidgetLifecycleStore.currentTimelineDictionaries'));
  assert.ok(
    utils.includes(
      'timeline = (try? LayerwellWidgetLifecycleStore.currentTimelineDictionaries()) ?? []',
    ),
  );
  assert.ok(provider.includes('entries.last(where: { $0.date <= now })'));
  assert.ok(provider.includes('parsed.isEmpty ? [genericEntry()] : parsed'));
  assert.equal(provider.includes('fatalError'), false);
  assert.ok(entryView.includes('LayerwellWidgetLifecycleStore.sanitizedWidgetProps'));
});

test('AppIntent commits the native outbox and never writes Layerwell UserDefaults', () => {
  const intent = source('AppIntent.swift');
  const routine = section(
    intent,
    'private func performLayerwellInteraction',
    '@available(iOS 16.0, *)',
  );
  assert.ok(routine.includes('currentTimelineDictionaries()'));
  assert.ok(routine.includes('props.merging(result)'));
  assert.ok(routine.includes('LayerwellWidgetLifecycleStore.appendInteraction'));
  assert.equal(routine.includes('WidgetsStorage.set'), false);
  assert.equal(routine.includes('WidgetsEvents.shared.sendNotification'), false);
  assert.ok(intent.includes('@available(iOS 17.0, *)\nstruct WidgetUserInteraction'));

  const store = source('LayerwellWidgetLifecycleStore.swift');
  const append = section(store, 'static func appendInteraction(', 'static func readOutboxJSON');
  assert.ok(append.includes('stored.2 == old.canonicalJSON'));
  assert.ok(append.includes('INSERT INTO outbox'));
  assert.ok(append.includes('UPDATE snapshots SET revision=?'));
  assert.ok(append.includes('return false'));
  assert.ok(append.includes('snapshot_nonce=? AND owner_generation=? AND revision=?'));
});

test('reconciliation is exact all-or-redact and persisted rows are strictly bounded', () => {
  const store = source('LayerwellWidgetLifecycleStore.swift');
  const read = section(
    store,
    'private static func outboxPayload(',
    'static func commitReconciliationJSON',
  );
  assert.ok(read.includes('count <= Int64(maximumOutboxRecords)'));
  assert.ok(read.includes('if result == SQLITE_DONE { break }'));
  assert.ok(read.includes('guard result == SQLITE_ROW'));
  assert.ok(read.includes('record.createdAtMs < record.staleAtMs'));

  const reconcile = section(
    store,
    'static func commitReconciliationJSON',
    'static func invalidateAndPurge',
  );
  assert.ok(reconcile.includes('!sameStrings(acceptedTokens, outboxTokens)'));
  assert.ok(reconcile.includes('try purgeDerivedTables(connection)'));
  assert.ok(reconcile.includes('sameStrings(currentProps.pendingActionTokens, outboxTokens)'));
  assert.ok(reconcile.includes('canonicalRaw["pendingActionTokens"] = []'));
  assert.ok(reconcile.includes('withExclusiveStore(allowPrivacyClosing: quiesced)'));
  assert.ok(reconcile.includes('readPrivacyQuiescenceReceipt(urls.privacyClosing)'));
  assert.ok(reconcile.includes('receipt.quiescenceNonce == quiescenceNonce'));
  assert.ok(reconcile.includes('persistPrivacyClosingSentinel(urls.privacyClosing)'));
  assert.ok(reconcile.includes('commitReconciliationJSON(json, quiesced: false)'));
  assert.ok(reconcile.includes('commitReconciliationJSON(json, quiesced: true)'));
  assert.ok(
    reconcile.includes('guard sqlite3_changes(connection.handle) == Int32(outboxTokens.count)'),
  );
});

test('Live Activity APIs globally gate Layerwell and destroy aliases or duplicates', () => {
  const store = source('LayerwellWidgetLifecycleStore.swift');
  const factory = source('LiveActivityFactory.swift');
  const activity = source('LiveActivity.swift');
  const module = source('WidgetsModule.swift');
  const view = source('WidgetLiveActivity.swift');

  const decoder = section(
    store,
    'private static func decodeLiveActivityProps',
    'private static func sameStrings',
  );
  for (const field of [
    '"completedCount"',
    '"ownerGeneration"',
    '"schemaVersion"',
    '"snapshotNonce"',
    '"staleAtMs"',
    '"status"',
    '"totalCount"',
    '"updatedAtMs"',
  ]) {
    assert.ok(decoder.includes(field));
  }
  assert.ok(store.includes('data.count <= maximumLiveActivityJSONBytes'));
  assert.ok(store.includes('props.staleAtMs > nowMs'));

  const start = section(factory, 'func start(', 'func getInstances');
  assert.ok(start.includes('guard name == LayerwellWidgetLifecycleStore.activityName else'));
  assert.ok(start.includes('content: .init(state: initialState, staleDate: staleDate)'));
  assert.ok(start.includes('LayerwellWidgetLifecycleStore.authorizedDeepLink(url)'));
  assert.ok(
    start.indexOf('LayerwellWidgetLifecycleStore.authorizedDeepLink(url)') <
      start.indexOf('Activity.request('),
  );
  assert.ok(start.includes('authorizedURL.absoluteString'));
  assert.equal(start.includes('WidgetsStorage.set(url.absoluteString'), false);
  const instances = factory.slice(factory.indexOf('func getInstances'));
  assert.ok(instances.includes('guard name == LayerwellWidgetLifecycleStore.activityName else'));
  assert.ok(
    instances.includes('$0.content.state.name == LayerwellWidgetLifecycleStore.activityName'),
  );
  assert.ok(instances.includes('$0.activityState == .active'));
  assert.ok(instances.includes('.sorted { $0.id < $1.id }'));

  const update = section(activity, 'func update(', 'func end(');
  const end = section(activity, 'func end(', 'func getPushToken');
  const getPushToken = section(activity, 'func getPushToken', '@available(iOS 16.1, *)');
  for (const guarded of [update, getPushToken]) {
    assert.ok(guarded.includes('guard name == LayerwellWidgetLifecycleStore.activityName else'));
    assert.ok(guarded.includes('throw LayerwellWidgetLifecycleError.unavailable'));
    assert.ok(guarded.includes('$0.activityState == .active'));
  }
  assert.ok(activity.includes('LayerwellLiveActivityStaleException'));
  assert.ok(update.match(/LayerwellWidgetLifecycleStore\.staleDate/g)?.length >= 2);
  assert.ok(update.includes('dismissalPolicy: .immediate'));
  assert.ok(start.match(/LayerwellWidgetLifecycleStore\.staleDate/g)?.length >= 2);
  assert.ok(start.includes('Task(priority: .userInitiated)'));
  assert.ok(start.includes('dismissalPolicy: .immediate'));
  assert.ok(getPushToken.includes('LiveActivityFactory.pushNotificationsEnabled'));
  assert.ok(getPushToken.includes('LayerwellWidgetLifecycleStore.staleDate'));
  assert.ok(activity.includes('for await data in activity.pushTokenUpdates'));
  assert.ok(
    activity.indexOf('LayerwellWidgetLifecycleStore.staleDate(', activity.indexOf('for await')) <
      activity.indexOf('emit(event: onTokenReceived', activity.indexOf('for await')),
  );
  assert.equal(module.includes('Activity<LiveActivityAttributes>.pushToStartToken'), false);
  assert.equal(module.includes('observePushToStartToken()'), false);
  assert.equal(module.includes('sendPushToStartToken('), false);
  assert.equal(
    end.includes('guard name == LayerwellWidgetLifecycleStore.activityName else'),
    false,
  );
  assert.ok(end.includes('$0.id == id'));
  assert.equal(end.includes('$0.content.state.name == name'), false);
  assert.ok(end.includes('name: LayerwellWidgetLifecycleStore.activityName'));
  assert.ok(end.includes('props: "{}"'));
  assert.ok(end.includes('ActivityContent(state: finalState, staleDate: Date())'));
  assert.ok(end.includes('dismissalPolicy: .immediate'));

  const authorization = section(
    store,
    'private static func authorizedLiveActivityProps',
    'static func staleDate',
  );
  assert.ok(
    authorization.includes(
      'guard name == activityName else { throw LayerwellWidgetLifecycleError.unavailable }',
    ),
  );
  const sanitizer = section(
    store,
    'static func sanitizedLiveActivityProps',
    '@available(iOS 16.2, *)',
  );
  assert.ok(sanitizer.includes('guard name == activityName else { return "{}" }'));
  assert.equal(sanitizer.includes('guard name == activityName else { return propsJSON }'), false);

  const cleanup = section(
    store,
    'static func endAllActivitiesImmediately()',
    'static func reconcileActivities()',
  );
  assert.ok(cleanup.includes('let activities = Activity<LiveActivityAttributes>.activities'));
  assert.equal(cleanup.includes('.filter'), false);

  const reconcile = store.slice(store.indexOf('static func reconcileActivities()'));
  assert.ok(reconcile.includes('let activities = Activity<LiveActivityAttributes>.activities'));
  assert.ok(reconcile.includes('.sorted { $0.id < $1.id }'));
  assert.equal(reconcile.includes('.filter'), false);
  assert.ok(reconcile.includes('if state.name == activityName'));
  assert.ok(reconcile.includes('activity.activityState == .active'));
  assert.ok(reconcile.includes('kept == 0'));
  assert.ok(view.includes('isSystemStale: context.isStale'));
});

test('signed flags remain literal false and cleanup does not consult them', () => {
  const plugin = readFileSync(
    resolve(root, 'apps/mobile/plugins/withLayerwellWidgetPrivacyManifest.js'),
    'utf8',
  );
  const store = source('LayerwellWidgetLifecycleStore.swift');
  assert.match(plugin, /infoPlist\[WIDGET_PUBLICATION_ENABLED_KEY\] = false/);
  assert.match(plugin, /infoPlist\[LIVE_ACTIVITY_START_ENABLED_KEY\] = false/);
  assert.match(plugin, /infoPlist\[WIDGET_DEEP_LINK_KEY\] = deepLink/);
  assert.ok(store.includes('LayerwellWidgetInteractivePublicationEnabled'));
  assert.ok(store.includes('LayerwellLiveActivityStartEnabled'));
  const cleanup = section(
    store,
    'static func invalidateAndPurge()',
    'private static func authorizedLiveActivityProps',
  );
  assert.equal(cleanup.includes('publicationIsEnabled'), false);
  assert.equal(cleanup.includes('liveActivityIsEnabled'), false);
});

test('the exact dependency patch links SQLite and exposes only bounded JSON bridge methods', () => {
  const podspec = source('ExpoWidgets.podspec');
  const module = source('WidgetsModule.swift');
  assert.ok(podspec.includes("s.libraries = 'sqlite3'"));
  for (const method of [
    'layerwellReadAuthorityJSON',
    'layerwellActivateOwnerGeneration',
    'layerwellPublishTimelineJSON',
    'layerwellReadTimelineJSON',
    'layerwellReadOutboxJSON',
    'layerwellCommitReconciliationJSON',
    'layerwellCommitQuiescedReconciliationJSON',
    'layerwellCloseAdmissionJSON',
    'layerwellQuiesceAdmissionJSON',
    'layerwellClearNativeState',
    'layerwellReconcileActivities',
  ]) {
    assert.ok(module.includes(`"${method}"`), method);
  }
  assert.equal(source('LayerwellWidgetLifecycleStore.swift').includes('userId'), false);
  assert.equal(source('LayerwellWidgetLifecycleStore.swift').includes('accountId'), false);
  assert.equal(source('LayerwellWidgetLifecycleStore.swift').includes('productId'), false);
});
