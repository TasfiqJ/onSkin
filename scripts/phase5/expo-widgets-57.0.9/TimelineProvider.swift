import WidgetKit

public struct WidgetsTimelineProvider: TimelineProvider {
  public func placeholder(in context: Context) -> WidgetsTimelineEntry {
    genericEntry()
  }

  public func getSnapshot(
    in context: Context,
    completion: @escaping @Sendable (WidgetsTimelineEntry) -> Void
  ) {
    guard let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String else {
      completion(genericEntry())
      return
    }

    let entries = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)
    let now = Date()
    completion(entries.last(where: { $0.date <= now }) ?? entries.first ?? genericEntry())
  }

  public func getTimeline(
    in context: Context,
    completion: @escaping @Sendable (Timeline<WidgetsTimelineEntry>) -> Void
  ) {
    guard let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String else {
      completion(Timeline(entries: [genericEntry()], policy: .atEnd))
      return
    }

    let parsed = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)
    let entries = parsed.isEmpty ? [genericEntry()] : parsed
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  public typealias Entry = WidgetsTimelineEntry

  let name: String

  public init(name: String) {
    self.name = name
  }

  private func genericEntry() -> WidgetsTimelineEntry {
    WidgetsTimelineEntry(date: Date(), name: name, props: nil, entryIndex: nil)
  }
}
