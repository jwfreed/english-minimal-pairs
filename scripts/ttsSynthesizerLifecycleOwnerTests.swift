import Foundation

private final class FakeSynthesizer {
  let identifier: Int

  init(identifier: Int) {
    self.identifier = identifier
  }
}

@main
private struct TtsSynthesizerLifecycleOwnerTests {
  static func main() {
    var retainedFactoryCount = 0
    let retainedOwner = SynthesizerLifecycleOwner<FakeSynthesizer> {
      retainedFactoryCount += 1
      return FakeSynthesizer(identifier: retainedFactoryCount)
    }

    let retainedLeases = (0..<3).map { _ in
      retainedOwner.prepareForUtterance(mode: .retained)
    }

    precondition(retainedFactoryCount == 1)
    precondition(retainedLeases.map(\.instanceIdentifier) == [1, 1, 1])
    precondition(retainedLeases.map(\.creationCount) == [1, 1, 1])
    precondition(retainedLeases.allSatisfy {
      $0.synthesizer === retainedLeases[0].synthesizer
    })

    var resetFactoryCount = 0
    let resetOwner = SynthesizerLifecycleOwner<FakeSynthesizer> {
      resetFactoryCount += 1
      return FakeSynthesizer(identifier: resetFactoryCount)
    }

    let resetLeases = (0..<3).map { _ in
      resetOwner.prepareForUtterance(mode: .resetPerUtterance)
    }

    precondition(resetFactoryCount == 3)
    precondition(resetLeases.map(\.instanceIdentifier) == [1, 2, 3])
    precondition(resetLeases.map(\.creationCount) == [1, 2, 3])
    precondition(resetLeases[0].synthesizer !== resetLeases[1].synthesizer)
    precondition(resetLeases[1].synthesizer !== resetLeases[2].synthesizer)

    print("ok - retained instance 1,1,1; reset instances 1,2,3")
  }
}
