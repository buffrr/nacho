Pod::Spec.new do |s|
  s.name           = 'Ocr'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition via Apple Vision'
  s.description    = 'Local Expo module wrapping VNRecognizeTextRequest for the Scan tab.'
  s.author         = ''
  s.homepage       = 'https://nacho.local'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
