import AVFoundation
import ExpoModulesCore

private let speakingStarted = "TtsLifecycleExperiment.speakingStarted"
private let speakingWillSayNextString =
  "TtsLifecycleExperiment.speakingWillSayNextString"
private let speakingDone = "TtsLifecycleExperiment.speakingDone"
private let speakingStopped = "TtsLifecycleExperiment.speakingStopped"

extension SynthesizerLifecycleMode: Enumerable {}

private struct TtsSynthesizerLifecycleExperimentSpeechOptions: Record {
  @Field
  var language: String?
  @Field
  var pitch: Double?
  @Field
  var rate: Double?
  @Field
  var voice: String?
  @Field
  var useApplicationAudioSession: Bool?
}

private final class TtsSynthesizerLifecycleExperimentInvalidVoiceException:
  GenericException<String> {
  override var reason: String {
    "Cannot find voice with identifier: \(param)!"
  }
}

protocol TtsSynthesizerLifecycleExperimentResultHandler {
  func didStart(utterance: AVSpeechUtterance)
  func willSpeak(characterRange: NSRange, utterance: AVSpeechUtterance)
  func didCancel(utterance: AVSpeechUtterance)
  func didFinish(utterance: AVSpeechUtterance)
}

final class TtsSynthesizerLifecycleExperimentDelegate:
  NSObject,
  AVSpeechSynthesizerDelegate {
  let resultHandler: TtsSynthesizerLifecycleExperimentResultHandler

  init(resultHandler: TtsSynthesizerLifecycleExperimentResultHandler) {
    self.resultHandler = resultHandler
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didStart utterance: AVSpeechUtterance
  ) {
    resultHandler.didStart(utterance: utterance)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    willSpeakRangeOfSpeechString characterRange: NSRange,
    utterance: AVSpeechUtterance
  ) {
    resultHandler.willSpeak(characterRange: characterRange, utterance: utterance)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didCancel utterance: AVSpeechUtterance
  ) {
    resultHandler.didCancel(utterance: utterance)
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer,
    didFinish utterance: AVSpeechUtterance
  ) {
    resultHandler.didFinish(utterance: utterance)
  }
}

public final class TtsSynthesizerLifecycleExperimentModule:
  Module,
  TtsSynthesizerLifecycleExperimentResultHandler {
  private var lifecycleOwner: SynthesizerLifecycleOwner<AVSpeechSynthesizer>!
  private var delegate: TtsSynthesizerLifecycleExperimentDelegate?

  public func definition() -> ModuleDefinition {
    Name("TtsSynthesizerLifecycleExperiment")

    OnCreate {
      delegate = TtsSynthesizerLifecycleExperimentDelegate(resultHandler: self)
      let speechDelegate = delegate
      lifecycleOwner = SynthesizerLifecycleOwner {
        let synthesizer = AVSpeechSynthesizer()
        synthesizer.delegate = speechDelegate
        return synthesizer
      }
    }

    Events([
      speakingStarted,
      speakingWillSayNextString,
      speakingDone,
      speakingStopped,
    ])

    AsyncFunction("speak") {
      (
        utteranceId: String,
        text: String,
        options: TtsSynthesizerLifecycleExperimentSpeechOptions,
        mode: SynthesizerLifecycleMode
      ) in
      let utterance = TtsSynthesizerLifecycleExperimentUtterance(
        id: utteranceId,
        text: text
      )

      if let language = options.language {
        utterance.voice = AVSpeechSynthesisVoice(language: language)
      }

      if let voice = options.voice {
        utterance.voice = AVSpeechSynthesisVoice(identifier: voice)

        guard utterance.voice != nil else {
          throw TtsSynthesizerLifecycleExperimentInvalidVoiceException(voice)
        }
      }

      if let pitch = options.pitch {
        utterance.pitchMultiplier = Float(pitch)
      }

      if let rate = options.rate {
        utterance.rate = Float(rate) * AVSpeechUtteranceDefaultSpeechRate
      }

      let lease = lifecycleOwner.prepareForUtterance(mode: mode)
      let synthesizer = lease.synthesizer
      utterance.synthesizerInstanceIdentifier =
        "experimental-synthesizer-\(lease.instanceIdentifier)"
      utterance.synthesizerCreationCount = lease.creationCount

      if let useApplicationAudioSession = options.useApplicationAudioSession {
        synthesizer.usesApplicationAudioSession = useApplicationAudioSession
      }

      synthesizer.speak(utterance)
    }

    AsyncFunction("stop") {
      lifecycleOwner.currentSynthesizer.stopSpeaking(at: .immediate)
    }
  }

  func didStart(utterance: AVSpeechUtterance) {
    guard let utterance =
      utterance as? TtsSynthesizerLifecycleExperimentUtterance else {
      return
    }
    sendEvent(speakingStarted, eventPayload(for: utterance))
  }

  func willSpeak(characterRange: NSRange, utterance: AVSpeechUtterance) {
    guard let utterance =
      utterance as? TtsSynthesizerLifecycleExperimentUtterance else {
      return
    }
    sendEvent(speakingWillSayNextString, [
      "id": utterance.id,
      "charIndex": characterRange.location,
      "charLength": characterRange.length,
      "synthesizerInstanceIdentifier": utterance.synthesizerInstanceIdentifier,
      "synthesizerCreationCount": utterance.synthesizerCreationCount,
    ])
  }

  func didCancel(utterance: AVSpeechUtterance) {
    guard let utterance =
      utterance as? TtsSynthesizerLifecycleExperimentUtterance else {
      return
    }
    sendEvent(speakingStopped, eventPayload(for: utterance))
  }

  func didFinish(utterance: AVSpeechUtterance) {
    guard let utterance =
      utterance as? TtsSynthesizerLifecycleExperimentUtterance else {
      return
    }
    sendEvent(speakingDone, eventPayload(for: utterance))
  }

  private func eventPayload(
    for utterance: TtsSynthesizerLifecycleExperimentUtterance
  ) -> [String: Any] {
    [
      "id": utterance.id,
      "synthesizerInstanceIdentifier": utterance.synthesizerInstanceIdentifier,
      "synthesizerCreationCount": utterance.synthesizerCreationCount,
    ]
  }
}

internal final class TtsSynthesizerLifecycleExperimentUtterance:
  AVSpeechUtterance {
  let id: String
  var synthesizerInstanceIdentifier = ""
  var synthesizerCreationCount = 0

  init(id: String, text: String) {
    self.id = id
    super.init(string: text)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("Not implemented")
  }
}
