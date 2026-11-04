# Generate an isolated UI test target using CocoaPods' existing Xcodeproj gem.
# Nothing is added to the generated application project or production sources.
require 'digest'
require 'fileutils'
require 'json'
require 'pathname'
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
abort 'only the normal staging UI lane is implemented' unless ENV.fetch('C47_UI_PHASE', 'normal-staging') == 'normal-staging'

FileUtils.mkdir_p(output)
abort 'UI output resolves outside RUNNER_TEMP' unless File.realpath(output).start_with?(runner_temp + File::SEPARATOR)
project_root = File.join(output, 'runner')
abort 'refusing to replace an existing UI runner' if File.exist?(project_root) || File.exist?(File.join(output, 'runner.json'))
Dir.mkdir(project_root)
swift_source = File.join(__dir__, 'native_ui47.swift')
swift_copy = File.join(project_root, 'native_ui47.swift')
FileUtils.copy_file(swift_source, swift_copy)
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
scheme.test_action.build_configuration = 'Debug'
scheme.test_action.should_use_launch_scheme_args_env = false
scheme.test_action.environment_variables = Xcodeproj::XCScheme::EnvironmentVariables.new([
  { key: 'C47_BUNDLE_ID', value: bundle_id, enabled: true },
  { key: 'C47_RUNTIME_LANE', value: 'normal-staging', enabled: true },
])
scheme.save_as(project_path, 'C47NativeUI', true)

receipt = {
  schema: 1,
  status: 'UI_RUNNER_GENERATED_NOT_EXECUTED',
  project: project_path,
  scheme: 'C47NativeUI',
  bundle_id: bundle_id,
  lane: 'normal-staging',
  generated_ios_directory: ios_directory,
  tests: ['C47NativeUI/testNormalStagingAgeConsentAndUnavailableAccount'],
  source_sha256: {
    swift: Digest::SHA256.file(swift_source).hexdigest,
    copied_swift: Digest::SHA256.file(swift_copy).hexdigest,
    ruby: Digest::SHA256.file(__FILE__).hexdigest,
  },
  qualification: 'Runner generation only; assertions, screenshots and UI results require actual xcodebuild test execution.',
}
File.write(File.join(output, 'runner.json'), JSON.pretty_generate(receipt) + "\n", mode: 'wx')
puts JSON.generate(receipt)
