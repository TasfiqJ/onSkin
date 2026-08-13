import ExpoModulesCore
import WidgetKit

final class WidgetObject: SharedObject {
  let name: String
  init(name: String, layout: String) {
    self.name = name
    WidgetsStorage.set(layout, forKey: "__expo_widgets_\(name)_layout")
  }

  func reload() {
    WidgetCenter.shared.reloadTimelines(ofKind: name)
  }

  func updateTimeline(entries: [WidgetsJSTimelineEntry]) throws {
    if WidgetsStorage.getString(forKey: "__expo_widgets_\(name)_layout") == nil {
      throw UpdatedTimelineWithoutLayout(name)
    }
    let dictionaries = entries.map { $0.toDictionary() }
    if name == LayerwellWidgetLifecycleStore.widgetName {
      try LayerwellWidgetLifecycleStore.publishTimelineEntries(dictionaries)
      return
    }
    WidgetsStorage.set(dictionaries, forKey: "__expo_widgets_\(name)_timeline")
    reload()
  }

  func getTimeline() throws -> [WidgetsJSTimelineEntry] {
    guard let appContext else { return [] }
    let entries: [[String: Any]]
    if name == LayerwellWidgetLifecycleStore.widgetName {
      entries = try LayerwellWidgetLifecycleStore.currentTimelineDictionaries()
    } else {
      entries = WidgetsStorage.getArray(forKey: "__expo_widgets_\(name)_timeline") as? [[String: Any]] ?? []
    }
    return try entries.map { try WidgetsJSTimelineEntry(from: $0, appContext: appContext) }
  }
}
