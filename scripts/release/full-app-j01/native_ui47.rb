# Generate an isolated UI test target using CocoaPods' existing Xcodeproj gem.
# Nothing is added to the generated application project or production sources.
require 'digest'
require 'fileutils'
require 'json'
require 'pathname'
require 'uri'
require 'xcodeproj'

abort 'usage: ruby native_ui47.rb <generated-ios-directory> <evidence/ui>' unless ARGV.length == 2
ios_directory = File.realpath(ARGV[0])
abort 'expected one generated application project' unless Dir.glob(File.join(ios_directory, '*.xcodeproj')).length == 1
runner_temp = File.realpath(ENV.fetch('RUNNER_TEMP'))
output = File.expand_path(ARGV[1])
relative_output = Pathname.new(output).relative_path_from(Pathname.new(runner_temp)).each_filename.to_a
abort 'UI output must stay inside RUNNER_TEMP' if relative_output.empty? || relative_output.first == '..'
bundle_id = ENV.fetch('C47_BUNDLE_ID')
abort 'invalid application bundle id' unless /\A[A-Za-z0-9][A-Za-z0-9.-]+\z/.match?(bundle_id)
lane = ENV.fetch('C47_UI_PHASE', 'normal-staging')
abort 'unsupported UI lane' unless ['normal-staging', 'internal-supported-owner'].include?(lane)
internal = lane == 'internal-supported-owner'
test_class = internal ? 'C47InternalOwnerUI' : 'C47NativeUI'
test_methods = internal ? ['test01CoreRetainedNativeJourney', 'test03LargerTextManualInput', 'test02LocalExport', 'test04RemoveSyntheticLocalExport', 'test05ConsentWithdrawal'] : ['testNormalStagingAgeConsentAndUnavailableAccount']
if internal
  abort 'internal fixture requires the development build profile' unless ENV['APP_VARIANT'] == 'development' && ENV['EXPO_PUBLIC_APP_ENV'] == 'development'
  abort 'internal fixture must be the existing anonymous owner' unless ENV['EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH'] == 'anonymous_owner'
  abort 'no local Pro grant is permitted' unless ENV.fetch('EXPO_PUBLIC_CUSTOM_PRO_GRANT_ENABLED', 'false') == 'false'
  provider_variables = %w[EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY EXPO_PUBLIC_REVENUECAT_IOS_KEY EXPO_PUBLIC_REVENUECAT_ANDROID_KEY EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY EXPO_PUBLIC_POSTHOG_KEY EXPO_PUBLIC_SENTRY_DSN]
  abort 'internal lane must have no provider configuration' unless provider_variables.all? { |key| ENV.fetch(key, '').empty? }
  initial_url = ENV.fetch('C47_INITIAL_URL')
  parsed_url = URI.parse(initial_url)
  abort 'internal Metro URL must be localhost without credentials' unless parsed_url.scheme == 'http' && ['localhost', '127.0.0.1'].include?(parsed_url.host) && parsed_url.userinfo.nil?
  export_folder = ENV.fetch('C47_EXPORT_FOLDER')
  abort 'export folder must be a unique synthetic name' unless /\AC47 Synthetic Export [a-f0-9]{16}\z/.match?(export_folder)
end

FileUtils.mkdir_p(output)
abort 'UI output resolves outside RUNNER_TEMP' unless File.realpath(output).start_with?(runner_temp + File::SEPARATOR)
project_root = File.join(output, 'runner')
abort 'refusing to replace an existing UI runner' if File.exist?(project_root) || File.exist?(File.join(output, 'runner.json'))
Dir.mkdir(project_root)
swift_source = File.join(__dir__, 'native_ui47.swift')
swift_copy = File.join(project_root, 'native_ui47.swift')
swift_full = File.binread(swift_source)
historical_swift = IO.popen(['git', '--no-replace-objects', 'show', '445472ce057b90f08b5a51d5a49167c757d34b79:scripts/release/full-app-j01/native_ui47.swift'], 'rb', &:read)
historical_normal = historical_swift.byteslice(0, 8736)
abort 'frozen historical normal Swift prefix changed' unless $?.success? && historical_normal && Digest::SHA256.hexdigest(historical_normal) == 'b57511fd34c67d0a39e9acb712d86d6ea19d90213b468bce7c1a528612487c44'
normal_swift = swift_full.byteslice(0, 9568)
abort 'synchronized current normal Swift prefix changed' unless normal_swift && normal_swift.bytesize == 9568 && Digest::SHA256.hexdigest(normal_swift) == '686d434f567f4da623134279617e4b91754d4bf0497968efe07d2100d94c59c7'
swift_selected = internal ? swift_full : normal_swift
File.binwrite(swift_copy, swift_selected)
project_path = File.join(project_root, 'C47NativeUI.xcodeproj')
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:ui_test_bundle, 'C47NativeUI', :ios, '17.0')
target.source_build_phase.add_file_reference(project.main_group.new_file('native_ui47.swift'))
project.build_configurations.each do |configuration|
  configuration.build_settings['SDKROOT'] = 'iphonesimulator'
  configuration.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  configuration.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
  configuration.build_settings['CODE_SIGN_IDENTITY'] = ''
end
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'internal.c47.native-ui',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'IPHONEOS_DEPLOYMENT_TARGET' => '17.0',
    'SDKROOT' => 'iphonesimulator',
    'SUPPORTED_PLATFORMS' => 'iphonesimulator',
    'TARGETED_DEVICE_FAMILY' => '1',
    'SWIFT_VERSION' => '5.0',
    'FRAMEWORK_SEARCH_PATHS' => [
      '$(inherited)',
      '$(PLATFORM_DIR)/Developer/Library/Frameworks',
      '$(SDKROOT)/Developer/Library/Frameworks',
    ],
    'CODE_SIGNING_ALLOWED' => 'NO',
    'CODE_SIGNING_REQUIRED' => 'NO',
    'CODE_SIGN_IDENTITY' => '',
    'ENABLE_USER_SCRIPT_SANDBOXING' => 'YES',
    'TEST_TARGET_NAME' => '',
  })
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
testable = scheme.test_action.testables.fetch(0)
testable.use_test_selection_whitelist = true
selected_test = Xcodeproj::XCScheme::TestAction::TestableReference::Test.new
selected_test.identifier = test_class
testable.selected_tests = [selected_test]
scheme.test_action.build_configuration = 'Debug'
scheme.test_action.should_use_launch_scheme_args_env = false
environment_variables = [
  { key: 'C47_BUNDLE_ID', value: bundle_id, enabled: true },
  { key: 'C47_RUNTIME_LANE', value: lane, enabled: true },
]
if internal
  environment_variables += [
    { key: 'C47_EXPECTED_FIXTURE', value: 'anonymous_owner', enabled: true },
    { key: 'C47_INITIAL_URL', value: initial_url, enabled: true },
    { key: 'C47_EXPORT_FOLDER', value: export_folder, enabled: true },
  ]
end
scheme.test_action.environment_variables = Xcodeproj::XCScheme::EnvironmentVariables.new(environment_variables)
scheme.save_as(project_path, 'C47NativeUI', true)

receipt = {
  schema: 1,
  status: 'UI_RUNNER_GENERATED_NOT_EXECUTED',
  project: project_path,
  scheme: 'C47NativeUI',
  bundle_id: bundle_id,
  lane: lane,
  generated_ios_directory: ios_directory,
  tests: test_methods.map { |test_method| "C47NativeUI/#{test_class}/#{test_method}" },
  selected_test_class: test_class,
  fixture: internal ? 'existing_debug_development_anonymous_owner_no_pro' : nil,
  initial_url: internal ? initial_url : nil,
  export_folder: internal ? export_folder : nil,
  copied_source_scope: internal ? 'FULL_INTERNAL_TEST_SOURCE' : 'FROZEN_NORMAL_PREFIX_ONLY',
  copied_source_bytes: swift_selected.bytesize,
  normal_prefix_sha256: Digest::SHA256.hexdigest(normal_swift),
  source_sha256: {
    swift: Digest::SHA256.file(swift_source).hexdigest,
    copied_swift: Digest::SHA256.file(swift_copy).hexdigest,
    ruby: Digest::SHA256.file(__FILE__).hexdigest,
  },
  qualification: 'Runner generation only; assertions, screenshots and UI results require actual xcodebuild test execution.',
}
File.write(File.join(output, 'runner.json'), JSON.pretty_generate(receipt) + "\n", mode: 'wx')
puts JSON.generate(receipt)
