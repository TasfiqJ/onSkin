Pod::Spec.new do |s|
  s.name             = 'NativeLabelOcr'
  s.version          = '1.0.0'
  s.summary          = 'Bounded on-device label text recognition.'
  s.description      = 'A first-party Expo module that recognizes text in managed temporary label photos with Apple Vision.'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'First-party application team'
  s.homepage         = 'https://github.com/TasfiqJ/onSkin'
  s.source           = { :git => 'https://github.com/TasfiqJ/onSkin.git', :branch => 'main' }
  s.platforms        = { :ios => '17.0' }
  s.swift_version    = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'ImageIO', 'UniformTypeIdentifiers', 'Vision'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
