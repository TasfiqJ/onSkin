import ExpoModulesCore
import SwiftUI
import WidgetKit

public struct WidgetsEntryView: View {
  @Environment(\.self) var environment
  var entry: WidgetsTimelineProvider.Entry

  public init(entry: WidgetsTimelineProvider.Entry) {
    self.entry = entry
  }

  private var widgetEnvironment: [String: Any] {
    var env: [String: Any] = getWidgetEnvironment(environment: environment)
    env["timestamp"] = Int(entry.date.timeIntervalSince1970 * 1_000)
    return env
  }

  private var widgetEnvironmentString: String? {
    guard let data = try? JSONSerialization.data(withJSONObject: widgetEnvironment),
          let jsonString = String(data: data, encoding: .utf8) else {
      return nil
    }
    return jsonString
  }

  public var body: some View {
    if let layout = WidgetsStorage.getString(forKey: "__expo_widgets_\(entry.name)_layout"),
       !layout.isEmpty {
      let props = RoutineKindWidgetLifecycleStore.sanitizedWidgetProps(
        name: entry.name,
        props: entry.props ?? [:]
      )
      let node = evaluateLayout(layout: layout, props: props, environment: widgetEnvironment)
      WidgetsDynamicView(
        name: entry.name,
        kind: .widget,
        node: node,
        entryIndex: entry.entryIndex,
        environmentString: widgetEnvironmentString
      )
    } else {
      WidgetsDynamicView(
        name: entry.name,
        kind: .widget,
        node: createRedBox(message: "No widget layout found."),
        entryIndex: entry.entryIndex,
        environmentString: widgetEnvironmentString
      )
    }
  }
}
