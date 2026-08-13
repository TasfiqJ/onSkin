import ActivityKit
import ExpoModulesCore

final class LiveActivityFactory: SharedObject {
  let name: String

  static var pushNotificationsEnabled: Bool {
    Bundle.main.object(forInfoDictionaryKey: pushNotificationsEnabledKey) as? Bool ?? false
  }

  init(name: String, layout: String) {
    self.name = name
    WidgetsStorage.set(layout, forKey: "__expo_widgets_live_activity_\(name)_layout")
  }

  func start(props: String, url: URL?) throws -> LiveActivity {
    guard #available(iOS 16.2, *) else { throw LiveActivitiesNotSupportedException() }
    guard name == LayerwellWidgetLifecycleStore.activityName else {
      throw StartLiveActivityException("Only LayerwellEvening Live Activities are supported.")
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      throw LiveActivitiesNotSupportedException()
    }

    do {
      let authorizedURL = try LayerwellWidgetLifecycleStore.authorizedDeepLink(url)
      let staleDate = try LayerwellWidgetLifecycleStore.staleDate(
        name: name,
        propsJSON: props
      )
      let initialState = LiveActivityAttributes.ContentState(name: name, props: props)
      let activity = try Activity.request(
        attributes: LiveActivityAttributes(),
        content: .init(state: initialState, staleDate: staleDate),
        pushType: LiveActivityFactory.pushNotificationsEnabled ? .token : nil
      )
      do {
        _ = try LayerwellWidgetLifecycleStore.staleDate(name: name, propsJSON: props)
      } catch LayerwellWidgetLifecycleError.stale {
        Task(priority: .userInitiated) {
          let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
          await activity.end(
            ActivityContent(state: finalState, staleDate: Date()),
            dismissalPolicy: .immediate
          )
        }
        throw LayerwellLiveActivityStaleException()
      } catch LayerwellWidgetLifecycleError.unauthorized {
        Task(priority: .userInitiated) {
          let finalState = LiveActivityAttributes.ContentState(name: name, props: "{}")
          await activity.end(
            ActivityContent(state: finalState, staleDate: Date()),
            dismissalPolicy: .immediate
          )
        }
        throw LayerwellLiveActivityStaleException()
      }
      WidgetsStorage.set(
        authorizedURL.absoluteString,
        forKey: "__expo_widgets_live_activity_\(name)_url"
      )

      let instance = LiveActivity(id: activity.id, name: name)
      instance.observePushTokenUpdates(
        for: activity,
        pushNotificationsEnabled: LiveActivityFactory.pushNotificationsEnabled
      )
      return instance
    } catch let error as LayerwellLiveActivityStaleException {
      throw error
    } catch LayerwellWidgetLifecycleError.stale {
      throw LayerwellLiveActivityStaleException()
    } catch LayerwellWidgetLifecycleError.unauthorized {
      throw LayerwellLiveActivityStaleException()
    } catch {
      throw StartLiveActivityException(error.localizedDescription)
    }
  }

  func getInstances() throws -> [LiveActivity] {
    guard #available(iOS 16.1, *) else { throw LiveActivitiesNotSupportedException() }
    guard name == LayerwellWidgetLifecycleStore.activityName else { return [] }

    return Activity<LiveActivityAttributes>.activities
      .filter {
        $0.content.state.name == LayerwellWidgetLifecycleStore.activityName &&
          $0.activityState == .active
      }
      .sorted { $0.id < $1.id }
      .map { activity in
        LiveActivity(id: activity.id, name: name)
      }
  }
}
