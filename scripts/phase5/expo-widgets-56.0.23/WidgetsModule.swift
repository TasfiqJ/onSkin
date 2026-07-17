import ExpoModulesCore
import WidgetKit

let pushNotificationsEnabledKey: String = "ExpoWidgets_EnablePushNotifications"

let onUserInteraction = "onExpoWidgetsUserInteraction"
let onPushToStartTokenReceived = "onExpoWidgetsPushToStartTokenReceived"
let onTokenReceived = "onExpoWidgetsTokenReceived"
let onUserInteractionNotification = Notification.Name(onUserInteraction)

public final class WidgetsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWidgets")

    Events(onPushToStartTokenReceived, onTokenReceived, onUserInteraction)

    OnStartObserving(onUserInteraction) {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(handleUserInteractionNotification),
        name: onUserInteractionNotification,
        object: nil
      )
    }

    OnStopObserving(onUserInteraction) {
      NotificationCenter.default.removeObserver(
        self,
        name: onUserInteractionNotification,
        object: nil
      )
    }

    // Global push-to-start tokens are not scoped to a RoutineKind owner and
    // cannot be revoked by the privacy-closing sentinel. Keep the event name
    // registered for API compatibility, but never observe or emit this token.

    Constant("widgetsDirectory") { () -> String? in
      guard let appGroupIdentifier = WidgetsStorage.appGroupIdentifier,
            let containerUrl = FileManager.default.containerURL(
              forSecurityApplicationGroupIdentifier: appGroupIdentifier
            ) else {
        return nil
      }
      let directoryUrl = containerUrl.appendingPathComponent("ExpoWidgets", isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: directoryUrl, withIntermediateDirectories: true)
        return directoryUrl.absoluteString
      } catch {
        return nil
      }
    }

    Constant("routineKindWidgetLifecycleVersion") {
      RoutineKindWidgetLifecycleStore.nativeSchemaVersion
    }

    Constant("routineKindWidgetLifecycleConfigured") {
      RoutineKindWidgetLifecycleStore.nativeStateIsConfigured
    }

    Function("reloadAllWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("routineKindReadAuthorityJSON") { () -> String in
      try RoutineKindWidgetLifecycleStore.readAuthorityJSON()
    }

    Function("routineKindActivateOwnerGeneration") {
      (expectedAuthorityNonce: String, ownerGeneration: String) -> String in
      try RoutineKindWidgetLifecycleStore.activateOwner(
        expectedAuthorityNonce: expectedAuthorityNonce,
        ownerGeneration: ownerGeneration
      )
    }

    Function("routineKindPublishTimelineJSON") {
      (expectedAuthorityNonce: String, timelineJSON: String) -> String in
      try RoutineKindWidgetLifecycleStore.publishTimelineJSON(
        expectedAuthorityNonce: expectedAuthorityNonce,
        timelineJSON: timelineJSON
      )
    }

    Function("routineKindReadTimelineJSON") { (expectedAuthorityNonce: String) -> String in
      try RoutineKindWidgetLifecycleStore.currentTimelineJSON(
        expectedAuthorityNonce: expectedAuthorityNonce
      )
    }

    Function("routineKindReadOutboxJSON") { (expectedAuthorityNonce: String) -> String in
      try RoutineKindWidgetLifecycleStore.readOutboxJSON(
        expectedAuthorityNonce: expectedAuthorityNonce
      )
    }

    Function("routineKindCommitReconciliationJSON") { (json: String) -> String in
      try RoutineKindWidgetLifecycleStore.commitReconciliationJSON(json)
    }

    Function("routineKindCommitQuiescedReconciliationJSON") { (json: String) -> String in
      try RoutineKindWidgetLifecycleStore.commitQuiescedReconciliationJSON(json)
    }

    Function("routineKindCloseAdmissionJSON") { () -> String in
      try RoutineKindWidgetLifecycleStore.closeAdmissionJSON()
    }

    Function("routineKindQuiesceAdmissionJSON") {
      (expectedAuthorityNonce: String, ownerGeneration: String) -> String in
      try RoutineKindWidgetLifecycleStore.quiesceAdmissionJSON(
        expectedAuthorityNonce: expectedAuthorityNonce,
        ownerGeneration: ownerGeneration
      )
    }

    AsyncFunction("routineKindClearNativeState") { () async throws -> String in
      var storageReceipt: String?
      var storageError: Error?
      do {
        storageReceipt = try RoutineKindWidgetLifecycleStore.invalidateAndPurge()
      } catch {
        storageError = error
      }
      let endedActivities: Int
      if #available(iOS 16.2, *) {
        endedActivities = await RoutineKindWidgetLifecycleStore.endAllActivitiesImmediately()
      } else {
        endedActivities = 0
      }
      if let storageError { throw storageError }
      guard let storageReceipt,
            let receiptData = storageReceipt.data(using: .utf8),
            let receipt = try JSONSerialization.jsonObject(with: receiptData) as? [String: Any]
      else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      let result: [String: Any] = [
        "authority": receipt,
        "endedActivities": endedActivities,
        "schemaVersion": RoutineKindWidgetLifecycleStore.nativeSchemaVersion
      ]
      let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
      guard let json = String(data: data, encoding: .utf8) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      return json
    }

    AsyncFunction("routineKindReconcileActivities") { () async -> [String: Int] in
      guard #available(iOS 16.2, *) else { return ["kept": 0, "ended": 0] }
      return await RoutineKindWidgetLifecycleStore.reconcileActivities()
    }

    Class("Widget", WidgetObject.self) {
      Constructor { (name: String, layout: String) in
        WidgetObject(name: name, layout: layout)
      }

      Function("reload") { (widget: WidgetObject) in
        widget.reload()
      }

      Function("updateTimeline") { (widget: WidgetObject, entries: [WidgetsJSTimelineEntry]) in
        try widget.updateTimeline(entries: entries)
      }

      Function("getTimeline") { (widget: WidgetObject) in
        try widget.getTimeline()
      }
    }

    Class("LiveActivityFactory", LiveActivityFactory.self) {
      Constructor { (name: String, layout: String) in
        LiveActivityFactory(name: name, layout: layout)
      }

      Function("start") { (liveActivity: LiveActivityFactory, props: String, url: URL?) in
        try liveActivity.start(props: props, url: url)
      }

      Function("getInstances") { (liveActivity: LiveActivityFactory) in
        try liveActivity.getInstances()
      }
    }

    Class("LiveActivity", LiveActivity.self) {
      AsyncFunction("update") { (instance: LiveActivity, props: String) in
        try await instance.update(props: props)
      }

      AsyncFunction("end") {
        (
          instance: LiveActivity,
          dismissalPolicy: LiveActivityDismissalPolicy?,
          afterDate: Date?,
          props: String?,
          contentDate: Date?
        ) in
        try await instance.end(
          dismissalPolicy: dismissalPolicy,
          afterDate: afterDate,
          props: props,
          contentDate: contentDate
        )
      }

      AsyncFunction("getPushToken") { (instance: LiveActivity) in
        try instance.getPushToken()
      }
    }
  }

  @objc func handleUserInteractionNotification(_ notification: Notification) {
    guard let userInfo = notification.userInfo as? [String: Any],
          let eventData = userInfo["eventData"] as? [String: Any] else { return }
    sendEvent(onUserInteraction, eventData)
  }

}
