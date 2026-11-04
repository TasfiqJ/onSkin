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
