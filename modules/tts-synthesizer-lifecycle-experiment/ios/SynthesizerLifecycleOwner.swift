enum SynthesizerLifecycleMode: String {
  case retained
  case resetPerUtterance = "reset-per-utterance"
}

struct SynthesizerLifecycleLease<Synthesizer: AnyObject> {
  let synthesizer: Synthesizer
  let instanceIdentifier: Int
  let creationCount: Int
}

final class SynthesizerLifecycleOwner<Synthesizer: AnyObject> {
  private let makeSynthesizer: () -> Synthesizer
  private(set) var currentSynthesizer: Synthesizer
  private(set) var creationCount = 1
  private var hasSubmittedUtterance = false

  init(makeSynthesizer: @escaping () -> Synthesizer) {
    self.makeSynthesizer = makeSynthesizer
    currentSynthesizer = makeSynthesizer()
  }

  func prepareForUtterance(
    mode: SynthesizerLifecycleMode
  ) -> SynthesizerLifecycleLease<Synthesizer> {
    if mode == .resetPerUtterance && hasSubmittedUtterance {
      currentSynthesizer = makeSynthesizer()
      creationCount += 1
    }

    hasSubmittedUtterance = true
    return SynthesizerLifecycleLease(
      synthesizer: currentSynthesizer,
      instanceIdentifier: creationCount,
      creationCount: creationCount
    )
  }
}
