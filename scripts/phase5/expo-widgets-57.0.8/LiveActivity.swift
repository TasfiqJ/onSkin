import ActivityKit
import ExpoModulesCore

final class LayerwellLiveActivityStaleException: Exception, @unchecked Sendable {
  override var reason: String {
    "Layerwell Live Activity authorization changed during publication"
  }
}

final class LiveActivity: SharedObject {
  let id: String
  let name: String
  private var pushTokenObserverTask: Task<Void, Never>?

  init(id: String, name: String) {
    self.id = id
    self.name = name
    super.init()
  }

  func update(props: String) async throws {
    guard #available(iOS 16.2, *) else { throw LiveActivitiesNotSupportedException() }
    guard name == LayerwellWidgetLifecycleStore.activityName else {
      throw LayerwellWidgetLifecycleError.unavailable
    }

    guard let activity = Activity<LiveActivityAttributes>.activities.first(where: {
      $0.id == id && $0.content.state.name == name && $0.activityState == .active
    }) else {
      throw LiveActivityNotFoundException(id)
    }

    let staleDate: Date?
    do {
      staleDate = try LayerwellWidgetLifecycleStore.staleDate(name: name, propsJSON: props)
    } catch LayerwellWidgetLifecycleError.stale {
      throw LayerwellLiveActivityStaleException()
    } catch LayerwellWidgetLifecycleError.unauthorized {
      throw LayerwellLiveActivityStaleException()
    }
    let newState = LiveActivityAttributes.ContentState(name: name, props: props)
    await activity.update(ActivityContent(state: newState, staleDate: staleDate))
    do {
      _ = try LayerwellWidgetLifecycleStore.staleDate(name: name, propsJSON: props)
    } catch LayerwellWidgetLifecycleError.stale {
      let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
      await activity.end(
        ActivityContent(state: finalState, staleDate: Date()),
        dismissalPolicy: .immediate
      )
      throw LayerwellLiveActivityStaleException()
    } catch LayerwellWidgetLifecycleError.unauthorized {
      let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
      await activity.end(
        ActivityContent(state: finalState, staleDate: Date()),
        dismissalPolicy: .immediate
      )
      throw LayerwellLiveActivityStaleException()
    }
  }

  func end(
    dismissalPolicy: LiveActivityDismissalPolicy?,
    afterDate: Date?,
    props: String?,
    contentDate: Date?
  ) async throws {
    guard #available(iOS 16.2, *) else { throw LiveActivitiesNotSupportedException() }

    guard let activity = Activity<LiveActivityAttributes>.activities.first(where: {
      $0.id == id
    }) else {
      throw LiveActivityNotFoundException(id)
    }

    let finalState = LiveActivityAttributes.ContentState(
      name: LayerwellWidgetLifecycleStore.activityName,
      props: "{}"
    )
    await activity.end(
      ActivityContent(state: finalState, staleDate: Date()),
      dismissalPolicy: .immediate
    )
  }

  func getPushToken() throws -> String? {
    guard #available(iOS 16.1, *) else { throw LiveActivitiesNotSupportedException() }
    guard name == LayerwellWidgetLifecycleStore.activityName else {
      throw LayerwellWidgetLifecycleError.unavailable
    }
    guard LiveActivityFactory.pushNotificationsEnabled else {
      throw LayerwellWidgetLifecycleError.unavailable
    }

    guard let activity = Activity<LiveActivityAttributes>.activities.first(where: {
      $0.id == id && $0.content.state.name == name && $0.activityState == .active
    }) else {
      throw LiveActivityNotFoundException(id)
    }
    _ = try LayerwellWidgetLifecycleStore.staleDate(
      name: activity.content.state.name,
      propsJSON: activity.content.state.props
    )

    guard let tokenData = activity.pushToken else { return nil }
    return tokenData.reduce("") { $0 + String(format: "%02x", $1) }
  }

  @available(iOS 16.1, *)
  func observePushTokenUpdates(
    for activity: Activity<LiveActivityAttributes>,
    pushNotificationsEnabled: Bool
  ) {
    guard pushNotificationsEnabled else { return }

    pushTokenObserverTask?.cancel()
    pushTokenObserverTask = Task {
      for await data in activity.pushTokenUpdates {
        guard (try? LayerwellWidgetLifecycleStore.staleDate(
          name: activity.content.state.name,
          propsJSON: activity.content.state.props
        )) != nil else { return }
        let token = data.reduce("") { $0 + String(format: "%02x", $1) }
        emit(event: onTokenReceived, payload: [
          "activityId": activity.id,
          "pushToken": token
        ])
      }
    }
  }

  override func sharedObjectWillRelease() {
    pushTokenObserverTask?.cancel()
    pushTokenObserverTask = nil
  }
}
