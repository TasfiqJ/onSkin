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

    // Global push-to-start tokens are not scoped to a Layerwell owner and
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

    Constant("layerwellWidgetLifecycleVersion") {
      LayerwellWidgetLifecycleStore.nativeSchemaVersion
    }

    Constant("layerwellWidgetLifecycleConfigured") {
      LayerwellWidgetLifecycleStore.nativeStateIsConfigured
    }

    Function("reloadAllWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("layerwellReadAuthorityJSON") { () -> String in
      try LayerwellWidgetLifecycleStore.readAuthorityJSON()
    }

    Function("layerwellActivateOwnerGeneration") {
      (expectedAuthorityNonce: String, ownerGeneration: String) -> String in
      try LayerwellWidgetLifecycleStore.activateOwner(
        expectedAuthorityNonce: expectedAuthorityNonce,
        ownerGeneration: ownerGeneration
      )
    }

    Function("layerwellPublishTimelineJSON") {
      (expectedAuthorityNonce: String, timelineJSON: String) -> String in
      try LayerwellWidgetLifecycleStore.publishTimelineJSON(
        expectedAuthorityNonce: expectedAuthorityNonce,
        timelineJSON: timelineJSON
      )
    }

    Function("layerwellReadTimelineJSON") { (expectedAuthorityNonce: String) -> String in
      try LayerwellWidgetLifecycleStore.currentTimelineJSON(
        expectedAuthorityNonce: expectedAuthorityNonce
      )
    }

    Function("layerwellReadOutboxJSON") { (expectedAuthorityNonce: String) -> String in
      try LayerwellWidgetLifecycleStore.readOutboxJSON(
        expectedAuthorityNonce: expectedAuthorityNonce
      )
    }

    Function("layerwellCommitReconciliationJSON") { (json: String) -> String in
      try LayerwellWidgetLifecycleStore.commitReconciliationJSON(json)
    }

    Function("layerwellCommitQuiescedReconciliationJSON") { (json: String) -> String in
      try LayerwellWidgetLifecycleStore.commitQuiescedReconciliationJSON(json)
    }

    Function("layerwellCloseAdmissionJSON") { () -> String in
      try LayerwellWidgetLifecycleStore.closeAdmissionJSON()
    }

    Function("layerwellQuiesceAdmissionJSON") {
      (expectedAuthorityNonce: String, ownerGeneration: String) -> String in
      try LayerwellWidgetLifecycleStore.quiesceAdmissionJSON(
        expectedAuthorityNonce: expectedAuthorityNonce,
        ownerGeneration: ownerGeneration
      )
    }

    AsyncFunction("layerwellClearNativeState") { () async throws -> String in
      var storageReceipt: String?
      var storageError: Error?
      do {
        storageReceipt = try LayerwellWidgetLifecycleStore.invalidateAndPurge()
      } catch {
        storageError = error
      }
      let endedActivities: Int
      if #available(iOS 16.2, *) {
        endedActivities = await LayerwellWidgetLifecycleStore.endAllActivitiesImmediately()
      } else {
        endedActivities = 0
      }
      if let storageError { throw storageError }
      guard let storageReceipt,
            let receiptData = storageReceipt.data(using: .utf8),
            let receipt = try JSONSerialization.jsonObject(with: receiptData) as? [String: Any]
      else {
        throw LayerwellWidgetLifecycleError.storage
      }
      let result: [String: Any] = [
        "authority": receipt,
        "endedActivities": endedActivities,
        "schemaVersion": LayerwellWidgetLifecycleStore.nativeSchemaVersion
      ]
      let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
      guard let json = String(data: data, encoding: .utf8) else {
        throw LayerwellWidgetLifecycleError.storage
      }
      return json
    }

    AsyncFunction("layerwellReconcileActivities") { () async -> [String: Int] in
      guard #available(iOS 16.2, *) else { return ["kept": 0, "ended": 0] }
      return await LayerwellWidgetLifecycleStore.reconcileActivities()
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
