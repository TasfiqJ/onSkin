Pod::Spec.new do |s|
  s.name             = 'NativeAgeAssurance'
  s.version          = '1.0.0'
  s.summary          = 'Privacy-minimized Apple declared-age-range bridge.'
  s.description      = 'A first-party Expo module that requests Apple age ranges without collecting an exact birth date.'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'First-party application team'
  s.homepage         = 'https://github.com/TasfiqJ/Layerwell'
  s.source           = { :git => 'https://github.com/TasfiqJ/Layerwell.git', :branch => 'main' }
  s.platforms        = { :ios => '17.0' }
  s.swift_version    = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'UIKit'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
