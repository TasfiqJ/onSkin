import CoreGraphics
import ExpoModulesCore
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

private let labelOcrContractVersion = 1
private let labelOcrEngine = "apple_vision_legacy"
private let labelOcrRequestRevision = VNRecognizeTextRequestRevision3
private let labelOcrRecognitionLevel = "accurate"
private let labelOcrMaximumObservations = 128
private let labelOcrMaximumCandidatesPerObservation = 2
private let labelOcrMaximumCandidateScalars = 512
private let labelOcrMaximumCandidateBytes = 2_048
private let labelOcrMaximumAggregateCandidateBytes = 64 * 1_024
private let labelOcrMaximumResponseBytes = 128 * 1_024
private let labelOcrMaximumUriBytes = 2_048
private let labelOcrMaximumFileBytes = 20 * 1_024 * 1_024
private let labelOcrMaximumSourceDimension = 12_000
private let labelOcrMaximumSourcePixels: Int64 = 80_000_000
private let labelOcrThumbnailMaximumPixelSize = 4_096
private let labelOcrTimeoutMilliseconds = 12_000
private let managedLabelPhotoPrefix = "catalog-label-photo-temp-"
private let managedLabelPhotoSuffix = ".jpg"

private enum LabelOcrFailureCode: String {
  case invalidRequest = "E_LABEL_OCR_INVALID_REQUEST"
  case invalidUri = "E_LABEL_OCR_INVALID_URI"
  case outsideManagedCache = "E_LABEL_OCR_OUTSIDE_MANAGED_CACHE"
  case fileUnavailable = "E_LABEL_OCR_FILE_UNAVAILABLE"
  case fileTooLarge = "E_LABEL_OCR_FILE_TOO_LARGE"
  case unsupportedImage = "E_LABEL_OCR_UNSUPPORTED_IMAGE"
  case imageDecodeFailed = "E_LABEL_OCR_IMAGE_DECODE_FAILED"
  case busy = "E_LABEL_OCR_BUSY"
  case timeout = "E_LABEL_OCR_TIMEOUT"
  case visionFailed = "E_LABEL_OCR_VISION_FAILED"
  case invalidOutput = "E_LABEL_OCR_INVALID_OUTPUT"
  case outputLimit = "E_LABEL_OCR_OUTPUT_LIMIT"
  case encodingFailed = "E_LABEL_OCR_ENCODING_FAILED"
}

private final class NativeLabelOcrException: Exception {
  private let stableCode: String
  private let stableReason: String

  init(_ code: LabelOcrFailureCode, _ reason: String) {
    stableCode = code.rawValue
    stableReason = reason
    super.init()
  }

  override var code: String {
    stableCode
  }

  override var reason: String {
    stableReason
  }
}

private struct LabelOcrJobCancelled: Error {}

private enum LabelOcrRecognitionStatus: String, Encodable {
  case recognized
  case noText = "no_text"
  case cancelled
}

private enum LabelOcrCancellationStatus: String, Encodable {
  case cancelRequested = "cancel_requested"
  case notFound = "not_found"
}

private struct LabelOcrBoundingBox: Encodable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
}

private struct LabelOcrCandidate: Encodable {
  let text: String
  let confidence: Double
}

private struct LabelOcrObservation: Encodable {
  let boundingBox: LabelOcrBoundingBox
  var candidates: [LabelOcrCandidate]
}

private struct LabelOcrRecognitionResponse: Encodable {
  let schemaVersion: Int
  let requestId: String
  let status: LabelOcrRecognitionStatus
  var truncated: Bool
  var observations: [LabelOcrObservation]
}

private struct LabelOcrCancellationResponse: Encodable {
  let schemaVersion: Int
  let requestId: String
  let status: LabelOcrCancellationStatus
}

private enum LabelOcrCancellationReason: Equatable {
  case requested
  case timedOut
  case destroyed
}

private final class LabelOcrActiveJob: @unchecked Sendable {
  let requestId: String
  let promise: Promise
  var request: VNRecognizeTextRequest?
  var cancellationReason: LabelOcrCancellationReason?
  var didSignalVisionCancellation = false
  var settled = false

  init(requestId: String, promise: Promise) {
    self.requestId = requestId
    self.promise = promise
  }
}

private enum LabelOcrJobOutcome {
  case response(String)
  case cancelled
  case failure(NativeLabelOcrException)
}

public final class NativeLabelOcrModule: Module, @unchecked Sendable {
  private let stateLock = NSLock()
  private let workQueue = DispatchQueue(
    label: "NativeLabelOcr.work",
    qos: .userInitiated
  )
  private let timeoutQueue = DispatchQueue(
    label: "NativeLabelOcr.timeout",
    qos: .userInitiated
  )
  private var activeJob: LabelOcrActiveJob?

  public func definition() -> ModuleDefinition {
    Name("NativeLabelOcr")

    Constant("labelOcrContractVersion") { labelOcrContractVersion }
    Constant("labelOcrConfigured") { true }
    Constant("labelOcrEngine") { labelOcrEngine }
    Constant("labelOcrRequestRevision") { Int(labelOcrRequestRevision) }
    Constant("labelOcrRecognitionLevel") { labelOcrRecognitionLevel }
    Constant("labelOcrRunsOnDevice") { true }

    AsyncFunction("recognizeLabelTextJSON") {
      (managedPhotoUri: String, requestId: String, promise: Promise) in
      self.beginRecognition(
        managedPhotoUri: managedPhotoUri,
        requestId: requestId,
        promise: promise
      )
    }

    Function("cancelLabelTextRecognitionJSON") { (requestId: String) throws -> String in
      try self.cancelRecognition(requestId: requestId)
    }

    OnDestroy {
      _ = self.requestCancellation(requestId: nil, reason: .destroyed)
    }
  }

  private func beginRecognition(
    managedPhotoUri: String,
    requestId: String,
    promise: Promise
  ) {
    do {
      try validateCanonicalRequestId(requestId)
      try validateUriShape(managedPhotoUri)
      let job = try reserveJob(requestId: requestId, promise: promise)
      scheduleTimeout(for: job)
      workQueue.async { [weak self, job] in
        self?.executeRecognition(
          managedPhotoUri: managedPhotoUri,
          job: job
        )
      }
    } catch let exception as Exception {
      promise.reject(exception)
    } catch {
      promise.reject(
        NativeLabelOcrException(.invalidRequest, "The label recognition request is invalid.")
      )
    }
  }

  private func reserveJob(requestId: String, promise: Promise) throws -> LabelOcrActiveJob {
    let job = LabelOcrActiveJob(requestId: requestId, promise: promise)
    stateLock.lock()
    defer { stateLock.unlock() }
    guard activeJob == nil else {
      throw NativeLabelOcrException(.busy, "Another label recognition request is active.")
    }
    activeJob = job
    return job
  }

  private func scheduleTimeout(for job: LabelOcrActiveJob) {
    timeoutQueue.asyncAfter(
      deadline: .now() + .milliseconds(labelOcrTimeoutMilliseconds)
    ) { [weak self, weak job] in
      guard let self, let job else { return }
      _ = self.requestCancellation(
        requestId: job.requestId,
        expectedJob: job,
        reason: .timedOut
      )
    }
  }

  private func executeRecognition(managedPhotoUri: String, job: LabelOcrActiveJob) {
    do {
      let json = try autoreleasepool {
        try performRecognition(managedPhotoUri: managedPhotoUri, job: job)
      }
      finish(job: job, outcome: .response(json))
    } catch is LabelOcrJobCancelled {
      finish(job: job, outcome: .cancelled)
    } catch let exception as NativeLabelOcrException {
      finish(job: job, outcome: .failure(exception))
    } catch {
      if isVisionCancellation(error) || cancellationReason(for: job) != nil {
        finish(job: job, outcome: .cancelled)
      } else {
        finish(
          job: job,
          outcome: .failure(
            NativeLabelOcrException(.visionFailed, "On-device label recognition failed.")
          )
        )
      }
    }
  }

  private func performRecognition(
    managedPhotoUri: String,
    job: LabelOcrActiveJob
  ) throws -> String {
    try throwIfCancelled(job)
    let image = try loadManagedLabelImage(managedPhotoUri)
    try throwIfCancelled(job)

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.revision = labelOcrRequestRevision
    request.automaticallyDetectsLanguage = true
    request.usesLanguageCorrection = false
    request.customWords = []
    request.minimumTextHeight = 0
    request.preferBackgroundProcessing = false
    try attach(request: request, to: job)

    let handler = VNImageRequestHandler(
      cgImage: image,
      orientation: .up,
      options: [:]
    )
    do {
      try handler.perform([request])
    } catch {
      if isVisionCancellation(error) || cancellationReason(for: job) != nil {
        throw LabelOcrJobCancelled()
      }
      throw NativeLabelOcrException(.visionFailed, "On-device label recognition failed.")
    }

    try throwIfCancelled(job)
    return try makeRecognitionJSON(
      requestId: job.requestId,
      results: request.results ?? []
    )
  }

  private func attach(request: VNRecognizeTextRequest, to job: LabelOcrActiveJob) throws {
    var shouldCancel = false
    stateLock.lock()
    if activeJob === job, !job.settled {
      job.request = request
      if job.cancellationReason != nil, !job.didSignalVisionCancellation {
        job.didSignalVisionCancellation = true
        shouldCancel = true
      }
    } else {
      shouldCancel = true
    }
    stateLock.unlock()

    if shouldCancel {
      request.cancel()
      throw LabelOcrJobCancelled()
    }
  }

  private func cancelRecognition(requestId: String) throws -> String {
    try validateCanonicalRequestId(requestId)
    let found = requestCancellation(requestId: requestId, reason: .requested)
    return try encodeCancellationResponse(
      LabelOcrCancellationResponse(
        schemaVersion: labelOcrContractVersion,
        requestId: requestId,
        status: found ? .cancelRequested : .notFound
      )
    )
  }

  @discardableResult
  private func requestCancellation(
    requestId: String?,
    expectedJob: LabelOcrActiveJob? = nil,
    reason: LabelOcrCancellationReason
  ) -> Bool {
    var requestToCancel: VNRecognizeTextRequest?
    var found = false
    stateLock.lock()
    if let job = activeJob,
       !job.settled,
       (expectedJob == nil || job === expectedJob),
       requestId == nil || job.requestId == requestId {
      found = true
      if job.cancellationReason == nil {
        job.cancellationReason = reason
      }
      if let request = job.request, !job.didSignalVisionCancellation {
        job.didSignalVisionCancellation = true
        requestToCancel = request
      }
    }
    stateLock.unlock()
    requestToCancel?.cancel()
    return found
  }

  private func throwIfCancelled(_ job: LabelOcrActiveJob) throws {
    if cancellationReason(for: job) != nil {
      throw LabelOcrJobCancelled()
    }
  }

  private func cancellationReason(
    for job: LabelOcrActiveJob
  ) -> LabelOcrCancellationReason? {
    stateLock.lock()
    defer { stateLock.unlock() }
    guard activeJob === job, !job.settled else { return .destroyed }
    return job.cancellationReason
  }

  private func finish(job: LabelOcrActiveJob, outcome: LabelOcrJobOutcome) {
    let cancellation: LabelOcrCancellationReason?
    stateLock.lock()
    guard activeJob === job, !job.settled else {
      stateLock.unlock()
      return
    }
    cancellation = job.cancellationReason
    job.settled = true
    job.request = nil
    activeJob = nil
    stateLock.unlock()

    if cancellation == .timedOut {
      job.promise.reject(
        NativeLabelOcrException(.timeout, "On-device label recognition timed out.")
      )
      return
    }
    if cancellation == .requested || cancellation == .destroyed {
      resolveCancelled(job)
      return
    }

    switch outcome {
    case .response(let json):
      job.promise.resolve(json)
    case .cancelled:
      resolveCancelled(job)
    case .failure(let exception):
      job.promise.reject(exception)
    }
  }

  private func resolveCancelled(_ job: LabelOcrActiveJob) {
    do {
      let json = try encodeRecognitionResponse(
        LabelOcrRecognitionResponse(
          schemaVersion: labelOcrContractVersion,
          requestId: job.requestId,
          status: .cancelled,
          truncated: false,
          observations: []
        )
      )
      job.promise.resolve(json)
    } catch let exception as NativeLabelOcrException {
      job.promise.reject(exception)
    } catch {
      job.promise.reject(
        NativeLabelOcrException(.encodingFailed, "The label recognition result was unavailable.")
      )
    }
  }
}

private func validateCanonicalRequestId(_ requestId: String) throws {
  guard isCanonicalUuidV4(requestId) else {
    throw NativeLabelOcrException(.invalidRequest, "The label recognition request is invalid.")
  }
}

private func isCanonicalUuidV4(_ value: String) -> Bool {
  let bytes = Array(value.utf8)
  guard
    bytes.count == 36,
    bytes[14] == 0x34,
    bytes[19] == 0x38 || bytes[19] == 0x39 || bytes[19] == 0x61 || bytes[19] == 0x62,
    let identifier = UUID(uuidString: value),
    identifier.uuidString.lowercased() == value
  else {
    return false
  }
  return true
}

private func validateUriShape(_ managedPhotoUri: String) throws {
  guard
    !managedPhotoUri.isEmpty,
    managedPhotoUri.utf8.count <= labelOcrMaximumUriBytes,
    let components = URLComponents(string: managedPhotoUri),
    components.scheme == "file",
    components.user == nil,
    components.password == nil,
    components.port == nil,
    (components.host ?? "").isEmpty,
    components.query == nil,
    components.fragment == nil,
    let url = components.url,
    url.isFileURL,
    isManagedLabelPhotoName(url.lastPathComponent)
  else {
    throw NativeLabelOcrException(.invalidUri, "The temporary label photo reference is invalid.")
  }
}

private func isManagedLabelPhotoName(_ name: String) -> Bool {
  guard
    name.hasPrefix(managedLabelPhotoPrefix),
    name.hasSuffix(managedLabelPhotoSuffix)
  else {
    return false
  }
  let identifierStart = name.index(name.startIndex, offsetBy: managedLabelPhotoPrefix.count)
  let identifierEnd = name.index(name.endIndex, offsetBy: -managedLabelPhotoSuffix.count)
  let identifierText = String(name[identifierStart..<identifierEnd])
  return isCanonicalUuidV4(identifierText)
}

private func loadManagedLabelImage(_ managedPhotoUri: String) throws -> CGImage {
  guard
    let components = URLComponents(string: managedPhotoUri),
    let inputUrl = components.url
  else {
    throw NativeLabelOcrException(.invalidUri, "The temporary label photo reference is invalid.")
  }

  let fileManager = FileManager.default
  guard let cacheUrl = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
    throw NativeLabelOcrException(.fileUnavailable, "The temporary label photo is unavailable.")
  }

  let standardizedCache = cacheUrl.standardizedFileURL
  let standardizedInput = inputUrl.standardizedFileURL
  guard standardizedInput.deletingLastPathComponent().path == standardizedCache.path else {
    throw NativeLabelOcrException(
      .outsideManagedCache,
      "The temporary label photo is outside the managed cache."
    )
  }

  let initialValues: URLResourceValues
  do {
    initialValues = try standardizedInput.resourceValues(forKeys: [
      .isSymbolicLinkKey,
      .isRegularFileKey,
      .isReadableKey,
      .fileSizeKey
    ])
  } catch {
    throw NativeLabelOcrException(.fileUnavailable, "The temporary label photo is unavailable.")
  }
  guard initialValues.isSymbolicLink != true else {
    throw NativeLabelOcrException(.invalidUri, "The temporary label photo reference is invalid.")
  }

  let canonicalCache = standardizedCache.resolvingSymlinksInPath()
  let canonicalInput = standardizedInput.resolvingSymlinksInPath()
  guard canonicalInput.deletingLastPathComponent().path == canonicalCache.path else {
    throw NativeLabelOcrException(
      .outsideManagedCache,
      "The temporary label photo is outside the managed cache."
    )
  }

  let canonicalValues: URLResourceValues
  do {
    canonicalValues = try canonicalInput.resourceValues(forKeys: [
      .isRegularFileKey,
      .isReadableKey,
      .fileSizeKey
    ])
  } catch {
    throw NativeLabelOcrException(.fileUnavailable, "The temporary label photo is unavailable.")
  }
  guard
    canonicalValues.isRegularFile == true,
    canonicalValues.isReadable == true,
    let fileSize = canonicalValues.fileSize,
    fileSize > 0
  else {
    throw NativeLabelOcrException(.fileUnavailable, "The temporary label photo is unavailable.")
  }
  guard fileSize <= labelOcrMaximumFileBytes else {
    throw NativeLabelOcrException(.fileTooLarge, "The temporary label photo is too large.")
  }

  let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
  guard let source = CGImageSourceCreateWithURL(
    canonicalInput as CFURL,
    sourceOptions as CFDictionary
  ) else {
    throw NativeLabelOcrException(.unsupportedImage, "The label photo format is unsupported.")
  }
  guard CGImageSourceGetCount(source) == 1 else {
    throw NativeLabelOcrException(.unsupportedImage, "The label photo format is unsupported.")
  }
  guard
    let typeIdentifier = CGImageSourceGetType(source),
    let imageType = UTType(typeIdentifier as String),
    imageType.conforms(to: .jpeg)
  else {
    throw NativeLabelOcrException(.unsupportedImage, "The label photo format is unsupported.")
  }

  guard
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)
      as? [CFString: Any],
    let widthNumber = properties[kCGImagePropertyPixelWidth] as? NSNumber,
    let heightNumber = properties[kCGImagePropertyPixelHeight] as? NSNumber
  else {
    throw NativeLabelOcrException(.imageDecodeFailed, "The label photo could not be decoded.")
  }
  let width = widthNumber.int64Value
  let height = heightNumber.int64Value
  guard
    width > 0,
    height > 0,
    width <= Int64(labelOcrMaximumSourceDimension),
    height <= Int64(labelOcrMaximumSourceDimension),
    width * height <= labelOcrMaximumSourcePixels
  else {
    throw NativeLabelOcrException(.fileTooLarge, "The label photo dimensions are too large.")
  }

  let thumbnailOptions: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: labelOcrThumbnailMaximumPixelSize,
    kCGImageSourceShouldCacheImmediately: true
  ]
  guard let image = CGImageSourceCreateThumbnailAtIndex(
    source,
    0,
    thumbnailOptions as CFDictionary
  ) else {
    throw NativeLabelOcrException(.imageDecodeFailed, "The label photo could not be decoded.")
  }
  return image
}

private func makeRecognitionJSON(
  requestId: String,
  results: [VNRecognizedTextObservation]
) throws -> String {
  var observations: [LabelOcrObservation] = []
  var truncated = false
  var invalidOutputWasOmitted = false
  var aggregateCandidateBytes = 0
  var aggregateLimitReached = false

  observationLoop: for result in results {
    if observations.count == labelOcrMaximumObservations {
      truncated = true
      break
    }
    guard let boundingBox = boundedBoundingBox(result.boundingBox) else {
      invalidOutputWasOmitted = true
      continue
    }

    var candidates: [(position: Int, value: LabelOcrCandidate)] = []
    var normalizedCandidateTexts = Set<String>()
    for (position, candidate) in result
      .topCandidates(labelOcrMaximumCandidatesPerObservation)
      .enumerated() {
      let confidence = Double(candidate.confidence)
      guard
        confidence.isFinite,
        confidence >= 0,
        confidence <= 1,
        isSafeCandidateText(candidate.string)
      else {
        invalidOutputWasOmitted = true
        continue
      }
      guard let normalizedText = normalizedSafeCandidateText(candidate.string) else {
        invalidOutputWasOmitted = true
        continue
      }
      guard normalizedCandidateTexts.insert(normalizedText).inserted else { continue }
      let candidateBytes = normalizedText.utf8.count
      if aggregateCandidateBytes + candidateBytes > labelOcrMaximumAggregateCandidateBytes {
        truncated = true
        aggregateLimitReached = true
        break
      }
      aggregateCandidateBytes += candidateBytes
      candidates.append((
        position: position,
        value: LabelOcrCandidate(text: normalizedText, confidence: confidence)
      ))
    }
    candidates.sort {
      if $0.value.confidence == $1.value.confidence {
        return $0.position < $1.position
      }
      return $0.value.confidence > $1.value.confidence
    }
    guard !candidates.isEmpty else {
      if aggregateLimitReached { break observationLoop }
      continue
    }
    observations.append(
      LabelOcrObservation(
        boundingBox: boundingBox,
        candidates: candidates.map(\.value)
      )
    )
    if aggregateLimitReached { break observationLoop }
  }

  if observations.isEmpty {
    guard !invalidOutputWasOmitted else {
      throw NativeLabelOcrException(.invalidOutput, "The label recognition result was invalid.")
    }
    return try encodeRecognitionResponse(
      LabelOcrRecognitionResponse(
        schemaVersion: labelOcrContractVersion,
        requestId: requestId,
        status: .noText,
        truncated: false,
        observations: []
      )
    )
  }

  return try encodeRecognitionResponse(
    LabelOcrRecognitionResponse(
      schemaVersion: labelOcrContractVersion,
      requestId: requestId,
      status: .recognized,
      truncated: truncated || invalidOutputWasOmitted,
      observations: observations
    )
  )
}

private func boundedBoundingBox(_ rectangle: CGRect) -> LabelOcrBoundingBox? {
  let tolerance = 0.000_001
  let rawX = Double(rectangle.origin.x)
  let rawY = Double(rectangle.origin.y)
  let rawWidth = Double(rectangle.width)
  let rawHeight = Double(rectangle.height)
  let rawMaxX = rawX + rawWidth
  let rawMaxY = rawY + rawHeight
  guard
    rawX.isFinite,
    rawY.isFinite,
    rawWidth.isFinite,
    rawHeight.isFinite,
    rawMaxX.isFinite,
    rawMaxY.isFinite,
    rawWidth > 0,
    rawHeight > 0,
    rawX >= -tolerance,
    rawY >= -tolerance,
    rawX <= 1 + tolerance,
    rawY <= 1 + tolerance,
    rawMaxX >= -tolerance,
    rawMaxY >= -tolerance,
    rawMaxX <= 1 + tolerance,
    rawMaxY <= 1 + tolerance
  else {
    return nil
  }

  let x = min(1, max(0, rawX))
  let y = min(1, max(0, rawY))
  let width = min(1, max(0, rawMaxX)) - x
  let height = min(1, max(0, rawMaxY)) - y
  guard width > 0, height > 0 else { return nil }
  return LabelOcrBoundingBox(x: x, y: y, width: width, height: height)
}

private func isSafeCandidateText(_ text: String) -> Bool {
  guard
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
    text.unicodeScalars.count <= labelOcrMaximumCandidateScalars,
    text.utf8.count <= labelOcrMaximumCandidateBytes
  else {
    return false
  }

  for scalar in text.unicodeScalars {
    let value = scalar.value
    let category = scalar.properties.generalCategory
    if category == .control || category == .lineSeparator || category == .paragraphSeparator {
      return false
    }
    if category == .format && value != 0x200C && value != 0x200D {
      return false
    }
    if (0xFDD0...0xFDEF).contains(value) || (value & 0xFFFE) == 0xFFFE {
      return false
    }
  }
  return true
}

private func normalizedSafeCandidateText(_ text: String) -> String? {
  guard isSafeCandidateText(text) else { return nil }
  let canonical = text.precomposedStringWithCanonicalMapping
  let normalized = canonical
    .components(separatedBy: .whitespacesAndNewlines)
    .filter { !$0.isEmpty }
    .joined(separator: " ")
  return isSafeCandidateText(normalized) ? normalized : nil
}

private func encodeRecognitionResponse(
  _ original: LabelOcrRecognitionResponse
) throws -> String {
  var response = original
  while true {
    let data: Data
    do {
      data = try configuredJsonEncoder().encode(response)
    } catch {
      throw NativeLabelOcrException(.encodingFailed, "The label recognition result was unavailable.")
    }
    if data.count <= labelOcrMaximumResponseBytes {
      return String(decoding: data, as: UTF8.self)
    }

    response.truncated = true
    guard !response.observations.isEmpty else {
      throw NativeLabelOcrException(.outputLimit, "The label recognition result was too large.")
    }
    let lastIndex = response.observations.index(before: response.observations.endIndex)
    if response.observations[lastIndex].candidates.count > 1 {
      response.observations[lastIndex].candidates.removeLast()
    } else if response.observations.count > 1 {
      response.observations.removeLast()
    } else {
      throw NativeLabelOcrException(.outputLimit, "The label recognition result was too large.")
    }
  }
}

private func encodeCancellationResponse(
  _ response: LabelOcrCancellationResponse
) throws -> String {
  do {
    let data = try configuredJsonEncoder().encode(response)
    guard data.count <= labelOcrMaximumResponseBytes else {
      throw NativeLabelOcrException(.outputLimit, "The label recognition result was too large.")
    }
    return String(decoding: data, as: UTF8.self)
  } catch let exception as NativeLabelOcrException {
    throw exception
  } catch {
    throw NativeLabelOcrException(.encodingFailed, "The label recognition result was unavailable.")
  }
}

private func configuredJsonEncoder() -> JSONEncoder {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
  return encoder
}

private func isVisionCancellation(_ error: Error) -> Bool {
  let nativeError = error as NSError
  return nativeError.domain == VNErrorDomain
    && nativeError.code == VNErrorCode.requestCancelled.rawValue
}
