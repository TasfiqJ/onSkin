import ExpoModulesCore
import Foundation
import UIKit

#if canImport(DeclaredAgeRange)
import DeclaredAgeRange
#endif

private let ageAssuranceContractVersion = 1
private let ageAssuranceReviewStatus = "launch_blocked"
private let ageAssuranceProvider = "apple_declared_age_range"
private let ageAssuranceMinimumAge = 16
private let ageAssuranceMinimumRuntime = "iOS 26.2"
private let ageAssuranceMinimumSdk = "iOS 26.2"

private enum AgeAssuranceFailureCode: String {
  case invalidRequest = "E_AGE_ASSURANCE_INVALID_REQUEST"
  case busy = "E_AGE_ASSURANCE_BUSY"
  case presentationUnavailable = "E_AGE_ASSURANCE_PRESENTATION_UNAVAILABLE"
  case appleConfigurationInvalid = "E_AGE_ASSURANCE_APPLE_CONFIGURATION_INVALID"
  case invalidOutput = "E_AGE_ASSURANCE_INVALID_OUTPUT"
  case encodingFailed = "E_AGE_ASSURANCE_ENCODING_FAILED"
}

private final class NativeAgeAssuranceException: Exception {
  private let stableCode: String
  private let stableReason: String

  init(_ code: AgeAssuranceFailureCode, _ reason: String) {
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

private enum AgeAssuranceAvailability: String, Encodable {
  case available
  case unsupportedOs = "unsupported_os"
  case sdkUnavailable = "sdk_unavailable"
  case notAvailable = "not_available"
}

private enum AgeAssuranceRegulatoryEligibility: String, Encodable {
  case eligible
  case notEligible = "not_eligible"
  case unknown
}

private enum AgeAssuranceSharingStatus: String, Encodable {
  case shared
  case declined
  case notRequested = "not_requested"
}

private struct AgeAssuranceRange: Encodable {
  let lowerBound: Int?
  let upperBound: Int?
}

private struct AgeAssuranceParentalControls: Encodable {
  let anyEnabled: Bool
  let communicationLimitsEnabled: Bool
}

private struct AgeAssuranceResponse: Encodable {
  let schemaVersion: Int
  let requestId: String
  let availability: AgeAssuranceAvailability
  let regulatoryEligibility: AgeAssuranceRegulatoryEligibility
  let sharingStatus: AgeAssuranceSharingStatus
  let ageRange: AgeAssuranceRange?
  let declaration: String
  let parentalControls: AgeAssuranceParentalControls?
}

public final class NativeAgeAssuranceModule: Module, @unchecked Sendable {
  @MainActor private var requestInFlight = false

  public func definition() -> ModuleDefinition {
    Name("NativeAgeAssurance")

    Constant("ageAssuranceContractVersion") { ageAssuranceContractVersion }
    Constant("ageAssuranceReviewStatus") { ageAssuranceReviewStatus }
    Constant("ageAssuranceProvider") { ageAssuranceProvider }
    Constant("ageAssuranceMinimumAge") { ageAssuranceMinimumAge }
    Constant("ageAssuranceMinimumRuntime") { ageAssuranceMinimumRuntime }
    Constant("ageAssuranceMinimumSdk") { ageAssuranceMinimumSdk }
    Constant("ageAssuranceExactBirthDateCollected") { false }

    AsyncFunction("requestDeclaredAgeRangeJSON") {
      (requestId: String) async throws -> String in
      try await self.requestDeclaredAgeRangeJSON(requestId: requestId)
    }
  }

  @MainActor
  private func requestDeclaredAgeRangeJSON(requestId: String) async throws -> String {
    try validateCanonicalRequestId(requestId)
    guard !requestInFlight else {
      throw NativeAgeAssuranceException(
        .busy,
        "Another declared age range request is active."
      )
    }
    requestInFlight = true
    defer { requestInFlight = false }

    #if canImport(DeclaredAgeRange)
    guard #available(iOS 26.2, *) else {
      return try encodeResponse(
        unavailableResponse(
          requestId: requestId,
          availability: .unsupportedOs,
          regulatoryEligibility: .unknown
        )
      )
    }
    guard let viewController = appContext?.utilities?.currentViewController() else {
      throw NativeAgeAssuranceException(
        .presentationUnavailable,
        "The declared age range sheet cannot be presented."
      )
    }

    let eligibility: AgeAssuranceRegulatoryEligibility
    do {
      eligibility = try await AgeRangeService.shared.isEligibleForAgeFeatures
        ? .eligible
        : .notEligible
    } catch AgeRangeService.Error.invalidRequest {
      throw NativeAgeAssuranceException(
        .appleConfigurationInvalid,
        "The Apple declared age range configuration is invalid."
      )
    } catch AgeRangeService.Error.notAvailable {
      return try encodeResponse(
        unavailableResponse(
          requestId: requestId,
          availability: .notAvailable,
          regulatoryEligibility: .unknown
        )
      )
    } catch {
      return try encodeResponse(
        unavailableResponse(
          requestId: requestId,
          availability: .notAvailable,
          regulatoryEligibility: .unknown
        )
      )
    }

    do {
      let response = try await AgeRangeService.shared.requestAgeRange(
        ageGates: ageAssuranceMinimumAge,
        in: viewController
      )
      switch response {
      case .declinedSharing:
        return try encodeResponse(
          AgeAssuranceResponse(
            schemaVersion: ageAssuranceContractVersion,
            requestId: requestId,
            availability: .available,
            regulatoryEligibility: eligibility,
            sharingStatus: .declined,
            ageRange: nil,
            declaration: "not_provided",
            parentalControls: nil
          )
        )
      case .sharing(let range):
        try validateRange(lowerBound: range.lowerBound, upperBound: range.upperBound)
        return try encodeResponse(
          AgeAssuranceResponse(
            schemaVersion: ageAssuranceContractVersion,
            requestId: requestId,
            availability: .available,
            regulatoryEligibility: eligibility,
            sharingStatus: .shared,
            ageRange: AgeAssuranceRange(
              lowerBound: range.lowerBound,
              upperBound: range.upperBound
            ),
            declaration: declarationName(range.ageRangeDeclaration),
            parentalControls: AgeAssuranceParentalControls(
              anyEnabled: !range.activeParentalControls.isEmpty,
              communicationLimitsEnabled:
                range.activeParentalControls.contains(.communicationLimits)
            )
          )
        )
      @unknown default:
        return try encodeResponse(
          unavailableResponse(
            requestId: requestId,
            availability: .notAvailable,
            regulatoryEligibility: eligibility
          )
        )
      }
    } catch AgeRangeService.Error.invalidRequest {
      throw NativeAgeAssuranceException(
        .appleConfigurationInvalid,
        "The Apple declared age range configuration is invalid."
      )
    } catch AgeRangeService.Error.notAvailable {
      return try encodeResponse(
        unavailableResponse(
          requestId: requestId,
          availability: .notAvailable,
          regulatoryEligibility: eligibility
        )
      )
    } catch let exception as NativeAgeAssuranceException {
      throw exception
    } catch {
      return try encodeResponse(
        unavailableResponse(
          requestId: requestId,
          availability: .notAvailable,
          regulatoryEligibility: eligibility
        )
      )
    }
    #else
    return try encodeResponse(
      unavailableResponse(
        requestId: requestId,
        availability: .sdkUnavailable,
        regulatoryEligibility: .unknown
      )
    )
    #endif
  }
}

private func unavailableResponse(
  requestId: String,
  availability: AgeAssuranceAvailability,
  regulatoryEligibility: AgeAssuranceRegulatoryEligibility
) -> AgeAssuranceResponse {
  AgeAssuranceResponse(
    schemaVersion: ageAssuranceContractVersion,
    requestId: requestId,
    availability: availability,
    regulatoryEligibility: regulatoryEligibility,
    sharingStatus: .notRequested,
    ageRange: nil,
    declaration: "not_provided",
    parentalControls: nil
  )
}

private func validateCanonicalRequestId(_ requestId: String) throws {
  guard isCanonicalUuidV4(requestId) else {
    throw NativeAgeAssuranceException(
      .invalidRequest,
      "The declared age range request identifier is invalid."
    )
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

private func validateRange(lowerBound: Int?, upperBound: Int?) throws {
  let maximumRepresentableAge = 150
  guard lowerBound != nil || upperBound != nil else {
    throw NativeAgeAssuranceException(
      .invalidOutput,
      "Apple returned an empty declared age range."
    )
  }
  if let lowerBound,
     lowerBound < 0 || lowerBound > maximumRepresentableAge {
    throw NativeAgeAssuranceException(
      .invalidOutput,
      "Apple returned an invalid declared age range."
    )
  }
  if let upperBound,
     upperBound < 0 || upperBound > maximumRepresentableAge {
    throw NativeAgeAssuranceException(
      .invalidOutput,
      "Apple returned an invalid declared age range."
    )
  }
  if let lowerBound, let upperBound, lowerBound > upperBound {
    throw NativeAgeAssuranceException(
      .invalidOutput,
      "Apple returned an invalid declared age range."
    )
  }
}

private func encodeResponse(_ response: AgeAssuranceResponse) throws -> String {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  do {
    let data = try encoder.encode(response)
    guard let json = String(data: data, encoding: .utf8) else {
      throw NativeAgeAssuranceException(
        .encodingFailed,
        "The declared age range result is unavailable."
      )
    }
    return json
  } catch let exception as NativeAgeAssuranceException {
    throw exception
  } catch {
    throw NativeAgeAssuranceException(
      .encodingFailed,
      "The declared age range result is unavailable."
    )
  }
}

#if canImport(DeclaredAgeRange)
@available(iOS 26.2, *)
private func declarationName(
  _ declaration: AgeRangeService.AgeRangeDeclaration?
) -> String {
  guard let declaration else { return "not_provided" }
  switch declaration {
  case .selfDeclared:
    return "self_declared"
  case .guardianDeclared:
    return "guardian_declared"
  case .checkedByOtherMethod:
    return "checked_by_other_method"
  case .guardianCheckedByOtherMethod:
    return "guardian_checked_by_other_method"
  case .governmentIDChecked:
    return "government_id_checked"
  case .guardianGovernmentIDChecked:
    return "guardian_government_id_checked"
  case .paymentChecked:
    return "payment_checked"
  case .guardianPaymentChecked:
    return "guardian_payment_checked"
  @unknown default:
    return "unknown"
  }
}
#endif
