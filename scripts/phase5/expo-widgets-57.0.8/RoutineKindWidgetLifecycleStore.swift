import ActivityKit
import CoreFoundation
import Darwin
import Foundation
import SQLite3
import WidgetKit

private let routineKindSQLiteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

enum RoutineKindWidgetLifecycleError: Error, LocalizedError {
  case invalidInput
  case unavailable
  case unauthorized
  case stale
  case storage

  var errorDescription: String? {
    switch self {
    case .invalidInput: "RoutineKind widget input was invalid."
    case .unavailable: "RoutineKind widget lifecycle is unavailable."
    case .unauthorized: "RoutineKind widget authority is no longer current."
    case .stale: "RoutineKind widget state is stale."
    case .storage: "RoutineKind widget lifecycle storage failed."
    }
  }
}

private struct RoutineKindWidgetPropsRecord {
  let raw: [String: Any]
  let canonicalJSON: String
  let ownerGeneration: String
  let snapshotNonce: String
  let status: String
  let phase: String
  let localDate: String
  let completedCount: Int64
  let totalCount: Int64
  let actionTokens: [String]
  let pendingActionTokens: [String]
  let interactionRevision: Int64
  let deepLink: String
  let updatedAtMs: Int64
  let staleAtMs: Int64
}

private struct RoutineKindLiveActivityPropsRecord {
  let raw: [String: Any]
  let ownerGeneration: String
  let snapshotNonce: String
  let status: String
  let completedCount: Int64
  let totalCount: Int64
  let updatedAtMs: Int64
  let staleAtMs: Int64
}

private struct RoutineKindAuthorityRecord {
  let authorityNonce: String
  let enabled: Bool
  let ownerGeneration: String?
}

private struct RoutineKindOutboxRecord: Encodable {
  let actionToken: String
  let createdAtMs: Int64
  let localDate: String
  let ownerGeneration: String
  let phase: String
  let revision: Int64
  let snapshotNonce: String
  let staleAtMs: Int64
}

private struct RoutineKindAuthorityReceipt: Encodable {
  let authorityNonce: String
  let enabled: Bool
  let ownerGeneration: String?
  let schemaVersion: Int

  private enum CodingKeys: String, CodingKey {
    case authorityNonce
    case enabled
    case ownerGeneration
    case schemaVersion
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(authorityNonce, forKey: .authorityNonce)
    try container.encode(enabled, forKey: .enabled)
    if let ownerGeneration {
      try container.encode(ownerGeneration, forKey: .ownerGeneration)
    } else {
      try container.encodeNil(forKey: .ownerGeneration)
    }
    try container.encode(schemaVersion, forKey: .schemaVersion)
  }
}

private struct RoutineKindQuiescenceReceipt: Encodable {
  let authorityNonce: String
  let ownerGeneration: String
  let quiescenceNonce: String
  let schemaVersion: Int
}

private final class RoutineKindStoreLock {
  private let handle: FileHandle

  init(url: URL) throws {
    let manager = FileManager.default
    if !manager.fileExists(atPath: url.path) {
      guard manager.createFile(
        atPath: url.path,
        contents: Data(),
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
      ) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
    }
    guard let handle = FileHandle(forUpdatingAtPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    self.handle = handle
    var attemptsRemaining = 25
    while flock(handle.fileDescriptor, LOCK_EX | LOCK_NB) != 0 {
      let lockError = errno
      attemptsRemaining -= 1
      guard attemptsRemaining > 0,
            lockError == EWOULDBLOCK || lockError == EAGAIN || lockError == EINTR else {
        try? handle.close()
        throw RoutineKindWidgetLifecycleError.storage
      }
      if lockError != EINTR {
        usleep(10_000)
      }
    }
  }

  deinit {
    _ = flock(handle.fileDescriptor, LOCK_UN)
    try? handle.close()
  }
}

private final class RoutineKindSQLiteConnection {
  let handle: OpaquePointer

  init(path: String) throws {
    var candidate: OpaquePointer?
    let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
    guard sqlite3_open_v2(path, &candidate, flags, nil) == SQLITE_OK, let candidate else {
      if let candidate { sqlite3_close_v2(candidate) }
      throw RoutineKindWidgetLifecycleError.storage
    }
    handle = candidate
    do {
      guard sqlite3_busy_timeout(handle, 250) == SQLITE_OK else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      try execute("PRAGMA journal_mode=DELETE")
      try execute("PRAGMA synchronous=FULL")
      try execute("PRAGMA foreign_keys=ON")
      try execute("PRAGMA secure_delete=ON")
      try execute("PRAGMA trusted_schema=OFF")
      try execute("PRAGMA temp_store=MEMORY")
    } catch {
      sqlite3_close_v2(handle)
      throw error
    }
  }

  deinit {
    sqlite3_close_v2(handle)
  }

  func execute(_ sql: String) throws {
    guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  func withStatement<T>(
    _ sql: String,
    operation: (OpaquePointer) throws -> T
  ) throws -> T {
    var candidate: OpaquePointer?
    guard sqlite3_prepare_v2(handle, sql, -1, &candidate, nil) == SQLITE_OK,
          let statement = candidate else {
      if let candidate { sqlite3_finalize(candidate) }
      throw RoutineKindWidgetLifecycleError.storage
    }
    defer { sqlite3_finalize(statement) }
    return try operation(statement)
  }

  func transaction<T>(_ operation: () throws -> T) throws -> T {
    try execute("BEGIN IMMEDIATE")
    do {
      let result = try operation()
      try execute("COMMIT")
      return result
    } catch {
      try? execute("ROLLBACK")
      throw error
    }
  }
}

enum RoutineKindWidgetLifecycleStore {
  static let widgetName = "RoutineKindToday"
  static let activityName = "RoutineKindEvening"
  static let interactionTarget = "widget-action:complete-next"
  static let nativeSchemaVersion = 1

  private static let widgetTimelineKey = "__expo_widgets_RoutineKindToday_timeline"
  private static let activityURLKey = "__expo_widgets_live_activity_RoutineKindEvening_url"
  private static let lifecycleVersionKey = "RoutineKindWidgetLifecycleVersion"
  private static let publicationEnabledKey = "RoutineKindWidgetInteractivePublicationEnabled"
  private static let liveActivityEnabledKey = "RoutineKindLiveActivityStartEnabled"
  private static let deepLinkKey = "RoutineKindWidgetDeepLink"
  private static let propsSchemaVersion: Int64 = 2
  private static let maximumActions = 32
  private static let maximumOutboxRecords = 32
  private static let maximumLeaseMs: Int64 = 300_000
  private static let maximumSafeInteger: Int64 = 9_007_199_254_740_991
  private static let maximumJSONBytes = 64 * 1024
  private static let maximumLiveActivityJSONBytes = 3_500
  private static let deepLinkPattern = try! NSRegularExpression(
    pattern: "^[a-z][a-z0-9+.-]{0,63}://today$"
  )
  private static let uuidPattern = try! NSRegularExpression(
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
  )

  private typealias StoreURLs = (
    directory: URL,
    database: URL,
    lock: URL,
    privacyClosed: URL,
    privacyClosing: URL
  )

  private static let schema = """
  CREATE TABLE IF NOT EXISTS authority (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    authority_nonce TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    owner_generation TEXT
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_nonce TEXT PRIMARY KEY,
    owner_generation TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 0 AND revision <= 10000),
    local_date TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('AM', 'PM')),
    current_timestamp_ms INTEGER NOT NULL,
    current_props_json TEXT NOT NULL,
    stale_timestamp_ms INTEGER NOT NULL,
    stale_props_json TEXT NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    stale_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshot_actions (
    snapshot_nonce TEXT NOT NULL,
    action_token TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0 AND ordinal < 32),
    consumed INTEGER NOT NULL CHECK (consumed IN (0, 1)),
    PRIMARY KEY (snapshot_nonce, action_token),
    UNIQUE (snapshot_nonce, ordinal),
    FOREIGN KEY (snapshot_nonce) REFERENCES snapshots(snapshot_nonce) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS outbox (
    owner_generation TEXT NOT NULL,
    snapshot_nonce TEXT NOT NULL,
    action_token TEXT NOT NULL,
    local_date TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('AM', 'PM')),
    created_at_ms INTEGER NOT NULL,
    stale_at_ms INTEGER NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0 AND revision <= 10000),
    committed_props_json TEXT NOT NULL,
    PRIMARY KEY (owner_generation, snapshot_nonce, action_token)
  );
  """

  private static var configurationVersionIsCurrent: Bool {
    (Bundle.main.object(forInfoDictionaryKey: lifecycleVersionKey) as? NSNumber)?.intValue ==
      nativeSchemaVersion
  }

  static var nativeStateIsConfigured: Bool {
    configurationVersionIsCurrent && (try? appGroupIdentifier()) != nil
  }

  private static var publicationIsEnabled: Bool {
    configurationVersionIsCurrent &&
      (Bundle.main.object(forInfoDictionaryKey: publicationEnabledKey) as? Bool == true)
  }

  private static var liveActivityIsEnabled: Bool {
    configurationVersionIsCurrent &&
      (Bundle.main.object(forInfoDictionaryKey: liveActivityEnabledKey) as? Bool == true)
  }

  private static var configuredDeepLink: String? {
    guard let value = Bundle.main.object(forInfoDictionaryKey: deepLinkKey) as? String,
          value == value.lowercased(),
          value.utf8.count <= 72 else { return nil }
    let range = NSRange(value.startIndex..<value.endIndex, in: value)
    return deepLinkPattern.firstMatch(in: value, range: range)?.range == range ? value : nil
  }

  static func authorizedDeepLink(_ candidate: URL?) throws -> URL {
    guard let candidate,
          let configuredDeepLink,
          candidate.absoluteString == configuredDeepLink else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    return candidate
  }

  private static func appGroupIdentifier() throws -> String {
    guard let identifier = WidgetsStorage.appGroupIdentifier,
          identifier.hasPrefix("group."),
          !identifier.contains("/") else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    return identifier
  }

  private static func storeURLs() throws -> StoreURLs {
    let identifier = try appGroupIdentifier()
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: identifier
    ) else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    let directory = container
      .appendingPathComponent("Library", isDirectory: true)
      .appendingPathComponent("Application Support", isDirectory: true)
      .appendingPathComponent("RoutineKindWidgets", isDirectory: true)
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
    )
    try FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: directory.path
    )
    return (
      directory,
      directory.appendingPathComponent("lifecycle-v1.sqlite3", isDirectory: false),
      directory.appendingPathComponent("coordination-v1.lock", isDirectory: false),
      directory.appendingPathComponent("privacy-closed-v1.json", isDirectory: false),
      directory.appendingPathComponent("privacy-closing-v1", isDirectory: false)
    )
  }

  private static func withExclusiveStore<T>(
    allowPrivacyClosed: Bool = false,
    allowPrivacyClosing: Bool = false,
    _ operation: (StoreURLs) throws -> T
  ) throws -> T {
    let urls = try storeURLs()
    if !allowPrivacyClosing,
       FileManager.default.fileExists(atPath: urls.privacyClosing.path) {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    if !allowPrivacyClosed,
       FileManager.default.fileExists(atPath: urls.privacyClosed.path) {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    let storeLock = try RoutineKindStoreLock(url: urls.lock)
    return try withExtendedLifetime(storeLock) {
      if !allowPrivacyClosing,
         FileManager.default.fileExists(atPath: urls.privacyClosing.path) {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      if !allowPrivacyClosed,
         FileManager.default.fileExists(atPath: urls.privacyClosed.path) {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      let result = try operation(urls)
      if !allowPrivacyClosing,
         FileManager.default.fileExists(atPath: urls.privacyClosing.path) {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      if !allowPrivacyClosed,
         FileManager.default.fileExists(atPath: urls.privacyClosed.path) {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      return result
    }
  }

  private static func openDatabase(
    _ urls: StoreURLs
  ) throws -> RoutineKindSQLiteConnection {
    let connection = try RoutineKindSQLiteConnection(path: urls.database.path)
    let existingVersion = try connection.withStatement("PRAGMA user_version") { statement in
      guard sqlite3_step(statement) == SQLITE_ROW else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      return sqlite3_column_int64(statement, 0)
    }
    guard existingVersion == 0 || existingVersion == Int64(nativeSchemaVersion) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    try connection.execute(schema)
    if existingVersion == 0 {
      try connection.execute("PRAGMA user_version=1")
    }
    try connection.withStatement(
      "INSERT OR IGNORE INTO authority(" +
        "singleton, schema_version, authority_nonce, enabled, owner_generation" +
        ") VALUES(1, 1, ?, 0, NULL)"
    ) { statement in
      try bindText(freshOpaqueUuid(), to: 1, in: statement)
      try stepDone(statement)
    }
    try connection.withStatement("PRAGMA user_version") { statement in
      guard sqlite3_step(statement) == SQLITE_ROW,
            sqlite3_column_int64(statement, 0) == Int64(nativeSchemaVersion) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
    }
    try FileManager.default.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: urls.database.path
    )
    return connection
  }

  private static func readPrivacyClosedReceipt(
    _ url: URL
  ) throws -> RoutineKindAuthorityReceipt? {
    guard FileManager.default.fileExists(atPath: url.path) else { return nil }
    let data = try Data(contentsOf: url)
    guard data.count > 0,
          data.count <= 512,
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(object.keys) == Set([
            "authorityNonce", "enabled", "ownerGeneration", "schemaVersion"
          ]),
          exactInt(object["schemaVersion"]) == Int64(nativeSchemaVersion),
          let authorityNonce = uuid(object["authorityNonce"]),
          object["enabled"] as? Bool == false,
          object["ownerGeneration"] is NSNull else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    return RoutineKindAuthorityReceipt(
      authorityNonce: authorityNonce,
      enabled: false,
      ownerGeneration: nil,
      schemaVersion: nativeSchemaVersion
    )
  }

  private static func synchronizeDirectory(_ directory: URL) throws {
    let descriptor = open(directory.path, O_RDONLY)
    guard descriptor >= 0 else { throw RoutineKindWidgetLifecycleError.storage }
    defer { _ = Darwin.close(descriptor) }
    guard Darwin.fsync(descriptor) == 0 else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func persistPrivacyClosingSentinel(_ url: URL) throws {
    let manager = FileManager.default
    if !manager.fileExists(atPath: url.path) {
      _ = manager.createFile(
        atPath: url.path,
        contents: Data([0x31]),
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
      )
    }
    guard manager.fileExists(atPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    try manager.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: url.path
    )
    guard let handle = FileHandle(forWritingAtPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    do {
      try handle.truncate(atOffset: 0)
      try handle.write(contentsOf: Data([0x31]))
      try handle.synchronize()
      try handle.close()
    } catch {
      try? handle.close()
      throw error
    }
    try synchronizeDirectory(url.deletingLastPathComponent())
    guard manager.fileExists(atPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func readPrivacyQuiescenceReceipt(
    _ url: URL
  ) throws -> RoutineKindQuiescenceReceipt {
    let data = try Data(contentsOf: url)
    guard data.count > 0,
          data.count <= 512,
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          Set(object.keys) == Set([
            "authorityNonce", "ownerGeneration", "quiescenceNonce", "schemaVersion"
          ]),
          exactInt(object["schemaVersion"]) == Int64(nativeSchemaVersion),
          let authorityNonce = uuid(object["authorityNonce"]),
          let ownerGeneration = uuid(object["ownerGeneration"]),
          let quiescenceNonce = uuid(object["quiescenceNonce"]),
          Set([authorityNonce, ownerGeneration, quiescenceNonce]).count == 3 else {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    return RoutineKindQuiescenceReceipt(
      authorityNonce: authorityNonce,
      ownerGeneration: ownerGeneration,
      quiescenceNonce: quiescenceNonce,
      schemaVersion: nativeSchemaVersion
    )
  }

  private static func persistPrivacyQuiescenceReceipt(
    _ receipt: RoutineKindQuiescenceReceipt,
    to url: URL
  ) throws {
    guard uuid(receipt.authorityNonce) != nil,
          uuid(receipt.ownerGeneration) != nil,
          uuid(receipt.quiescenceNonce) != nil,
          Set([
            receipt.authorityNonce, receipt.ownerGeneration, receipt.quiescenceNonce
          ]).count == 3,
          let data = try encode(receipt).data(using: .utf8),
          data.count <= 512 else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    let manager = FileManager.default
    guard !manager.fileExists(atPath: url.path),
          manager.createFile(
            atPath: url.path,
            contents: Data(),
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
          ),
          let handle = FileHandle(forWritingAtPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    do {
      try handle.truncate(atOffset: 0)
      try handle.write(contentsOf: data)
      try handle.synchronize()
      try handle.close()
      try manager.setAttributes(
        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
        ofItemAtPath: url.path
      )
      try synchronizeDirectory(url.deletingLastPathComponent())
    } catch {
      try? handle.close()
      throw error
    }
    let verified = try readPrivacyQuiescenceReceipt(url)
    guard verified.authorityNonce == receipt.authorityNonce,
          verified.ownerGeneration == receipt.ownerGeneration,
          verified.quiescenceNonce == receipt.quiescenceNonce else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func persistPrivacyClosedReceipt(
    _ receipt: RoutineKindAuthorityReceipt,
    to url: URL
  ) throws {
    guard !receipt.enabled,
          receipt.ownerGeneration == nil,
          uuid(receipt.authorityNonce) != nil,
          let data = try encode(receipt).data(using: .utf8) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    let manager = FileManager.default
    if !manager.fileExists(atPath: url.path) {
      guard manager.createFile(
        atPath: url.path,
        contents: Data(),
        attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
      ) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
    }
    guard let handle = FileHandle(forWritingAtPath: url.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    do {
      try handle.truncate(atOffset: 0)
      try handle.write(contentsOf: data)
      try handle.synchronize()
      try handle.close()
    } catch {
      try? handle.close()
      throw error
    }
    try manager.setAttributes(
      [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: url.path
    )
    try synchronizeDirectory(url.deletingLastPathComponent())
    guard let verified = try readPrivacyClosedReceipt(url),
          verified.authorityNonce == receipt.authorityNonce else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  @discardableResult
  private static func writePrivacyClosedReceipt(
    _ url: URL,
    excluding: Set<String> = []
  ) throws -> RoutineKindAuthorityReceipt {
    let receipt = RoutineKindAuthorityReceipt(
      authorityNonce: freshOpaqueUuid(excluding: excluding),
      enabled: false,
      ownerGeneration: nil,
      schemaVersion: nativeSchemaVersion
    )
    try persistPrivacyClosedReceipt(receipt, to: url)
    return receipt
  }

  private static func removeDatabaseFamily(_ database: URL) throws {
    let manager = FileManager.default
    let members = [
      database,
      URL(fileURLWithPath: database.path + "-journal", isDirectory: false),
      URL(fileURLWithPath: database.path + "-wal", isDirectory: false),
      URL(fileURLWithPath: database.path + "-shm", isDirectory: false)
    ]
    for member in members where manager.fileExists(atPath: member.path) {
      try manager.removeItem(at: member)
    }
  }

  private static func bindText(
    _ value: String,
    to index: Int32,
    in statement: OpaquePointer
  ) throws {
    guard sqlite3_bind_text(statement, index, value, -1, routineKindSQLiteTransient) == SQLITE_OK else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func bindInt(
    _ value: Int64,
    to index: Int32,
    in statement: OpaquePointer
  ) throws {
    guard sqlite3_bind_int64(statement, index, value) == SQLITE_OK else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func stepDone(_ statement: OpaquePointer) throws {
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw RoutineKindWidgetLifecycleError.storage
    }
  }

  private static func columnText(_ statement: OpaquePointer, _ index: Int32) throws -> String {
    guard let pointer = sqlite3_column_text(statement, index) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    return String(cString: pointer)
  }

  private static func exactInt(_ value: Any?) -> Int64? {
    guard let number = value as? NSNumber,
          CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
    let double = number.doubleValue
    guard double.isFinite,
          double.rounded(.towardZero) == double,
          double >= 0,
          double <= Double(maximumSafeInteger) else { return nil }
    return number.int64Value
  }

  private static func uuid(_ value: Any?) -> String? {
    guard let value = value as? String,
          value == value.lowercased(),
          value.utf8.count == 36 else { return nil }
    let range = NSRange(value.startIndex..<value.endIndex, in: value)
    guard uuidPattern.firstMatch(in: value, range: range)?.range == range else { return nil }
    return value
  }

  private static func freshOpaqueUuid(excluding values: Set<String> = []) -> String {
    while true {
      let value = UUID().uuidString.lowercased()
      if !values.contains(value) { return value }
    }
  }

  private static func tokenArray(_ value: Any?) -> [String]? {
    guard let values = value as? [Any], values.count <= maximumActions else { return nil }
    var result: [String] = []
    for value in values {
      guard let token = uuid(value), !result.contains(token) else { return nil }
      result.append(token)
    }
    return result
  }

  private static func isLocalDate(_ value: String) -> Bool {
    guard value.utf8.count == 10 else { return false }
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    guard let date = formatter.date(from: value) else { return false }
    return formatter.string(from: date) == value
  }

  private static func canonicalJSON(_ value: Any, maximumBytes: Int = maximumJSONBytes) throws -> String {
    guard JSONSerialization.isValidJSONObject(value) else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    guard data.count <= maximumBytes,
          let json = String(data: data, encoding: .utf8) else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    return json
  }

  private static func dictionary(from json: String) throws -> [String: Any] {
    guard let data = json.data(using: .utf8), data.count <= maximumJSONBytes,
          let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    return value
  }

  private static func decodeWidgetProps(_ value: Any) throws -> RoutineKindWidgetPropsRecord {
    guard let raw = value as? [String: Any] else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let expectedKeys = Set([
      "actionTokens", "completedCount", "deepLink", "interactionRevision", "localDate",
      "ownerGeneration", "pendingActionTokens", "phase", "schemaVersion", "snapshotNonce",
      "staleAtMs", "status", "totalCount", "updatedAtMs"
    ])
    guard Set(raw.keys) == expectedKeys,
          exactInt(raw["schemaVersion"]) == propsSchemaVersion,
          let ownerGeneration = uuid(raw["ownerGeneration"]),
          let snapshotNonce = uuid(raw["snapshotNonce"]),
          ownerGeneration != snapshotNonce,
          let status = raw["status"] as? String,
          ["disabled", "empty", "ready", "complete", "stale"].contains(status),
          let phase = raw["phase"] as? String,
          ["AM", "PM", "none"].contains(phase),
          let localDate = raw["localDate"] as? String,
          isLocalDate(localDate),
          let completedCount = exactInt(raw["completedCount"]),
          let totalCount = exactInt(raw["totalCount"]),
          completedCount <= totalCount,
          totalCount <= Int64(maximumActions),
          let actionTokens = tokenArray(raw["actionTokens"]),
          let pendingActionTokens = tokenArray(raw["pendingActionTokens"]),
          actionTokens.count + pendingActionTokens.count <= maximumActions,
          Set(actionTokens).isDisjoint(with: Set(pendingActionTokens)),
          let interactionRevision = exactInt(raw["interactionRevision"]),
          interactionRevision <= 10_000,
          let deepLink = raw["deepLink"] as? String,
          deepLink == configuredDeepLink,
          let updatedAtMs = exactInt(raw["updatedAtMs"]),
          let staleAtMs = exactInt(raw["staleAtMs"]),
          staleAtMs > updatedAtMs,
          staleAtMs - updatedAtMs <= maximumLeaseMs else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }

    let stateValid =
      (status == "empty" && completedCount == 0 && totalCount == 0 && actionTokens.isEmpty) ||
      ((status == "disabled" || status == "stale") && phase == "none" &&
        completedCount == 0 && totalCount == 0 && actionTokens.isEmpty) ||
      (status == "ready" && phase != "none" && totalCount > 0 &&
        completedCount < totalCount && actionTokens.count == Int(totalCount - completedCount) &&
        pendingActionTokens.count <= Int(completedCount)) ||
      (status == "complete" && phase != "none" && totalCount > 0 &&
        completedCount == totalCount && actionTokens.isEmpty &&
        pendingActionTokens.count <= Int(completedCount))
    guard stateValid else { throw RoutineKindWidgetLifecycleError.invalidInput }
    return RoutineKindWidgetPropsRecord(
      raw: raw,
      canonicalJSON: try canonicalJSON(raw),
      ownerGeneration: ownerGeneration,
      snapshotNonce: snapshotNonce,
      status: status,
      phase: phase,
      localDate: localDate,
      completedCount: completedCount,
      totalCount: totalCount,
      actionTokens: actionTokens,
      pendingActionTokens: pendingActionTokens,
      interactionRevision: interactionRevision,
      deepLink: deepLink,
      updatedAtMs: updatedAtMs,
      staleAtMs: staleAtMs
    )
  }

  private static func decodeLiveActivityProps(
    _ value: Any
  ) throws -> RoutineKindLiveActivityPropsRecord {
    guard let raw = value as? [String: Any],
          Set(raw.keys) == Set([
            "completedCount", "ownerGeneration", "schemaVersion", "snapshotNonce",
            "staleAtMs", "status", "totalCount", "updatedAtMs"
          ]),
          exactInt(raw["schemaVersion"]) == propsSchemaVersion,
          let ownerGeneration = uuid(raw["ownerGeneration"]),
          let snapshotNonce = uuid(raw["snapshotNonce"]),
          ownerGeneration != snapshotNonce,
          let status = raw["status"] as? String,
          ["in_progress", "complete", "stale"].contains(status),
          let completedCount = exactInt(raw["completedCount"]),
          let totalCount = exactInt(raw["totalCount"]),
          completedCount <= totalCount,
          totalCount <= Int64(maximumActions),
          let updatedAtMs = exactInt(raw["updatedAtMs"]),
          let staleAtMs = exactInt(raw["staleAtMs"]),
          staleAtMs > updatedAtMs,
          staleAtMs - updatedAtMs <= maximumLeaseMs else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let stateValid =
      (status == "stale" && completedCount == 0 && totalCount == 0) ||
      (status == "in_progress" && totalCount > 0 && completedCount < totalCount) ||
      (status == "complete" && totalCount > 0 && completedCount == totalCount)
    guard stateValid else { throw RoutineKindWidgetLifecycleError.invalidInput }
    return RoutineKindLiveActivityPropsRecord(
      raw: raw,
      ownerGeneration: ownerGeneration,
      snapshotNonce: snapshotNonce,
      status: status,
      completedCount: completedCount,
      totalCount: totalCount,
      updatedAtMs: updatedAtMs,
      staleAtMs: staleAtMs
    )
  }

  private static func sameStrings(_ left: [String], _ right: [String]) -> Bool {
    left.count == right.count && zip(left, right).allSatisfy { $0 == $1 }
  }

  private static func validateTransition(
    old: RoutineKindWidgetPropsRecord,
    new: RoutineKindWidgetPropsRecord,
    eventTimeMs: Int64
  ) throws -> String {
    guard old.status == "ready",
          old.phase == "AM" || old.phase == "PM",
          eventTimeMs >= old.updatedAtMs,
          eventTimeMs < old.staleAtMs,
          let actionToken = old.actionTokens.first,
          new.ownerGeneration == old.ownerGeneration,
          new.snapshotNonce == old.snapshotNonce,
          new.localDate == old.localDate,
          new.phase == old.phase,
          new.deepLink == old.deepLink,
          new.staleAtMs == old.staleAtMs,
          new.completedCount == old.completedCount + 1,
          new.totalCount == old.totalCount,
          sameStrings(new.actionTokens, Array(old.actionTokens.dropFirst())),
          sameStrings(new.pendingActionTokens, old.pendingActionTokens + [actionToken]),
          new.interactionRevision == old.interactionRevision + 1,
          new.updatedAtMs >= old.updatedAtMs,
          abs(new.updatedAtMs - eventTimeMs) <= 5_000,
          new.status == (new.completedCount == new.totalCount ? "complete" : "ready") else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    return actionToken
  }

  private static func readAuthority(
    _ connection: RoutineKindSQLiteConnection
  ) throws -> RoutineKindAuthorityRecord {
    try connection.withStatement(
      "SELECT schema_version, authority_nonce, enabled, owner_generation " +
        "FROM authority WHERE singleton=1"
    ) { statement in
      guard sqlite3_step(statement) == SQLITE_ROW,
            sqlite3_column_int64(statement, 0) == Int64(nativeSchemaVersion) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      let nonce = try columnText(statement, 1)
      guard uuid(nonce) != nil else { throw RoutineKindWidgetLifecycleError.storage }
      let enabled = sqlite3_column_int(statement, 2) == 1
      let owner: String?
      if sqlite3_column_type(statement, 3) == SQLITE_NULL {
        owner = nil
      } else {
        owner = try columnText(statement, 3)
      }
      guard (!enabled && owner == nil) || (enabled && uuid(owner) != nil) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      return RoutineKindAuthorityRecord(
        authorityNonce: nonce,
        enabled: enabled,
        ownerGeneration: owner
      )
    }
  }

  private static func requireAuthority(
    _ connection: RoutineKindSQLiteConnection,
    expectedNonce: String? = nil,
    ownerGeneration: String? = nil
  ) throws -> RoutineKindAuthorityRecord {
    let authority = try readAuthority(connection)
    guard authority.enabled else { throw RoutineKindWidgetLifecycleError.unauthorized }
    if let expectedNonce, authority.authorityNonce != expectedNonce {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    if let ownerGeneration, authority.ownerGeneration != ownerGeneration {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    return authority
  }

  private static func purgeDerivedTables(_ connection: RoutineKindSQLiteConnection) throws {
    try connection.execute("DELETE FROM outbox")
    try connection.execute("DELETE FROM snapshot_actions")
    try connection.execute("DELETE FROM snapshots")
  }

  private static func scalarCount(
    _ connection: RoutineKindSQLiteConnection,
    sql: String
  ) throws -> Int64 {
    try connection.withStatement(sql) { statement in
      guard sqlite3_step(statement) == SQLITE_ROW else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      return sqlite3_column_int64(statement, 0)
    }
  }

  private static func encode<T: Encodable>(_ value: T) throws -> String {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let data = try encoder.encode(value)
    guard data.count <= maximumJSONBytes,
          let json = String(data: data, encoding: .utf8) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    return json
  }

  static func readAuthorityJSON() throws -> String {
    let urls = try storeURLs()
    guard !FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    if let closed = try readPrivacyClosedReceipt(urls.privacyClosed) {
      return try encode(closed)
    }
    return try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      let authority = try readAuthority(connection)
      return try encode(RoutineKindAuthorityReceipt(
        authorityNonce: authority.authorityNonce,
        enabled: authority.enabled,
        ownerGeneration: authority.ownerGeneration,
        schemaVersion: nativeSchemaVersion
      ))
    }
  }

  static func activateOwner(
    expectedAuthorityNonce: String,
    ownerGeneration: String
  ) throws -> String {
    guard publicationIsEnabled,
          let expectedNonce = uuid(expectedAuthorityNonce),
          let owner = uuid(ownerGeneration),
          expectedNonce != owner else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    let receipt = try withExclusiveStore(allowPrivacyClosed: true) { urls in
      let closed = try readPrivacyClosedReceipt(urls.privacyClosed)
      if let closed, closed.authorityNonce != expectedNonce {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      let connection = try openDatabase(urls)
      let next = try connection.transaction { () -> RoutineKindAuthorityReceipt in
        let current = try readAuthority(connection)
        if let closed {
          guard !current.enabled,
                current.ownerGeneration == nil,
                current.authorityNonce == closed.authorityNonce,
                current.authorityNonce == expectedNonce else {
            throw RoutineKindWidgetLifecycleError.unauthorized
          }
        } else if current.authorityNonce != expectedNonce {
          throw RoutineKindWidgetLifecycleError.unauthorized
        }
        try purgeDerivedTables(connection)
        let nextNonce = freshOpaqueUuid(excluding: [expectedNonce, current.authorityNonce, owner])
        try connection.withStatement(
          "UPDATE authority SET schema_version=1, authority_nonce=?, enabled=1, " +
            "owner_generation=? WHERE singleton=1 AND authority_nonce=?"
        ) { statement in
          try bindText(nextNonce, to: 1, in: statement)
          try bindText(owner, to: 2, in: statement)
          try bindText(expectedNonce, to: 3, in: statement)
          try stepDone(statement)
          guard sqlite3_changes(connection.handle) == 1 else {
            throw RoutineKindWidgetLifecycleError.unauthorized
          }
        }
        return RoutineKindAuthorityReceipt(
          authorityNonce: nextNonce,
          enabled: true,
          ownerGeneration: owner,
          schemaVersion: nativeSchemaVersion
        )
      }
      let verified = try readAuthority(connection)
      guard verified.enabled,
            verified.authorityNonce == next.authorityNonce,
            verified.ownerGeneration == owner else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      if let closed {
        guard let currentMarker = try readPrivacyClosedReceipt(urls.privacyClosed),
              currentMarker.authorityNonce == closed.authorityNonce else {
          throw RoutineKindWidgetLifecycleError.unauthorized
        }
        try FileManager.default.removeItem(at: urls.privacyClosed)
        try synchronizeDirectory(urls.directory)
      } else if FileManager.default.fileExists(atPath: urls.privacyClosed.path) {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      return next
    }
    WidgetsStorage.removeObject(forKey: widgetTimelineKey)
    WidgetCenter.shared.reloadAllTimelines()
    return try encode(receipt)
  }

  private static func validatedPublication(
    _ entries: [[String: Any]]
  ) throws -> (
    currentTimestamp: Int64,
    current: RoutineKindWidgetPropsRecord,
    staleTimestamp: Int64,
    stale: RoutineKindWidgetPropsRecord
  ) {
    guard entries.count == 2,
          Set(entries[0].keys) == Set(["timestamp", "props"]),
          Set(entries[1].keys) == Set(["timestamp", "props"]),
          let currentTimestamp = exactInt(entries[0]["timestamp"]),
          let staleTimestamp = exactInt(entries[1]["timestamp"]),
          let currentValue = entries[0]["props"],
          let staleValue = entries[1]["props"] else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let current = try decodeWidgetProps(currentValue)
    let stale = try decodeWidgetProps(staleValue)
    guard currentTimestamp == current.updatedAtMs,
          staleTimestamp == current.staleAtMs,
          currentTimestamp < staleTimestamp,
          current.interactionRevision == 0,
          current.pendingActionTokens.isEmpty,
          current.status != "disabled" && current.status != "stale",
          current.phase == "AM" || current.phase == "PM",
          stale.status == "stale",
          stale.ownerGeneration == current.ownerGeneration,
          stale.snapshotNonce == current.snapshotNonce,
          stale.localDate == current.localDate,
          stale.interactionRevision == 0,
          stale.deepLink == current.deepLink,
          stale.updatedAtMs == current.updatedAtMs,
          stale.staleAtMs == current.staleAtMs,
          stale.pendingActionTokens.isEmpty else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    return (currentTimestamp, current, staleTimestamp, stale)
  }

  static func publishTimelineJSON(
    expectedAuthorityNonce: String,
    timelineJSON: String
  ) throws -> String {
    guard publicationIsEnabled,
          let expectedNonce = uuid(expectedAuthorityNonce),
          let data = timelineJSON.data(using: .utf8),
          data.count <= maximumJSONBytes,
          let entries = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let publication = try validatedPublication(entries)
    let status = try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      return try connection.transaction { () -> String in
        _ = try requireAuthority(
          connection,
          expectedNonce: expectedNonce,
          ownerGeneration: publication.current.ownerGeneration
        )
        if try scalarCount(connection, sql: "SELECT COUNT(*) FROM outbox") != 0 {
          return "outbox_pending"
        }
        try purgeDerivedTables(connection)
        try connection.withStatement(
          "INSERT INTO snapshots(" +
            "snapshot_nonce, owner_generation, revision, local_date, phase, " +
            "current_timestamp_ms, current_props_json, stale_timestamp_ms, stale_props_json, " +
            "updated_at_ms, stale_at_ms" +
            ") VALUES(?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)"
        ) { statement in
          try bindText(publication.current.snapshotNonce, to: 1, in: statement)
          try bindText(publication.current.ownerGeneration, to: 2, in: statement)
          try bindText(publication.current.localDate, to: 3, in: statement)
          try bindText(publication.current.phase, to: 4, in: statement)
          try bindInt(publication.currentTimestamp, to: 5, in: statement)
          try bindText(publication.current.canonicalJSON, to: 6, in: statement)
          try bindInt(publication.staleTimestamp, to: 7, in: statement)
          try bindText(publication.stale.canonicalJSON, to: 8, in: statement)
          try bindInt(publication.current.updatedAtMs, to: 9, in: statement)
          try bindInt(publication.current.staleAtMs, to: 10, in: statement)
          try stepDone(statement)
        }
        for (index, token) in publication.current.actionTokens.enumerated() {
          try connection.withStatement(
            "INSERT INTO snapshot_actions(" +
              "snapshot_nonce, action_token, ordinal, consumed" +
              ") VALUES(?, ?, ?, 0)"
          ) { statement in
            try bindText(publication.current.snapshotNonce, to: 1, in: statement)
            try bindText(token, to: 2, in: statement)
            try bindInt(Int64(index), to: 3, in: statement)
            try stepDone(statement)
          }
        }
        return "published"
      }
    }
    if status == "published" {
      WidgetsStorage.removeObject(forKey: widgetTimelineKey)
      WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    }
    return try canonicalJSON(["status": status])
  }

  static func publishTimelineEntries(_ entries: [[String: Any]]) throws {
    guard publicationIsEnabled else { throw RoutineKindWidgetLifecycleError.unavailable }
    let publication = try validatedPublication(entries)
    let authority = try readAuthorityJSON()
    guard let data = authority.data(using: .utf8),
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let expectedNonce = uuid(object["authorityNonce"]),
          object["ownerGeneration"] as? String == publication.current.ownerGeneration else {
      throw RoutineKindWidgetLifecycleError.unauthorized
    }
    let result = try publishTimelineJSON(
      expectedAuthorityNonce: expectedNonce,
      timelineJSON: try canonicalJSON(entries)
    )
    guard result == try canonicalJSON(["status": "published"]) else {
      throw RoutineKindWidgetLifecycleError.stale
    }
  }

  private static func timelineDictionaries(
    connection: RoutineKindSQLiteConnection,
    nowMs: Int64
  ) throws -> [[String: Any]] {
    _ = try requireAuthority(connection)
    return try connection.withStatement(
      "SELECT current_timestamp_ms, current_props_json, stale_timestamp_ms, stale_props_json, " +
        "updated_at_ms, stale_at_ms FROM snapshots LIMIT 2"
    ) { statement in
      guard sqlite3_step(statement) == SQLITE_ROW else { return [] }
      let currentTimestamp = sqlite3_column_int64(statement, 0)
      let currentPropsJSON = try columnText(statement, 1)
      let staleTimestamp = sqlite3_column_int64(statement, 2)
      let stalePropsJSON = try columnText(statement, 3)
      let updatedAtMs = sqlite3_column_int64(statement, 4)
      let staleAtMs = sqlite3_column_int64(statement, 5)
      guard sqlite3_step(statement) == SQLITE_DONE,
            currentTimestamp == updatedAtMs,
            staleTimestamp == staleAtMs,
            currentTimestamp < staleTimestamp else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      let current = try decodeWidgetProps(try dictionary(from: currentPropsJSON))
      let stale = try decodeWidgetProps(try dictionary(from: stalePropsJSON))
      guard current.updatedAtMs == updatedAtMs,
            current.staleAtMs == staleAtMs,
            stale.status == "stale",
            stale.ownerGeneration == current.ownerGeneration,
            stale.snapshotNonce == current.snapshotNonce else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      if nowMs < updatedAtMs { return [] }
      let staleEntry: [String: Any] = ["timestamp": staleTimestamp, "props": stale.raw]
      if nowMs >= staleAtMs { return [staleEntry] }
      return [
        ["timestamp": currentTimestamp, "props": current.raw],
        staleEntry
      ]
    }
  }

  static func currentTimelineDictionaries() throws -> [[String: Any]] {
    guard publicationIsEnabled else { return [] }
    let nowMs = Int64(Date().timeIntervalSince1970 * 1_000)
    return try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      return try timelineDictionaries(connection: connection, nowMs: nowMs)
    }
  }

  static func currentTimelineJSON(expectedAuthorityNonce: String) throws -> String {
    guard let expectedNonce = uuid(expectedAuthorityNonce) else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let nowMs = Int64(Date().timeIntervalSince1970 * 1_000)
    let entries = try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      _ = try requireAuthority(connection, expectedNonce: expectedNonce)
      return try timelineDictionaries(connection: connection, nowMs: nowMs)
    }
    return try canonicalJSON(entries)
  }

  static func sanitizedWidgetProps(
    name: String,
    props: [String: Any]
  ) -> [String: Any] {
    guard name == widgetName else { return props }
    guard publicationIsEnabled,
          let candidate = try? decodeWidgetProps(props),
          let authorized = try? withExclusiveStore({ urls in
            let connection = try openDatabase(urls)
            _ = try requireAuthority(connection, ownerGeneration: candidate.ownerGeneration)
            return try connection.withStatement(
              "SELECT current_props_json, stale_props_json, stale_at_ms FROM snapshots " +
                "WHERE snapshot_nonce=? AND owner_generation=?"
            ) { statement in
              try bindText(candidate.snapshotNonce, to: 1, in: statement)
              try bindText(candidate.ownerGeneration, to: 2, in: statement)
              guard sqlite3_step(statement) == SQLITE_ROW else { return false }
              let currentJSON = try columnText(statement, 0)
              let staleJSON = try columnText(statement, 1)
              let staleAtMs = sqlite3_column_int64(statement, 2)
              guard sqlite3_step(statement) == SQLITE_DONE else {
                throw RoutineKindWidgetLifecycleError.storage
              }
              let nowMs = Int64(Date().timeIntervalSince1970 * 1_000)
              let expected = nowMs >= staleAtMs ? staleJSON : currentJSON
              return candidate.canonicalJSON == expected
            }
          }),
          authorized else {
      return [:]
    }
    return candidate.raw
  }

  static func appendInteraction(
    source: String,
    target: String?,
    oldProps: [String: Any],
    newProps: [String: Any],
    eventTimeMs: Int64
  ) throws -> Bool {
    guard source == widgetName,
          publicationIsEnabled,
          target == interactionTarget,
          eventTimeMs >= 0,
          eventTimeMs <= maximumSafeInteger else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    let old = try decodeWidgetProps(oldProps)
    let new = try decodeWidgetProps(newProps)
    let actionToken = try validateTransition(old: old, new: new, eventTimeMs: eventTimeMs)
    let inserted = try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      return try connection.transaction { () -> Bool in
        _ = try requireAuthority(connection, ownerGeneration: old.ownerGeneration)

        let existing = try connection.withStatement(
          "SELECT revision FROM outbox WHERE " +
            "owner_generation=? AND snapshot_nonce=? AND action_token=?"
        ) { statement -> Int64? in
          try bindText(old.ownerGeneration, to: 1, in: statement)
          try bindText(old.snapshotNonce, to: 2, in: statement)
          try bindText(actionToken, to: 3, in: statement)
          let result = sqlite3_step(statement)
          if result == SQLITE_DONE { return nil }
          guard result == SQLITE_ROW else { throw RoutineKindWidgetLifecycleError.storage }
          let revision = sqlite3_column_int64(statement, 0)
          guard sqlite3_step(statement) == SQLITE_DONE else {
            throw RoutineKindWidgetLifecycleError.storage
          }
          return revision
        }
        if let existing {
          guard existing == new.interactionRevision else {
            throw RoutineKindWidgetLifecycleError.stale
          }
          return false
        }

        let stored = try connection.withStatement(
          "SELECT revision, stale_at_ms, current_props_json FROM snapshots " +
            "WHERE snapshot_nonce=? AND owner_generation=?"
        ) { statement -> (Int64, Int64, String) in
          try bindText(old.snapshotNonce, to: 1, in: statement)
          try bindText(old.ownerGeneration, to: 2, in: statement)
          guard sqlite3_step(statement) == SQLITE_ROW else {
            throw RoutineKindWidgetLifecycleError.stale
          }
          let result = (
            sqlite3_column_int64(statement, 0),
            sqlite3_column_int64(statement, 1),
            try columnText(statement, 2)
          )
          guard sqlite3_step(statement) == SQLITE_DONE else {
            throw RoutineKindWidgetLifecycleError.storage
          }
          return result
        }
        guard stored.0 == old.interactionRevision,
              stored.1 == old.staleAtMs,
              stored.2 == old.canonicalJSON,
              eventTimeMs < stored.1,
              try scalarCount(connection, sql: "SELECT COUNT(*) FROM outbox") <
                Int64(maximumOutboxRecords) else {
          throw RoutineKindWidgetLifecycleError.stale
        }

        try connection.withStatement(
          "SELECT consumed, ordinal FROM snapshot_actions " +
            "WHERE snapshot_nonce=? AND action_token=?"
        ) { statement in
          try bindText(old.snapshotNonce, to: 1, in: statement)
          try bindText(actionToken, to: 2, in: statement)
          guard sqlite3_step(statement) == SQLITE_ROW,
                sqlite3_column_int(statement, 0) == 0,
                sqlite3_column_int64(statement, 1) == old.interactionRevision,
                sqlite3_step(statement) == SQLITE_DONE else {
            throw RoutineKindWidgetLifecycleError.stale
          }
        }

        try connection.withStatement(
          "INSERT INTO outbox(" +
            "owner_generation, snapshot_nonce, action_token, local_date, phase, " +
            "created_at_ms, stale_at_ms, revision, committed_props_json" +
            ") VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ) { statement in
          try bindText(old.ownerGeneration, to: 1, in: statement)
          try bindText(old.snapshotNonce, to: 2, in: statement)
          try bindText(actionToken, to: 3, in: statement)
          try bindText(old.localDate, to: 4, in: statement)
          try bindText(old.phase, to: 5, in: statement)
          try bindInt(eventTimeMs, to: 6, in: statement)
          try bindInt(old.staleAtMs, to: 7, in: statement)
          try bindInt(new.interactionRevision, to: 8, in: statement)
          try bindText(new.canonicalJSON, to: 9, in: statement)
          try stepDone(statement)
        }

        try connection.withStatement(
          "UPDATE snapshot_actions SET consumed=1 " +
            "WHERE snapshot_nonce=? AND action_token=? AND consumed=0"
        ) { statement in
          try bindText(old.snapshotNonce, to: 1, in: statement)
          try bindText(actionToken, to: 2, in: statement)
          try stepDone(statement)
          guard sqlite3_changes(connection.handle) == 1 else {
            throw RoutineKindWidgetLifecycleError.stale
          }
        }

        try connection.withStatement(
          "UPDATE snapshots SET revision=?, current_timestamp_ms=?, current_props_json=?, " +
            "updated_at_ms=? WHERE snapshot_nonce=? AND owner_generation=? AND revision=?"
        ) { statement in
          try bindInt(new.interactionRevision, to: 1, in: statement)
          try bindInt(new.updatedAtMs, to: 2, in: statement)
          try bindText(new.canonicalJSON, to: 3, in: statement)
          try bindInt(new.updatedAtMs, to: 4, in: statement)
          try bindText(old.snapshotNonce, to: 5, in: statement)
          try bindText(old.ownerGeneration, to: 6, in: statement)
          try bindInt(old.interactionRevision, to: 7, in: statement)
          try stepDone(statement)
          guard sqlite3_changes(connection.handle) == 1 else {
            throw RoutineKindWidgetLifecycleError.stale
          }
        }
        return true
      }
    }
    WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    return inserted
  }

  private static func outboxPayload(
    connection: RoutineKindSQLiteConnection,
    authority: RoutineKindAuthorityRecord
  ) throws -> [String: Any] {
    let count = try scalarCount(connection, sql: "SELECT COUNT(*) FROM outbox")
    guard count <= Int64(maximumOutboxRecords) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    let records = try connection.withStatement(
      "SELECT action_token, created_at_ms, local_date, owner_generation, phase, revision, " +
        "snapshot_nonce, stale_at_ms FROM outbox " +
        "ORDER BY revision ASC, action_token ASC"
    ) { statement -> [RoutineKindOutboxRecord] in
      var values: [RoutineKindOutboxRecord] = []
      while true {
        let result = sqlite3_step(statement)
        if result == SQLITE_DONE { break }
        guard result == SQLITE_ROW else { throw RoutineKindWidgetLifecycleError.storage }
        let record = RoutineKindOutboxRecord(
          actionToken: try columnText(statement, 0),
          createdAtMs: sqlite3_column_int64(statement, 1),
          localDate: try columnText(statement, 2),
          ownerGeneration: try columnText(statement, 3),
          phase: try columnText(statement, 4),
          revision: sqlite3_column_int64(statement, 5),
          snapshotNonce: try columnText(statement, 6),
          staleAtMs: sqlite3_column_int64(statement, 7)
        )
        guard uuid(record.actionToken) != nil,
              uuid(record.ownerGeneration) != nil,
              uuid(record.snapshotNonce) != nil,
              isLocalDate(record.localDate),
              record.phase == "AM" || record.phase == "PM",
              record.revision > 0,
              record.revision <= 10_000,
              record.createdAtMs >= 0,
              record.createdAtMs < record.staleAtMs else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        values.append(record)
      }
      return values
    }
    return [
      "authorityNonce": authority.authorityNonce,
      "records": try records.map { record -> [String: Any] in
        guard let data = try encode(record).data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        return object
      },
      "schemaVersion": nativeSchemaVersion
    ]
  }

  static func readOutboxJSON(expectedAuthorityNonce: String) throws -> String {
    guard let expectedNonce = uuid(expectedAuthorityNonce) else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let payload = try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      let authority = try requireAuthority(connection, expectedNonce: expectedNonce)
      return try outboxPayload(connection: connection, authority: authority)
    }
    return try canonicalJSON(payload)
  }

  private static func commitReconciliationJSON(
    _ json: String,
    quiesced: Bool
  ) throws -> String {
    guard let data = json.data(using: .utf8), data.count <= maximumJSONBytes,
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let expectedKeys = Set([
            "acceptedTokens", "expectedAuthorityNonce", "expectedRevision",
            "ownerGeneration", "snapshotNonce"
          ] + (quiesced ? ["quiescenceNonce"] : []))
    guard Set(object.keys) == expectedKeys,
          let expectedNonce = uuid(object["expectedAuthorityNonce"]),
          let ownerGeneration = uuid(object["ownerGeneration"]),
          let snapshotNonce = uuid(object["snapshotNonce"]),
          let expectedRevision = exactInt(object["expectedRevision"]),
          expectedRevision <= 10_000,
          let acceptedTokens = tokenArray(object["acceptedTokens"]) else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let quiescenceNonce = quiesced ? uuid(object["quiescenceNonce"]) : nil
    guard !quiesced || quiescenceNonce != nil else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }

    let result = try withExclusiveStore(allowPrivacyClosing: quiesced) { urls in
      if let quiescenceNonce {
        let receipt = try readPrivacyQuiescenceReceipt(urls.privacyClosing)
        guard receipt.authorityNonce == expectedNonce,
              receipt.ownerGeneration == ownerGeneration,
              receipt.quiescenceNonce == quiescenceNonce else {
          throw RoutineKindWidgetLifecycleError.unauthorized
        }
      }
      let connection = try openDatabase(urls)
      let transactionResult = try connection.transaction { () -> String in
        _ = try requireAuthority(
          connection,
          expectedNonce: expectedNonce,
          ownerGeneration: ownerGeneration
        )
        let current = try connection.withStatement(
          "SELECT revision, current_props_json FROM snapshots " +
            "WHERE snapshot_nonce=? AND owner_generation=?"
        ) { statement -> (Int64, String) in
          try bindText(snapshotNonce, to: 1, in: statement)
          try bindText(ownerGeneration, to: 2, in: statement)
          guard sqlite3_step(statement) == SQLITE_ROW else {
            throw RoutineKindWidgetLifecycleError.stale
          }
          let value = (sqlite3_column_int64(statement, 0), try columnText(statement, 1))
          guard sqlite3_step(statement) == SQLITE_DONE else {
            throw RoutineKindWidgetLifecycleError.storage
          }
          return value
        }
        guard current.0 == expectedRevision else {
          throw RoutineKindWidgetLifecycleError.stale
        }
        let outboxTokens = try connection.withStatement(
          "SELECT action_token FROM outbox WHERE owner_generation=? AND snapshot_nonce=? " +
            "ORDER BY revision ASC, action_token ASC"
        ) { statement -> [String] in
          try bindText(ownerGeneration, to: 1, in: statement)
          try bindText(snapshotNonce, to: 2, in: statement)
          var values: [String] = []
          while true {
            let step = sqlite3_step(statement)
            if step == SQLITE_DONE { break }
            guard step == SQLITE_ROW else { throw RoutineKindWidgetLifecycleError.storage }
            values.append(try columnText(statement, 0))
          }
          return values
        }
        guard !outboxTokens.isEmpty else { throw RoutineKindWidgetLifecycleError.stale }
        if !sameStrings(acceptedTokens, outboxTokens) {
          try purgeDerivedTables(connection)
          return "redacted"
        }
        let currentProps = try decodeWidgetProps(try dictionary(from: current.1))
        guard sameStrings(currentProps.pendingActionTokens, outboxTokens) else {
          try purgeDerivedTables(connection)
          return "redacted"
        }
        var canonicalRaw = currentProps.raw
        canonicalRaw["pendingActionTokens"] = []
        let canonical = try decodeWidgetProps(canonicalRaw)
        try connection.withStatement(
          "UPDATE snapshots SET current_props_json=? " +
            "WHERE snapshot_nonce=? AND owner_generation=? AND revision=?"
        ) { statement in
          try bindText(canonical.canonicalJSON, to: 1, in: statement)
          try bindText(snapshotNonce, to: 2, in: statement)
          try bindText(ownerGeneration, to: 3, in: statement)
          try bindInt(expectedRevision, to: 4, in: statement)
          try stepDone(statement)
          guard sqlite3_changes(connection.handle) == 1 else {
            throw RoutineKindWidgetLifecycleError.stale
          }
        }
        try connection.withStatement(
          "DELETE FROM outbox WHERE owner_generation=? AND snapshot_nonce=?"
        ) { statement in
          try bindText(ownerGeneration, to: 1, in: statement)
          try bindText(snapshotNonce, to: 2, in: statement)
          try stepDone(statement)
          guard sqlite3_changes(connection.handle) == Int32(outboxTokens.count) else {
            throw RoutineKindWidgetLifecycleError.storage
          }
        }
        return "committed"
      }
      if quiesced {
        // Revoke the one-shot receipt before releasing the cross-process lock.
        try persistPrivacyClosingSentinel(urls.privacyClosing)
      }
      return transactionResult
    }
    WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    return try canonicalJSON(["status": result])
  }

  static func commitReconciliationJSON(_ json: String) throws -> String {
    try commitReconciliationJSON(json, quiesced: false)
  }

  static func commitQuiescedReconciliationJSON(_ json: String) throws -> String {
    try commitReconciliationJSON(json, quiesced: true)
  }

  static func quiesceAdmissionJSON(
    expectedAuthorityNonce: String,
    ownerGeneration: String
  ) throws -> String {
    guard let expectedNonce = uuid(expectedAuthorityNonce),
          let expectedOwner = uuid(ownerGeneration),
          expectedNonce != expectedOwner else {
      throw RoutineKindWidgetLifecycleError.invalidInput
    }
    let capturedOutbox = try withExclusiveStore(allowPrivacyClosing: true) { urls in
      guard !FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
        throw RoutineKindWidgetLifecycleError.unauthorized
      }
      let connection = try openDatabase(urls)
      let authority = try requireAuthority(
        connection,
        expectedNonce: expectedNonce,
        ownerGeneration: expectedOwner
      )
      // The same cross-process lock guards AppIntent append. Once this durable
      // sentinel is written while holding it, a tap either committed before
      // this capture or must fail both the pre-lock and post-lock admission checks.
      let quiescence = RoutineKindQuiescenceReceipt(
        authorityNonce: expectedNonce,
        ownerGeneration: expectedOwner,
        quiescenceNonce: freshOpaqueUuid(excluding: [expectedNonce, expectedOwner]),
        schemaVersion: nativeSchemaVersion
      )
      try persistPrivacyQuiescenceReceipt(quiescence, to: urls.privacyClosing)
      guard FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      let verified = try requireAuthority(
        connection,
        expectedNonce: expectedNonce,
        ownerGeneration: expectedOwner
      )
      let outbox = try outboxPayload(connection: connection, authority: verified)
      guard let records = outbox["records"] as? [[String: Any]] else {
        throw RoutineKindWidgetLifecycleError.storage
      }
      if records.isEmpty {
        // No reconciliation can be committed for an empty outbox. Revoke the
        // structured receipt before releasing the lock so even this path is
        // immediately fail-closed and one-shot.
        try persistPrivacyClosingSentinel(urls.privacyClosing)
      }
      return (
        outbox: outbox,
        quiescenceNonce: quiescence.quiescenceNonce
      )
    }
    WidgetsStorage.removeObject(forKey: widgetTimelineKey)
    WidgetsStorage.removeObject(forKey: activityURLKey)
    WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    if #available(iOS 16.2, *) {
      Task(priority: .userInitiated) {
        _ = await endAllActivitiesImmediately()
      }
    }
    return try canonicalJSON([
      "outbox": capturedOutbox.outbox,
      "ownerGeneration": expectedOwner,
      "quiescenceNonce": capturedOutbox.quiescenceNonce,
      "schemaVersion": nativeSchemaVersion,
      "status": "quiesced"
    ])
  }

  static func closeAdmissionJSON() throws -> String {
    let urls = try storeURLs()
    try persistPrivacyClosingSentinel(urls.privacyClosing)
    guard FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
      throw RoutineKindWidgetLifecycleError.storage
    }
    WidgetsStorage.removeObject(forKey: widgetTimelineKey)
    WidgetsStorage.removeObject(forKey: activityURLKey)
    WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    if #available(iOS 16.2, *) {
      Task(priority: .userInitiated) {
        _ = await endAllActivitiesImmediately()
      }
    }
    return try canonicalJSON([
      "schemaVersion": nativeSchemaVersion,
      "status": "closed"
    ])
  }

  static func invalidateAndPurge() throws -> String {
    let urls = try storeURLs()
    try persistPrivacyClosingSentinel(urls.privacyClosing)
    var storageError: Error?
    var receipt: RoutineKindAuthorityReceipt?
    do {
      receipt = try withExclusiveStore(
        allowPrivacyClosed: true,
        allowPrivacyClosing: true
      ) { urls in
        guard FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        let priorMarker = try? readPrivacyClosedReceipt(urls.privacyClosed)
        let closedReceipt = try writePrivacyClosedReceipt(
          urls.privacyClosed,
          excluding: Set([priorMarker?.authorityNonce].compactMap { $0 })
        )
        try removeDatabaseFamily(urls.database)
        let connection = try openDatabase(urls)
        let result = try connection.transaction { () -> RoutineKindAuthorityReceipt in
          _ = try readAuthority(connection)
          try purgeDerivedTables(connection)
          try connection.withStatement(
            "UPDATE authority SET schema_version=1, authority_nonce=?, enabled=0, " +
              "owner_generation=NULL WHERE singleton=1"
          ) { statement in
            try bindText(closedReceipt.authorityNonce, to: 1, in: statement)
            try stepDone(statement)
            guard sqlite3_changes(connection.handle) == 1 else {
              throw RoutineKindWidgetLifecycleError.storage
            }
          }
          return RoutineKindAuthorityReceipt(
            authorityNonce: closedReceipt.authorityNonce,
            enabled: false,
            ownerGeneration: nil,
            schemaVersion: nativeSchemaVersion
          )
        }
        let verified = try readAuthority(connection)
        guard let verifiedMarker = try readPrivacyClosedReceipt(urls.privacyClosed),
              verifiedMarker.authorityNonce == closedReceipt.authorityNonce,
              FileManager.default.fileExists(atPath: urls.privacyClosing.path),
              !verified.enabled,
              verified.ownerGeneration == nil,
              verified.authorityNonce == closedReceipt.authorityNonce,
              try scalarCount(connection, sql: "SELECT COUNT(*) FROM outbox") == 0,
              try scalarCount(connection, sql: "SELECT COUNT(*) FROM snapshot_actions") == 0,
              try scalarCount(connection, sql: "SELECT COUNT(*) FROM snapshots") == 0 else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        do {
          try FileManager.default.removeItem(at: urls.privacyClosing)
          try synchronizeDirectory(urls.directory)
        } catch {
          try? persistPrivacyClosingSentinel(urls.privacyClosing)
          throw error
        }
        guard !FileManager.default.fileExists(atPath: urls.privacyClosing.path) else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        return result
      }
    } catch {
      storageError = error
    }

    WidgetsStorage.removeObject(forKey: widgetTimelineKey)
    WidgetsStorage.removeObject(forKey: activityURLKey)
    WidgetCenter.shared.reloadAllTimelines()
    if let storageError { throw storageError }
    guard let receipt else { throw RoutineKindWidgetLifecycleError.storage }
    return try encode(receipt)
  }

  private static func authorizedLiveActivityProps(
    name: String,
    propsJSON: String
  ) throws -> RoutineKindLiveActivityPropsRecord? {
    guard name == activityName else { throw RoutineKindWidgetLifecycleError.unavailable }
    guard liveActivityIsEnabled,
          let data = propsJSON.data(using: .utf8),
          data.count <= maximumLiveActivityJSONBytes,
          let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw RoutineKindWidgetLifecycleError.unavailable
    }
    let props = try decodeLiveActivityProps(object)
    let nowMs = Int64(Date().timeIntervalSince1970 * 1_000)
    guard props.status != "stale", props.staleAtMs > nowMs else {
      throw RoutineKindWidgetLifecycleError.stale
    }
    try withExclusiveStore { urls in
      let connection = try openDatabase(urls)
      _ = try requireAuthority(connection, ownerGeneration: props.ownerGeneration)
      let widget = try connection.withStatement(
        "SELECT current_props_json, phase, stale_at_ms FROM snapshots " +
          "WHERE snapshot_nonce=? AND owner_generation=?"
      ) { statement -> RoutineKindWidgetPropsRecord in
        try bindText(props.snapshotNonce, to: 1, in: statement)
        try bindText(props.ownerGeneration, to: 2, in: statement)
        guard sqlite3_step(statement) == SQLITE_ROW,
              try columnText(statement, 1) == "PM",
              sqlite3_column_int64(statement, 2) == props.staleAtMs else {
          throw RoutineKindWidgetLifecycleError.stale
        }
        let value = try decodeWidgetProps(try dictionary(from: columnText(statement, 0)))
        guard sqlite3_step(statement) == SQLITE_DONE else {
          throw RoutineKindWidgetLifecycleError.storage
        }
        return value
      }
      let expectedStatus = widget.completedCount == widget.totalCount ? "complete" : "in_progress"
      guard props.status == expectedStatus,
            props.completedCount == widget.completedCount,
            props.totalCount == widget.totalCount,
            props.updatedAtMs == widget.updatedAtMs else {
        throw RoutineKindWidgetLifecycleError.stale
      }
    }
    return props
  }

  static func staleDate(name: String, propsJSON: String) throws -> Date? {
    guard let props = try authorizedLiveActivityProps(name: name, propsJSON: propsJSON) else {
      return nil
    }
    return Date(timeIntervalSince1970: Double(props.staleAtMs) / 1_000)
  }

  static func sanitizedLiveActivityProps(
    name: String,
    propsJSON: String,
    isSystemStale: Bool
  ) -> String {
    guard name == activityName else { return "{}" }
    guard !isSystemStale,
          (try? authorizedLiveActivityProps(name: name, propsJSON: propsJSON)) != nil else {
      return "{}"
    }
    return propsJSON
  }

  @available(iOS 16.2, *)
  static func endAllActivitiesImmediately() async -> Int {
    let activities = Activity<LiveActivityAttributes>.activities
    let finalState = LiveActivityAttributes.ContentState(name: activityName, props: "{}")
    for activity in activities {
      await activity.end(
        ActivityContent(state: finalState, staleDate: Date()),
        dismissalPolicy: .immediate
      )
    }
    return activities.count
  }

  @available(iOS 16.2, *)
  static func reconcileActivities() async -> [String: Int] {
    var kept = 0
    var ended = 0
    let now = Date()
    let activities = Activity<LiveActivityAttributes>.activities.sorted { $0.id < $1.id }
    for activity in activities {
      let state = activity.content.state
      let authorizedStaleDate: Date?
      if state.name == activityName {
        authorizedStaleDate = try? self.staleDate(name: state.name, propsJSON: state.props)
      } else {
        authorizedStaleDate = nil
      }
      if activity.activityState == .active,
         let authorizedStaleDate,
         authorizedStaleDate > now,
         kept == 0 {
        kept += 1
      } else {
        let finalState = LiveActivityAttributes.ContentState(name: activityName, props: "{}")
        await activity.end(
          ActivityContent(state: finalState, staleDate: now),
          dismissalPolicy: .immediate
        )
        ended += 1
      }
    }
    return ["kept": kept, "ended": ended]
  }
}
