require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'TtsSynthesizerLifecycleExperiment'
  s.version        = package['version']
  s.summary        = 'Temporary iOS TTS synthesizer lifecycle experiment.'
  s.description    = 'Development-only retained-versus-reset AVSpeechSynthesizer probe.'
  s.license        = { :type => 'Proprietary' }
  s.author         = 'Soundwise'
  s.homepage       = 'https://github.com/jwfreed/english-minimal-pairs'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/jwfreed/english-minimal-pairs.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
