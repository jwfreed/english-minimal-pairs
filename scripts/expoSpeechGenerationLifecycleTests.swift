import Foundation

@main
enum SpeechGenerationLifecycleTests {
  static func main() {
    run("first generation drains before the next session rotates") {
      let state = SpeechGenerationLifecycle()

      let first = state.registerSubmission(id: "a")
      precondition(first.generation == 1)
      precondition(first.shouldRotateSynthesizer == false)

      let queued = state.registerSubmission(id: "b")
      precondition(queued.generation == 1)
      precondition(queued.shouldRotateSynthesizer == false)
      precondition(state.trackedOutstandingUtterances == 2)

      _ = state.resolveDelegateTerminal(
        id: "a", kind: .done, source: .delegateFinish
      )
      precondition(state.trackedOutstandingUtterances == 1)

      _ = state.resolveDelegateTerminal(
        id: "b", kind: .done, source: .delegateFinish
      )
      let nextSession = state.registerSubmission(id: "c")
      precondition(nextSession.generation == 2)
      precondition(nextSession.shouldRotateSynthesizer == true)
    }

    run("queued submissions share one generation") {
      let state = SpeechGenerationLifecycle()

      let first = state.registerSubmission(id: "queued-1")
      let second = state.registerSubmission(id: "queued-2")
      let third = state.registerSubmission(id: "queued-3")

      precondition(first.generation == 1)
      precondition(second.generation == 1)
      precondition(third.generation == 1)
      precondition(first.shouldRotateSynthesizer == false)
      precondition(second.shouldRotateSynthesizer == false)
      precondition(third.shouldRotateSynthesizer == false)
      precondition(state.trackedOutstandingUtteranceIds == [
        "queued-1", "queued-2", "queued-3",
      ])
    }

    run("new submissions do not rotate until the final tracked terminal") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "a")
      _ = state.registerSubmission(id: "b")

      _ = state.resolveDelegateTerminal(
        id: "a", kind: .done, source: .delegateFinish
      )
      let whileOutstanding = state.registerSubmission(id: "c")
      precondition(whileOutstanding.generation == 1)
      precondition(whileOutstanding.shouldRotateSynthesizer == false)

      _ = state.resolveDelegateTerminal(
        id: "b", kind: .done, source: .delegateFinish
      )
      let stillOutstanding = state.registerSubmission(id: "d")
      precondition(stillOutstanding.generation == 1)
      precondition(stillOutstanding.shouldRotateSynthesizer == false)

      _ = state.resolveDelegateTerminal(
        id: "c", kind: .done, source: .delegateFinish
      )
      _ = state.resolveDelegateTerminal(
        id: "d", kind: .done, source: .delegateFinish
      )
      let afterDrain = state.registerSubmission(id: "e")
      precondition(afterDrain.generation == 2)
      precondition(afterDrain.shouldRotateSynthesizer == true)
    }

    run("successful stop resolves outstanding IDs once in submission order") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "first")
      _ = state.registerSubmission(id: "second")
      _ = state.registerSubmission(id: "third")

      let stopped = state.resolveSuccessfulStop()
      precondition(stopped.map { $0.id } == ["first", "second", "third"])
      precondition(stopped.allSatisfy { item in
        item.decision == .deliverTrusted(
          kind: .stopped,
          source: .explicitSuccessfulStop
        )
      })
      precondition(state.trackedOutstandingUtterances == 0)
      precondition(state.trackedOutstandingUtteranceIds.isEmpty)
      precondition(state.resolveSuccessfulStop().isEmpty)

      for id in ["first", "second", "third"] {
        let (decision, anomaly) = state.resolveDelegateTerminal(
          id: id,
          kind: .stopped,
          source: .delegateCancel
        )
        precondition(decision == .suppressDuplicate)
        precondition(anomaly == .duplicateTerminal(id: id))
      }
    }

    run("evicted resolved terminals remain fail-closed") {
      let state = SpeechGenerationLifecycle()

      for index in 0..<65 {
        let id = "resolved-\(index)"
        _ = state.registerSubmission(id: id)
        let (decision, anomaly) = state.resolveDelegateTerminal(
          id: id,
          kind: .done,
          source: .delegateFinish
        )
        precondition(decision == .deliverTrusted(
          kind: .done,
          source: .delegateFinish
        ))
        precondition(anomaly == nil)
      }

      let (evictedDecision, evictedAnomaly) = state.resolveDelegateTerminal(
        id: "resolved-0",
        kind: .done,
        source: .delegateFinish
      )
      precondition(evictedDecision == .suppressAfterHistoryEviction)
      precondition(evictedAnomaly == .terminalAfterHistoryEviction(id: "resolved-0"))

      let (retainedDecision, retainedAnomaly) = state.resolveDelegateTerminal(
        id: "resolved-64",
        kind: .done,
        source: .delegateFinish
      )
      precondition(retainedDecision == .suppressDuplicate)
      precondition(retainedAnomaly == .duplicateTerminal(id: "resolved-64"))

      let (newUnknownDecision, newUnknownAnomaly) = state.resolveDelegateTerminal(
        id: "unknown-after-resolved-eviction",
        kind: .done,
        source: .delegateFinish
      )
      precondition(newUnknownDecision == .suppressAfterHistoryEviction)
      precondition(
        newUnknownAnomaly == .terminalAfterHistoryEviction(
          id: "unknown-after-resolved-eviction"
        )
      )
    }

    run("evicted unknown terminals remain fail-closed") {
      let state = SpeechGenerationLifecycle()

      for index in 0..<65 {
        let id = "unknown-\(index)"
        let (decision, anomaly) = state.resolveDelegateTerminal(
          id: id,
          kind: .done,
          source: .delegateFinish
        )
        precondition(decision == .deliverUnknownWithoutAccounting(kind: .done))
        precondition(anomaly == .unknownTerminal(id: id))
      }

      let (evictedDecision, evictedAnomaly) = state.resolveDelegateTerminal(
        id: "unknown-0",
        kind: .done,
        source: .delegateFinish
      )
      precondition(evictedDecision == .suppressAfterHistoryEviction)
      precondition(evictedAnomaly == .terminalAfterHistoryEviction(id: "unknown-0"))

      let (retainedDecision, retainedAnomaly) = state.resolveDelegateTerminal(
        id: "unknown-64",
        kind: .done,
        source: .delegateFinish
      )
      precondition(retainedDecision == .suppressDuplicate)
      precondition(retainedAnomaly == .duplicateTerminal(id: "unknown-64"))

      let (newUnknownDecision, newUnknownAnomaly) = state.resolveDelegateTerminal(
        id: "unknown-after-unknown-eviction",
        kind: .done,
        source: .delegateFinish
      )
      precondition(newUnknownDecision == .suppressAfterHistoryEviction)
      precondition(
        newUnknownAnomaly == .terminalAfterHistoryEviction(
          id: "unknown-after-unknown-eviction"
        )
      )
    }

    run("failed stop leaves all outstanding IDs tracked") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "a")
      _ = state.registerSubmission(id: "b")

      precondition(state.noteFailedStop() == .stopFailedWithOutstanding(count: 2))
      precondition(state.trackedOutstandingUtterances == 2)
      precondition(state.trackedOutstandingUtteranceIds == ["a", "b"])

      _ = state.resolveDelegateTerminal(
        id: "a", kind: .stopped, source: .delegateCancel
      )
      precondition(state.trackedOutstandingUtterances == 1)
      precondition(state.noteFailedStop() == .stopFailedWithOutstanding(count: 1))
    }

    run("unknown callbacks never decrement trusted accounting") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "tracked")

      let (decision, anomaly) = state.resolveDelegateTerminal(
        id: "unknown",
        kind: .done,
        source: .delegateFinish
      )
      precondition(decision == .deliverUnknownWithoutAccounting(kind: .done))
      precondition(anomaly == .unknownTerminal(id: "unknown"))
      precondition(state.trackedOutstandingUtterances == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["tracked"])
    }

    run("repeated unknown callbacks emit at most one public terminal") {
      let state = SpeechGenerationLifecycle()

      let (firstDecision, firstAnomaly) = state.resolveDelegateTerminal(
        id: "unknown",
        kind: .done,
        source: .delegateFinish
      )
      precondition(firstDecision == .deliverUnknownWithoutAccounting(kind: .done))
      precondition(firstAnomaly == .unknownTerminal(id: "unknown"))

      let (secondDecision, secondAnomaly) = state.resolveDelegateTerminal(
        id: "unknown",
        kind: .stopped,
        source: .delegateCancel
      )
      precondition(secondDecision == .suppressDuplicate)
      precondition(secondAnomaly == .duplicateTerminal(id: "unknown"))
      precondition(state.trackedOutstandingUtterances == 0)
    }

    run("synthesizer idle observation does not rotate with missing terminals") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "missing")

      precondition(
        state.observeSynthesizerIdle()
          == .missingTerminalWhileSynthesizerIdle(count: 1)
      )
      precondition(state.trackedOutstandingUtterances == 1)

      let queued = state.registerSubmission(id: "queued")
      precondition(queued.generation == 1)
      precondition(queued.shouldRotateSynthesizer == false)
      precondition(state.trackedOutstandingUtterances == 2)
    }

    run("terminal operations cannot underflow outstanding accounting") {
      let state = SpeechGenerationLifecycle()

      precondition(state.trackedOutstandingUtterances == 0)
      _ = state.resolveDelegateTerminal(
        id: "never-submitted",
        kind: .done,
        source: .delegateFinish
      )
      precondition(state.trackedOutstandingUtterances == 0)
      _ = state.resolveDelegateTerminal(
        id: "never-submitted",
        kind: .stopped,
        source: .delegateCancel
      )
      precondition(state.trackedOutstandingUtterances == 0)
      precondition(state.resolveSuccessfulStop().isEmpty)
      precondition(state.trackedOutstandingUtterances == 0)

      _ = state.registerSubmission(id: "submitted")
      _ = state.resolveDelegateTerminal(
        id: "submitted",
        kind: .done,
        source: .delegateFinish
      )
      _ = state.resolveDelegateTerminal(
        id: "submitted",
        kind: .stopped,
        source: .delegateCancel
      )
      precondition(state.trackedOutstandingUtterances == 0)
    }

    run("empty state observations do not report anomalies") {
      let state = SpeechGenerationLifecycle()

      precondition(state.noteFailedStop() == nil)
      precondition(state.observeSynthesizerIdle() == nil)
    }
  }

  private static func run(_ name: String, body: () -> Void) {
    body()
    print("ok - \(name)")
  }
}
