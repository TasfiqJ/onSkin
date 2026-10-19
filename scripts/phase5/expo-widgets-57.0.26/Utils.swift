import Foundation
import SwiftUI
import WidgetKit

func parseTimeline(identifier: String, name: String, family: WidgetFamily) -> [WidgetsTimelineEntry] {
  let timeline: [Any]
  if name == LayerwellWidgetLifecycleStore.widgetName {
    guard WidgetsStorage.appGroupIdentifier == identifier else { return [] }
    timeline = (try? LayerwellWidgetLifecycleStore.currentTimelineDictionaries()) ?? []
  } else {
    timeline = WidgetsStorage.getArray(forKey: "__expo_widgets_\(name)_timeline") ?? []
  }

  let entries: [WidgetsTimelineEntry?] = timeline.enumerated().map { index, entry in
    guard let entry = entry as? [String: Any],
          let timestamp = entry["timestamp"] as? NSNumber,
          timestamp.doubleValue.isFinite,
          let props = entry["props"] as? [String: Any] else {
      return nil
    }
    return WidgetsTimelineEntry(
      date: Date(timeIntervalSince1970: timestamp.doubleValue / 1_000),
      name: name,
      props: props,
      entryIndex: index
    )
  }

  return entries.compactMap(\.self)
}

public func createRedBox(message: String, stack: String? = nil) -> [String: Any] {
  var props: [String: Any] = ["message": message]
  if let stack {
    props["stack"] = stack
  }
  return ["type": "RedBoxView", "props": props]
}

public func evaluateLayout(
  layout: String,
  props: [String: Any],
  environment: [String: Any]
) -> [String: Any] {
  switch evaluateWidgetLayout(layout: layout, props: props, environment: environment) {
  case .success(let result):
    return result
  case .failure(let error):
    print("[ExpoWidgets] Layout evaluation failed: \(error.message)")
    return createRedBox(message: error.message)
  }
}

func getLiveActivityNodes(
  forName name: String,
  props: String = "{}",
  environment: [String: Any]
) -> [String: Any] {
  let layout = WidgetsStorage.getString(forKey: "__expo_widgets_live_activity_\(name)_layout") ?? ""
  let propsData = props.data(using: .utf8)
  let propsDict = propsData.flatMap {
    try? JSONSerialization.jsonObject(with: $0, options: []) as? [String: Any]
  } ?? [:]

  switch evaluateWidgetLayout(layout: layout, props: propsDict, environment: environment) {
  case .success(let result):
    return result
  case .failure(let error):
    print("[ExpoWidgets] Layout evaluation failed: \(error.message)")
    return ["banner": createRedBox(message: error.message)]
  }
}

func getLiveActivityUrl(forName name: String) -> URL? {
  guard name == LayerwellWidgetLifecycleStore.activityName,
        let urlString = WidgetsStorage.getString(
          forKey: "__expo_widgets_live_activity_\(name)_url"
        ),
        let candidate = URL(string: urlString) else {
    return nil
  }
  return try? LayerwellWidgetLifecycleStore.authorizedDeepLink(candidate)
}

public func getWidgetEnvironment(environment: EnvironmentValues) -> [String: Any] {
  var env: [String: Any] = [
    "showsContainerBackground": environment.showsWidgetContainerBackground,
    "widgetFamily": environment.widgetFamily.description,
    "colorScheme": "\(environment.colorScheme)"
  ]

  if #available(iOS 16.0, *) {
    env["isLuminanceReduced"] = environment.isLuminanceReduced
    env["widgetRenderingMode"] = environment.widgetRenderingMode.description
    env["showsWidgetLabel"] = environment.showsWidgetLabel
  }
  if #available(iOS 17.0, *) {
    env["widgetContentMargins"] = [
      "top": environment.widgetContentMargins.top,
      "bottom": environment.widgetContentMargins.bottom,
      "leading": environment.widgetContentMargins.leading,
      "trailing": environment.widgetContentMargins.trailing,
    ]
  }
  if #available(iOS 26.0, *) {
    env["levelOfDetail"] = environment.levelOfDetail == .simplified
      ? "simplified"
      : environment.levelOfDetail == .default ? "default" : nil
  }
  return env
}

// ActivityViewContext requires iOS 16.1. Without the availability attribute, precompiling
// this package fails: the SwiftPM prebuild targets iOS 16.0 (spm.config.json), unlike the
// podspec (16.4). Both callers live in @available(iOS 16.1, *) views.
@available(iOS 16.1, *)
func getLiveActivityEnvironment(for environment: EnvironmentValues, in context: ActivityViewContext<LiveActivityAttributes>) -> [String: Any] {
  var env: [String: Any] = [
    "colorScheme": "\(environment.colorScheme)"
  ]

  env["isLuminanceReduced"] = environment.isLuminanceReduced
  env["isActivityFullscreen"] = environment.isActivityFullscreen
  if #available(iOS 16.2, *) {
    env["isStale"] = context.isStale
  }
  if #available(iOS 18.0, *) {
    env["isActivityUpdateReduced"] = environment.isActivityUpdateReduced
    env["activityFamily"] = "\(environment.activityFamily)"
  }
  if #available(iOS 26.0, *) {
    env["levelOfDetail"] = environment.levelOfDetail == .simplified
      ? "simplified"
      : environment.levelOfDetail == .default ? "default" : nil
  }
  return env
}
