import XCTest

// Real native UI only. The coordinator supplies a freshly installed ordinary
// staging application; this test neither resets nor seeds its private stores.
@MainActor
final class C47NativeUI: XCTestCase {
    private var application: XCUIApplication?
    private let deadline: TimeInterval = 30
    private var scrollAttempt = 0

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 300
        let environment = ProcessInfo.processInfo.environment
        XCTAssertEqual(environment["C47_RUNTIME_LANE"], "normal-staging")
        let identifier = try XCTUnwrap(environment["C47_BUNDLE_ID"])
        XCTAssertFalse(identifier.isEmpty)
        application = XCUIApplication(bundleIdentifier: identifier)
    }

    override func tearDownWithError() throws {
        if let app = application {
            capture("final-observed-state", app)
        }
    }

    private func capture(_ name: String, _ app: XCUIApplication) {
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = name + "-screen"
        screen.lifetime = .keepAlways
        add(screen)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = name + "-accessibility-hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        let observation = XCTAttachment(string:
            "lane=normal-staging\nstate=\(name)\napplicationState=\(app.state.rawValue)\n")
        observation.name = name + "-observation"
        observation.lifetime = .keepAlways
        add(observation)
    }

    private func button(_ label: String, _ app: XCUIApplication) -> XCUIElement {
        app.buttons.matching(identifier: label).firstMatch
    }

    private func text(_ label: String, _ app: XCUIApplication) -> XCUIElement {
        app.staticTexts.matching(identifier: label).firstMatch
    }

    private func requireVisible(_ element: XCUIElement, _ description: String) {
        XCTAssertTrue(element.waitForExistence(timeout: deadline), description)
        if !element.isHittable, let app = application {
            let scroll = app.scrollViews.firstMatch
            if scroll.exists {
                // A present control below the viewport must be reached with
                // actual bounded native scrolling before declaring it blocked.
                for upward in [true, true, true, false, false, false] {
                    if element.isHittable { break }
                    if upward { scroll.swipeUp() } else { scroll.swipeDown() }
                    scrollAttempt += 1
                    capture("native-scroll-\(scrollAttempt)", app)
                }
            }
        }
        XCTAssertTrue(element.isHittable, description + " must be reachable through native UI")
    }

    private func tap(_ label: String, _ app: XCUIApplication) {
        let control = button(label, app)
        requireVisible(control, label)
        XCTAssertTrue(control.isEnabled, label + " must be enabled before tapping")
        control.tap()
    }

    private func fill(_ label: String, _ value: String, _ app: XCUIApplication) {
        let field = app.textFields.matching(identifier: label).firstMatch
        requireVisible(field, label)
        field.tap()
        if let existing = field.value as? String,
           !existing.isEmpty,
           existing != field.placeholderValue {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
        }
        field.typeText(value)
        XCTAssertEqual(field.value as? String, value, label + " did not accept the synthetic input")
    }

    private func assertPrivateJourneysClosed(_ app: XCUIApplication) {
        XCTAssertFalse(text("Morning routine", app).exists)
        XCTAssertFalse(button("Add a product to your shelf", app).exists)
        XCTAssertFalse(button("Save this plan", app).exists)
    }

    private func surviveInForeground(_ app: XCUIApplication) {
        XCTAssertEqual(app.state, .runningForeground)
        let leftForeground = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in app.state != .runningForeground }, object: nil)
        leftForeground.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [leftForeground], timeout: 5), .completed,
            "The actual application left the foreground during the startup observation")
    }

    private func reopenAgeAfterProcessRestart(_ app: XCUIApplication) {
        app.terminate()
        XCTAssertEqual(app.state, .notRunning)
        app.launch()
        let age = app.textFields.matching(identifier: "Day of birth").firstMatch
        let begin = button("Begin", app)
        let appeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in age.exists || begin.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [appeared], timeout: deadline), .completed)
        capture("underage-process-restart", app)
        assertPrivateJourneysClosed(app)
        XCTAssertFalse(button("I agree. Continue", app).exists)
        if begin.exists { tap("Begin", app) }
        requireVisible(age, "Age confirmation after process restart")
    }

    func testNormalStagingAgeConsentAndUnavailableAccount() throws {
        let app = try XCTUnwrap(application)
        app.launch()
        requireVisible(button("Begin", app), "Fresh ordinary staging Welcome")
        requireVisible(button("I already have an account", app), "Existing account entry")
        surviveInForeground(app)
        capture("fresh-welcome", app)
        assertPrivateJourneysClosed(app)

        // The normal existing-account route is also protected by the age gate.
        tap("I already have an account", app)
        requireVisible(app.textFields["Day of birth"], "Account entry must first confirm age")
        XCTAssertFalse(app.textFields["Email address"].exists)
        let next = button("Continue", app)
        requireVisible(next, "Age Continue")
        XCTAssertFalse(next.isEnabled, "Blank age input must not proceed")
        capture("age-empty-guard", app)

        fill("Day of birth", "31", app)
        fill("Month of birth", "02", app)
        fill("Year of birth", "1990", app)
        XCTAssertTrue(text("Enter a real birth date that is not in the future.", app)
            .waitForExistence(timeout: deadline))
        XCTAssertFalse(next.isEnabled, "An impossible date must not proceed")
        capture("age-invalid-date", app)

        fill("Day of birth", "01", app)
        fill("Month of birth", "01", app)
        let underageYear = Calendar(identifier: .gregorian).component(.year, from: Date()) - 10
        fill("Year of birth", String(underageYear), app)
        tap("Continue", app)
        let refused = app.staticTexts.matching(
            NSPredicate(format: "label BEGINSWITH %@", "You need to be at least 18 to use ")
        ).firstMatch
        XCTAssertTrue(refused.waitForExistence(timeout: deadline), "Under-threshold input must be refused")
        capture("underage-refused", app)
        assertPrivateJourneysClosed(app)

        reopenAgeAfterProcessRestart(app)
        fill("Day of birth", "01", app)
        fill("Month of birth", "01", app)
        fill("Year of birth", "1990", app)
        tap("Continue", app)
        requireVisible(button("I agree. Continue", app), "Separate health consent")
        requireVisible(button("I don't agree", app), "Separate consent refusal")
        capture("consent-before-choice", app)
        assertPrivateJourneysClosed(app)
        tap("I don't agree", app)
        XCTAssertTrue(text("No consent recorded", app).waitForExistence(timeout: deadline))
        capture("consent-declined", app)
        assertPrivateJourneysClosed(app)

        // This is a same-Simulator process restart, not physical durability.
        app.terminate()
        app.launch()
        requireVisible(button("Begin", app), "Welcome after unconsented process restart")
        assertPrivateJourneysClosed(app)
        tap("I already have an account", app)
        XCTAssertTrue(text("Account sign-in is not available right now. You can continue without an account.", app)
            .waitForExistence(timeout: deadline), "Unconfigured auth must report its actual boundary")
        XCTAssertFalse(app.textFields["Email address"].exists)
        XCTAssertFalse(button("Email me a code", app).exists)
        capture("account-provider-unavailable", app)
        tap("Not now", app)
        requireVisible(button("I agree. Continue", app), "Consent remains required after account deferral")
        capture("account-deferral-consent-guard", app)
        assertPrivateJourneysClosed(app)
    }
}

import UIKit

// A separate, explicitly selected Debug/development lane. It reuses the existing
// anonymous-owner fixture, real UI and native stores. It grants no Pro access.
@MainActor
final class C47InternalOwnerUI: XCTestCase {
    private var application: XCUIApplication?
    private let deadline: TimeInterval = 40
    private var sequence = 0
    private let cleanser = "C47 synthetic cleanser"
    private let moisturiser = "C47 synthetic moisturiser"
    private let note = "C47 synthetic observation: used the test cleanser."
    private let correction = "C47 synthetic correction: used the test cleanser once."
    private var exportFolder = ""

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 900
        let environment = ProcessInfo.processInfo.environment
        XCTAssertEqual(environment["C47_RUNTIME_LANE"], "internal-supported-owner")
        XCTAssertEqual(environment["C47_EXPECTED_FIXTURE"], "anonymous_owner")
        exportFolder = try XCTUnwrap(environment["C47_EXPORT_FOLDER"])
        XCTAssertNotNil(exportFolder.range(of: "^C47 Synthetic Export [a-f0-9]{16}$", options: .regularExpression))
        let identifier = try XCTUnwrap(environment["C47_BUNDLE_ID"])
        let initialURL = try XCTUnwrap(environment["C47_INITIAL_URL"])
        let parsed = try XCTUnwrap(URLComponents(string: initialURL))
        XCTAssertEqual(parsed.scheme, "http")
        XCTAssertTrue(parsed.host == "127.0.0.1" || parsed.host == "localhost")
        XCTAssertNil(parsed.user)
        XCTAssertNil(parsed.password)
        let app = XCUIApplication(bundleIdentifier: identifier)
        app.launchArguments = ["--initialUrl", initialURL]
        application = app
    }

    override func tearDownWithError() throws {
        if let app = application { capture("final-observed-state", app) }
    }

    private func capture(_ name: String, _ app: XCUIApplication) {
        sequence += 1
        let prefix = String(format: "internal-%03d-", sequence) + name
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = prefix + "-screen"
        screen.lifetime = .keepAlways
        add(screen)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = prefix + "-hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        let observation = XCTAttachment(string:
            "lane=internal-supported-owner\nfixture=anonymous_owner\nstate=\(name)\n" +
            "applicationState=\(app.state.rawValue)\n" +
            "qualification=Synthetic Debug owner; no provider authentication, Pro, clinical or release admission.\n")
        observation.name = prefix + "-observation"
        observation.lifetime = .keepAlways
        add(observation)
    }

    private func control(_ label: String, _ app: XCUIApplication) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@",
            label, label + ". ")).firstMatch
    }

    private func prefixedControl(_ prefix: String, _ app: XCUIApplication) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    private func text(_ label: String, _ app: XCUIApplication) -> XCUIElement {
        app.staticTexts.matching(identifier: label).firstMatch
    }

    private func reveal(_ element: XCUIElement, _ name: String, _ app: XCUIApplication) {
        XCTAssertTrue(element.waitForExistence(timeout: deadline), name)
        if !element.isHittable {
            let scroll = app.scrollViews.firstMatch
            if scroll.exists {
                for upward in [true, true, true, true, true, false, false, false, false, false] {
                    if element.isHittable { break }
                    if upward { scroll.swipeUp() } else { scroll.swipeDown() }
                    capture("scroll-to-" + name, app)
                }
            }
        }
        XCTAssertTrue(element.isHittable, name + " must be reachable through native UI")
    }

    private func tapElement(_ element: XCUIElement, _ name: String, _ app: XCUIApplication) {
        reveal(element, name, app)
        let enabled = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in element.exists && element.isEnabled }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: deadline), .completed,
            name + " remained disabled")
        element.tap()
    }

    private func tap(_ label: String, _ app: XCUIApplication) {
        tapElement(control(label, app), label, app)
    }

    private func tab(_ label: String, _ app: XCUIApplication) {
        let element = app.buttons.matching(NSPredicate(format:
            "label == %@ OR label BEGINSWITH %@", label, label + ",")).firstMatch
        tapElement(element, label + " tab", app)
    }

    private func fill(_ label: String, _ value: String, _ app: XCUIApplication) {
        let single = app.textFields.matching(identifier: label).firstMatch
        let multiple = app.textViews.matching(identifier: label).firstMatch
        let appeared = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in single.exists || multiple.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [appeared], timeout: deadline), .completed, label)
        let field = single.exists ? single : multiple
        reveal(field, label, app)
        field.tap()
        if let existing = field.value as? String, !existing.isEmpty, existing != field.placeholderValue {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
        }
        field.typeText(value)
        XCTAssertEqual(field.value as? String, value)
    }

    private func product(_ name: String, _ app: XCUIApplication) -> XCUIElement {
        prefixedControl(name + ",", app)
    }

    private func addProduct(_ name: String, _ category: String, _ app: XCUIApplication) {
        tap("Add a product to your shelf", app)
        fill("Product name", name, app)
        fill("Brand", "C47 synthetic", app)
        tap("Category", app)
        tap("Category, " + category, app)
        tap("Continue", app)
        XCTAssertTrue(text("When did you open it?", app).waitForExistence(timeout: deadline))
        let opened = app.descendants(matching: .any).matching(identifier: "Just opened it").firstMatch
        tapElement(opened, "Just opened it", app)
        capture("opened-before-explicit-add", app)
        let add = control("Add to shelf", app)
        reveal(add, "Add to shelf", app)
        XCTAssertTrue(add.isEnabled)
        add.doubleTap()
        reveal(product(name, app), "Saved synthetic product", app)
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name + ",")).count, 1,
            "A rapid double press must leave one Shelf row")
        capture("manual-opened-shelf-double-submit-readback", app)
    }

    private func onboard(_ app: XCUIApplication) {
        tap("Begin", app)
        fill("Day of birth", "01", app)
        fill("Month of birth", "01", app)
        fill("Year of birth", "1990", app)
        tap("Continue", app)
        capture("synthetic-age-consent-separation", app)
        tap("I agree. Continue", app)
        tapElement(prefixedControl("Clear skin", app), "Clear skin synthetic goal", app)
        tapElement(prefixedControl("Barrier repair", app), "Barrier repair synthetic goal", app)
        tap("Continue", app)
        let answers = ["Shiny in places", "Rarely", "Often stings, burns, or reddens", "Frequently",
            "Yes, noticeably", "Weeks or longer", "Fine lines or firmness changes are visible",
            "A lot over time", "Sometimes burns", "Tone 4", "None that I know of", "No"]
        for (index, answer) in answers.enumerated() {
            tap(answer, app)
            tap(index == answers.count - 1 ? "See my profile" : "Next", app)
        }
        tap("Skip for now", app)
        let revealTitle = app.staticTexts.matching(NSPredicate(format:
            "label CONTAINS %@", "YOUR SKIN PROFILE")).firstMatch
        XCTAssertTrue(revealTitle.waitForExistence(timeout: 60))
        capture("synthetic-profile-through-real-onboarding", app)
        tap("Continue", app)
        tap("Not now", app)
        let remindersOff = app.staticTexts.matching(NSPredicate(format:
            "label == %@ OR label == %@", "Reminders are off. Your choice was saved.",
            "Your off choice is saved, but delivery is unconfirmed.")).firstMatch
        XCTAssertTrue(remindersOff.waitForExistence(timeout: deadline))
        capture("reminder-off-actual-native-outcome", app)
        tap("Continue", app)
        tap("Not now", app)
        tap("Continue with the free plan", app)
        reveal(control("Add a product to your shelf", app).exists ? control("Add a product to your shelf", app)
            : app.buttons.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@", "Shelf", "Shelf,")).firstMatch,
            "Free-plan native app", app)
        capture("free-plan-no-pro-grant", app)
    }

    private func recordNoteAndCorrection(_ app: XCUIApplication) {
        tap("Record a change (optional)", app)
        XCTAssertTrue(text("Your optional change notes", app).waitForExistence(timeout: deadline))
        tap("Record a change (optional)", app)
        tap("Other personal note", app)
        fill("Your factual note", note, app)
        tap("Review this change", app)
        XCTAssertFalse(control("Correct entry 1", app).exists,
            "Reviewing a draft must not append a confirmed event")
        capture("unconfirmed-synthetic-note-review", app)
        tap("Confirm and save this change", app)
        XCTAssertTrue(text("Saved on this device and read back.", app).waitForExistence(timeout: deadline))
        reveal(text(note, app), "Confirmed synthetic note", app)
        tap("Correct entry 1", app)
        tap("Other personal note", app)
        fill("Your factual note", correction, app)
        tap("Review this change", app)
        tap("Confirm and save this change", app)
        reveal(text(correction, app), "Appended correction", app)
        XCTAssertTrue(text(note, app).exists, "A correction must preserve the original factual event")
        capture("original-and-appended-correction", app)
    }

    private func observedExportControl(_ labels: [String], _ app: XCUIApplication) -> XCUIElement? {
        for label in labels {
            let elements = app.descendants(matching: .any).matching(identifier: label).allElementsBoundByIndex
            if let element = elements.first(where: { $0.exists && $0.isHittable && $0.isEnabled }) {
                return element
            }
        }
        return nil
    }

    private func waitObservedExportControl(_ labels: [String], _ app: XCUIApplication,
                                           timeout: TimeInterval = 5) -> XCUIElement? {
        let available = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.observedExportControl(labels, app) != nil
        }, object: nil)
        guard XCTWaiter.wait(for: [available], timeout: timeout) == .completed else { return nil }
        return observedExportControl(labels, app)
    }

    private func exportObservation(_ outcome: String, local: Bool, dispatched: Bool,
                                   dispatchMilliseconds: Int64 = 0,
                                   returnedToOwnerControls: Bool = false) throws {
        let data = try JSONSerialization.data(withJSONObject: [
            "lane": "internal-supported-owner",
            "export_outcome": outcome,
            "local_location_selected": local,
            "save_dispatched": dispatched,
            "folder_token": exportFolder,
            "folder_navigation_confirmed": local,
            "provider": local ? "on_my_iphone" : "unavailable",
            "dispatch_epoch_ms": dispatchMilliseconds,
            "returned_to_owner_controls": returnedToOwnerControls,
            "qualification": "A save request needs fresh host destination existence, schema and hash proof before local_saved can be issued. No export contents or paths are recorded here.",
        ], options: [.prettyPrinted, .sortedKeys])
        let evidence = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        evidence.name = "native-local-export-outcome"
        evidence.lifetime = .keepAlways
        add(evidence)
    }

    private func cancelExport(_ app: XCUIApplication) throws {
        capture("local-export-destination-unavailable-before-cancel", app)
        // Folder-name prompts, the picker and the share surface may be separate
        // actual layers. Close only observed cancel controls, with a fixed bound.
        for _ in 0..<3 {
            let export = control("Export my data", app)
            if export.exists && export.isHittable { break }
            let cancel = try XCTUnwrap(waitObservedExportControl(["Cancel", "Close"], app),
                "The actual native export surface has no reachable cancel control")
            capture("observed-export-layer-before-cancel", app)
            cancel.tap()
        }
        reveal(control("Export my data", app), "Owner controls after export cancellation", app)
        try exportObservation("cancelled_unavailable", local: false, dispatched: false,
                              returnedToOwnerControls: true)
        capture("native-export-cancelled-unavailable-no-destination-claim", app)
    }

    private func requestObservedLocalExport(_ app: XCUIApplication) throws {
        tap("Export my data", app)
        let shareClose = app.buttons.matching(identifier: "Close").firstMatch
        let shareCancel = app.buttons.matching(identifier: "Cancel").firstMatch
        let shareOpened = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in shareClose.exists || shareCancel.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [shareOpened], timeout: deadline), .completed,
            "Owner-requested export must open its actual native share surface")
        capture("owner-requested-native-export-sheet", app)
        var saveToFiles = observedExportControl(["Save to Files"], app)
        for _ in 0..<4 {
            if saveToFiles != nil { break }
            let scroll = app.scrollViews.allElementsBoundByIndex.first { $0.isHittable }
            guard let scroll = scroll else { break }
            scroll.swipeUp()
            capture("observing-native-share-local-actions", app)
            saveToFiles = observedExportControl(["Save to Files"], app)
        }
        guard let saveToFiles = saveToFiles else { try cancelExport(app); return }
        capture("observed-save-to-files-before-selection", app)
        saveToFiles.tap()
        let pickerCancel = app.buttons.matching(identifier: "Cancel").firstMatch
        XCTAssertTrue(pickerCancel.waitForExistence(timeout: deadline))
        capture("native-files-save-picker-initial", app)

        var localLocation = observedExportControl(["On My iPhone"], app)
        for _ in 0..<3 {
            if localLocation != nil { break }
            guard let browse = observedExportControl(["Browse", "Locations", "Back"], app) else { break }
            capture("observed-files-navigation-before-local-location", app)
            browse.tap()
            capture("observing-files-local-locations", app)
            localLocation = observedExportControl(["On My iPhone"], app)
        }
        guard let localLocation = localLocation else { try cancelExport(app); return }
        capture("observed-on-my-iphone-before-selection", app)
        localLocation.tap()
        let localBar = app.navigationBars.matching(identifier: "On My iPhone").firstMatch
        guard localBar.waitForExistence(timeout: 10) else { try cancelExport(app); return }
        capture("confirmed-native-local-location", app)
        if let downloads = observedExportControl(["Downloads"], app) {
            capture("observed-local-downloads-before-selection", app)
            downloads.tap()
            XCTAssertTrue(app.navigationBars["Downloads"].waitForExistence(timeout: 10))
            capture("confirmed-local-downloads-destination", app)
        }

        // Only a freshly named synthetic folder is eligible. A general Downloads
        // Save or share-sheet dismissal cannot be promoted to a saved export.
        XCTAssertFalse(app.descendants(matching: .any).matching(identifier: exportFolder).firstMatch.exists,
            "The host-selected synthetic folder must not already be present")
        var newFolder = waitObservedExportControl(["New Folder", "New folder"], app)
        if newFolder == nil, let more = observedExportControl(["More", "More actions"], app) {
            capture("observed-local-picker-actions-before-selection", app)
            more.tap()
            capture("actual-local-picker-actions", app)
            newFolder = waitObservedExportControl(["New Folder", "New folder"], app)
        }
        guard let newFolder = newFolder else {
            try cancelExport(app)
            return
        }
        do {
            capture("observed-local-new-folder-before-selection", app)
            newFolder.tap()
            let prompt = app.alerts.firstMatch
            if prompt.waitForExistence(timeout: 5), prompt.textFields.firstMatch.exists {
                let field = prompt.textFields.firstMatch
                field.tap()
                if let existing = field.value as? String, existing != field.placeholderValue {
                    field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
                }
                field.typeText(exportFolder)
                XCTAssertEqual(field.value as? String, exportFolder)
                if let create = waitObservedExportControl(["Create"], app) {
                    capture("local-synthetic-folder-awaiting-confirmation", app)
                    create.tap()
                } else {
                    if let cancel = observedExportControl(["Cancel"], app) { cancel.tap() }
                    try cancelExport(app)
                    return
                }
            }
            capture("local-synthetic-folder-picker-outcome", app)
        }
        guard app.navigationBars.matching(identifier: exportFolder).firstMatch.waitForExistence(timeout: 10) else {
            try cancelExport(app)
            return
        }
        capture("unique-synthetic-local-folder-confirmed-before-save", app)
        guard let save = observedExportControl(["Save"], app) else { try cancelExport(app); return }
        capture("local-export-awaiting-explicit-save", app)
        let dispatchMilliseconds = Int64(Date().timeIntervalSince1970 * 1000)
        save.tap()
        let returned = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let export = self.control("Export my data", app)
            return export.exists && export.isHittable
        }, object: nil)
        let returnResult = XCTWaiter.wait(for: [returned], timeout: deadline)
        capture("local-export-save-request-native-outcome", app)
        // Dismissal alone is deliberately insufficient. The host must inspect
        // a fresh destination and validate its schema and hash without content.
        try exportObservation("verification_required", local: true, dispatched: true,
                              dispatchMilliseconds: dispatchMilliseconds,
                              returnedToOwnerControls: returnResult == .completed)
        XCTAssertEqual(returnResult, .completed,
            "The requested local Save did not return to the application; retain this uncertain outcome")
    }

    func test01CoreRetainedNativeJourney() throws {
        let app = try XCTUnwrap(application)
        app.launch()
        reveal(control("Begin", app), "Fresh internal Debug Welcome", app)
        capture("explicit-internal-owner-lane-start", app)
        onboard(app)
        tab("Shelf", app)
        addProduct(cleanser, "Cleanser", app)
        addProduct(moisturiser, "Moisturiser (tube)", app)

        // Existing native routes require Pro. A synthetic owner cannot grant it.
        tab("You", app)
        tap("Your plan", app)
        XCTAssertTrue(text("Unlock your full routine.", app).waitForExistence(timeout: deadline))
        XCTAssertFalse(control("Save this plan", app).exists)
        capture("plan-order-history-refused-without-native-pro-authority", app)
        tap("Maybe later", app)
        tab("Today", app)
        let check = app.descendants(matching: .any).matching(NSPredicate(format:
            "label == %@ AND elementType != %d", cleanser, XCUIElement.ElementType.staticText.rawValue)).firstMatch
        reveal(check, "Synthetic Today check-off", app)
        XCTAssertTrue(check.isEnabled)
        check.tap()
        let recorded = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in check.exists && !check.isEnabled }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [recorded], timeout: deadline), .completed,
            "Actual Today readback must mark the recorded check-off disabled")
        capture("today-native-checkoff-readback", app)
        recordNoteAndCorrection(app)

        app.terminate()
        XCTAssertEqual(app.state, .notRunning)
        app.launch()
        let begin = control("Begin", app)
        let shelfTab = app.buttons.matching(NSPredicate(format:
            "label == %@ OR label BEGINSWITH %@", "Shelf", "Shelf,")).firstMatch
        let restart = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in begin.exists || shelfTab.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [restart], timeout: 60), .completed)
        capture("same-simulator-debug-process-restart", app)
        if begin.exists { tap("Begin", app) }
        // Reentry uses the existing owner publication. No test-store writes or
        // automatic consent grant are used to force a successful restart.
        reveal(shelfTab, "Existing owner app reentry", app)
        tab("Shelf", app)
        reveal(product(cleanser, app), "Cleanser persists after process restart", app)
        reveal(product(moisturiser, app), "Moisturiser persists after process restart", app)
        capture("native-shelf-persistence-readback", app)
        tab("Today", app)
        let persistedCheck = app.descendants(matching: .any).matching(NSPredicate(format:
            "label == %@ AND elementType != %d", cleanser, XCUIElement.ElementType.staticText.rawValue)).firstMatch
        reveal(persistedCheck, "Persisted Today fact", app)
        XCTAssertFalse(persistedCheck.isEnabled)
        tap("Record a change (optional)", app)
        reveal(text(note, app), "Original note survives process restart", app)
        reveal(text(correction, app), "Correction survives process restart", app)
        capture("native-today-note-correction-persistence", app)

        tab("Shelf", app)
        tapElement(product(cleanser, app), "Open synthetic cleanser", app)
        tap("Edit period after opening", app)
        fill("PAO months printed on label", "7", app)
        tap("Confirm label PAO value", app)
        let paoInput = app.textFields.matching(identifier: "PAO months printed on label").firstMatch
        let paoClosed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !paoInput.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [paoClosed], timeout: deadline), .completed)
        tap("Back", app)
        tapElement(product(cleanser, app), "Reopen edited synthetic cleanser", app)
        tap("Edit period after opening", app)
        reveal(paoInput, "Persisted custom PAO months", app)
        XCTAssertEqual(paoInput.value as? String, "7")
        capture("native-shelf-edit-seven-months-reopened-readback", app)
        tap("Edit period after opening", app)
        tap("Back", app)
        tab("Today", app)
        reveal(persistedCheck, "Today fact remains after Shelf edit", app)
        XCTAssertFalse(persistedCheck.isEnabled)
        if !text("Your optional change notes", app).exists { tap("Record a change (optional)", app) }
        reveal(text(note, app), "Original note unchanged after Shelf edit", app)
        reveal(text(correction, app), "Correction unchanged after Shelf edit", app)
        capture("native-shelf-edit-preserves-today-fact-and-notes", app)
        tab("Shelf", app)
        tapElement(product(cleanser, app), "Open edited cleanser before finishing", app)
        tap("Mark finished", app)
        XCTAssertTrue(control("Add a product to your shelf", app).waitForExistence(timeout: deadline))
        XCTAssertFalse(product(cleanser, app).exists)
        tapElement(prefixedControl("View archive,", app), "View finished product archive", app)
        reveal(product(cleanser, app), "Finished synthetic product retained in archive", app)
        capture("native-finish-archive-readback", app)
        tap("Back", app)
        tapElement(product(moisturiser, app), "Open synthetic moisturiser", app)
        tap("Remove or discard", app)
        tap("Remove completely", app)
        XCTAssertTrue(control("Add a product to your shelf", app).waitForExistence(timeout: deadline))
        XCTAssertFalse(product(moisturiser, app).exists)
        capture("explicit-local-shelf-removal-readback", app)

        tab("Progress", app)
        XCTAssertTrue(text("Unlock your private photo timeline.", app).waitForExistence(timeout: deadline))
        XCTAssertFalse(control("Capture photo", app).exists)
        capture("diary-guarded-without-pro-no-camera-claim", app)
        tap("Maybe later", app)
        tab("You", app)
        capture("core-finished-synthetic-data-and-consent-retained-for-host-observation", app)
    }

    // The host selects this case between retained-core observation and rights,
    // after setting and reading back the actual Simulator Dynamic Type setting.
    func test03LargerTextManualInput() throws {
        let app = try XCTUnwrap(application)
        XCTAssertEqual(UIApplication.shared.preferredContentSizeCategory,
            UIContentSizeCategory.accessibilityExtraExtraExtraLarge,
            "This case requires the actual largest accessibility text setting")
        app.terminate()
        app.launch()
        let begin = control("Begin", app)
        let shelfTab = app.buttons.matching(NSPredicate(format:
            "label == %@ OR label BEGINSWITH %@", "Shelf", "Shelf,")).firstMatch
        let reentry = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in begin.exists || shelfTab.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [reentry], timeout: 60), .completed)
        if begin.exists { tap("Begin", app) }
        reveal(shelfTab, "Existing synthetic owner larger-text reentry", app)
        tab("Shelf", app)
        tap("Add a product to your shelf", app)
        let unconfirmedName = "C47 unconfirmed larger text cleanser"
        fill("Product name", unconfirmedName, app)
        fill("Brand", "C47 synthetic", app)
        tap("Category", app)
        tap("Category, Cleanser", app)
        fill("Ingredients", "Aqua, Glycerin", app)
        let fields: [(String, XCUIElement)] = [
            ("product_name", app.textFields["Product name"]),
            ("brand", app.textFields["Brand"]),
            ("category", control("Category, Cleanser", app)),
            ("ingredients", app.textViews["Ingredients"]),
            ("continue", control("Continue", app)),
        ]
        var frames: [[String: Any]] = []
        for (name, element) in fields {
            reveal(element, "Largest text manual " + name, app)
            XCTAssertGreaterThanOrEqual(element.frame.height, 44,
                name + " must retain a native interaction target")
            XCTAssertGreaterThan(element.frame.width, 0)
            XCTAssertTrue(element.isEnabled)
            frames.append([
                "control": name,
                "x": Double(element.frame.origin.x),
                "y": Double(element.frame.origin.y),
                "width": Double(element.frame.width),
                "height": Double(element.frame.height),
                "hittable": element.isHittable,
                "enabled": element.isEnabled,
            ])
            capture("largest-text-manual-" + name + "-reachable", app)
        }
        let frameData = try JSONSerialization.data(withJSONObject: [
            "lane": "internal-supported-owner",
            "content_size": "accessibility-extra-extra-extra-large",
            "controls": frames,
            "qualification": "Actual native frames and reachability; synthetic draft remains unconfirmed.",
        ], options: [.prettyPrinted, .sortedKeys])
        let frameEvidence = XCTAttachment(data: frameData, uniformTypeIdentifier: "public.json")
        frameEvidence.name = "largest-text-manual-control-frames"
        frameEvidence.lifetime = .keepAlways
        add(frameEvidence)
        // Cancel the real intake draft. Continue and Add are never dispatched.
        tap("Cancel", app)
        reveal(control("Add a product to your shelf", app), "Shelf after cancelling large-text draft", app)
        XCTAssertFalse(product(unconfirmedName, app).exists,
            "Unconfirmed larger-text input must not create a Shelf product")
        capture("largest-text-draft-cancelled-without-save", app)
    }

    // The host executes this case only after retaining the core xcresult and
    // content-free observation of native persistence. This case never reseeds.
    private func enterExistingOwnerRights() throws -> XCUIApplication {
        let app = try XCTUnwrap(application)
        app.terminate()
        app.launch()
        let begin = control("Begin", app)
        let youTab = app.buttons.matching(NSPredicate(format:
            "label == %@ OR label BEGINSWITH %@", "You", "You,")).firstMatch
        let reentry = XCTNSPredicateExpectation(
            predicate: NSPredicate { _, _ in begin.exists || youTab.exists }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [reentry], timeout: 60), .completed)
        if begin.exists { tap("Begin", app) }
        reveal(youTab, "Existing synthetic owner rights reentry without seeding", app)
        tab("You", app)
        capture("rights-starts-from-existing-core-data", app)
        return app
    }

    func test02LocalExport() throws {
        try requestObservedLocalExport(enterExistingOwnerRights())
    }

    // This is selected only after the host verifies the real destination file.
    // Delete acts on the exact new synthetic folder, never another Files item.
    func test04RemoveSyntheticLocalExport() throws {
        let files = XCUIApplication(bundleIdentifier: "com.apple.DocumentsApp")
        files.launch()
        capture("files-cleanup-actual-start", files)
        var local = observedExportControl(["On My iPhone"], files)
        for _ in 0..<4 {
            if local != nil { break }
            guard let back = observedExportControl(["Browse", "Locations", "Back", "Downloads", "On My iPhone"], files) else { break }
            back.tap()
            local = observedExportControl(["On My iPhone"], files)
        }
        var dispatched = false
        if let local = local {
            local.tap()
            if files.navigationBars["On My iPhone"].waitForExistence(timeout: 10) {
                if let downloads = observedExportControl(["Downloads"], files) {
                    downloads.tap()
                    XCTAssertTrue(files.navigationBars["Downloads"].waitForExistence(timeout: 10))
                }
                let folders = files.cells.matching(NSPredicate(format: "label == %@ OR label BEGINSWITH %@",
                    exportFolder, exportFolder + ","))
                if folders.count == 1 && folders.firstMatch.isHittable {
                    capture("unique-synthetic-folder-before-files-delete", files)
                    folders.firstMatch.press(forDuration: 1)
                    capture("actual-files-synthetic-folder-actions", files)
                    if let delete = waitObservedExportControl(["Delete"], files) {
                        delete.tap()
                        if files.alerts.firstMatch.waitForExistence(timeout: 2),
                           let confirm = waitObservedExportControl(["Delete"], files) { confirm.tap() }
                        dispatched = true
                        capture("files-synthetic-folder-delete-dispatched", files)
                    }
                }
            }
        }
        let data = try JSONSerialization.data(withJSONObject: [
            "lane": "internal-supported-owner", "folder_token": exportFolder,
            "cleanup_outcome": dispatched ? "verification_required" : "unavailable",
            "delete_dispatched": dispatched,
            "qualification": "Host must verify the chosen destination disappeared. Trash, backups and secure erasure are not qualified.",
        ], options: [.prettyPrinted, .sortedKeys])
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = "native-local-export-cleanup-outcome"
        attachment.lifetime = .keepAlways
        add(attachment)
        capture("files-cleanup-final-observed-state", files)
    }

    func test05ConsentWithdrawal() throws {
        let app = try enterExistingOwnerRights()
        tap("Withdraw health-data consent", app)
        capture("withdrawal-awaiting-explicit-confirmation", app)
        tap("Cancel", app)
        XCTAssertTrue(control("Your plan", app).exists,
            "Canceling withdrawal must retain normal account UI")
        _ = try enterExistingOwnerRights()
        tab("Shelf", app)
        tapElement(prefixedControl("View archive,", app), "Archive after unconfirmed withdrawal restart", app)
        reveal(product(cleanser, app), "Finished cleanser retained after withdrawal cancellation", app)
        capture("native-unconfirmed-withdrawal-restart-retains-archive", app)
        tap("Back", app)
        tab("Today", app)
        if !text("Your optional change notes", app).exists { tap("Record a change (optional)", app) }
        reveal(text(note, app), "Original note retained after withdrawal cancellation restart", app)
        reveal(text(correction, app), "Correction retained after withdrawal cancellation restart", app)
        capture("native-unconfirmed-withdrawal-restart-retains-notes", app)
        tab("You", app)
        tap("Withdraw health-data consent", app)
        tap("Withdraw health consent", app)
        XCTAssertTrue(text("Your account is still here.", app).waitForExistence(timeout: deadline))
        let localCleanup = app.staticTexts.matching(NSPredicate(format:
            "label CONTAINS %@ AND label CONTAINS %@", "withdrawn", "Local cleanup complete.")).firstMatch
        XCTAssertTrue(localCleanup.waitForExistence(timeout: deadline))
        capture("explicit-withdrawal-local-deletion-confirmed", app)
        app.terminate()
        app.launch()
        XCTAssertTrue(localCleanup.waitForExistence(timeout: 60))
        XCTAssertFalse(product(cleanser, app).exists)
        XCTAssertFalse(product(moisturiser, app).exists)
        XCTAssertFalse(control("Correct entry 1", app).exists)
        capture("withdrawn-process-restart-remains-closed", app)
    }
}
