import ActivityKit
import ExpoModulesCore

final class RoutineKindLiveActivityStaleException: Exception, @unchecked Sendable {
  override var reason: String {
    "RoutineKind Live Activity authorization changed during publication"
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
    guard name == RoutineKindWidgetLifecycleStore.activityName else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }

    guard let activity = Activity<LiveActivityAttributes>.activities.first(where: {
      $0.id == id && $0.content.state.name == name && $0.activityState == .active
    }) else {
      throw LiveActivityNotFoundException(id)
    }

    let staleDate: Date?
    do {
      staleDate = try RoutineKindWidgetLifecycleStore.staleDate(name: name, propsJSON: props)
    } catch RoutineKindWidgetLifecycleError.stale {
      throw RoutineKindLiveActivityStaleException()
    } catch RoutineKindWidgetLifecycleError.unauthorized {
      throw RoutineKindLiveActivityStaleException()
    }
    let newState = LiveActivityAttributes.ContentState(name: name, props: props)
    await activity.update(ActivityContent(state: newState, staleDate: staleDate))
    do {
      _ = try RoutineKindWidgetLifecycleStore.staleDate(name: name, propsJSON: props)
    } catch RoutineKindWidgetLifecycleError.stale {
      let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
      await activity.end(
        ActivityContent(state: finalState, staleDate: Date()),
        dismissalPolicy: .immediate
      )
      throw RoutineKindLiveActivityStaleException()
    } catch RoutineKindWidgetLifecycleError.unauthorized {
      let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
      await activity.end(
        ActivityContent(state: finalState, staleDate: Date()),
        dismissalPolicy: .immediate
      )
      throw RoutineKindLiveActivityStaleException()
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
      name: RoutineKindWidgetLifecycleStore.activityName,
      props: "{}"
    )
    await activity.end(
      ActivityContent(state: finalState, staleDate: Date()),
      dismissalPolicy: .immediate
    )
  }

  func getPushToken() throws -> String? {
    guard #available(iOS 16.1, *) else { throw LiveActivitiesNotSupportedException() }
    guard name == RoutineKindWidgetLifecycleStore.activityName else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    guard LiveActivityFactory.pushNotificationsEnabled else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }

    guard let activity = Activity<LiveActivityAttributes>.activities.first(where: {
      $0.id == id && $0.content.state.name == name && $0.activityState == .active
    }) else {
      throw LiveActivityNotFoundException(id)
    }
    _ = try RoutineKindWidgetLifecycleStore.staleDate(
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
        guard (try? RoutineKindWidgetLifecycleStore.staleDate(
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
