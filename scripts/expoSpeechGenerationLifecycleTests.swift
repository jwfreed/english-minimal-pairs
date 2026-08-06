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

    run("successful stop keeps one active and two queued IDs pending until delivery completes") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "active")
      _ = state.registerSubmission(id: "queued-1")
      _ = state.registerSubmission(id: "queued-2")

      let stopped = state.resolveSuccessfulStop()
      precondition(stopped.map { $0.id } == ["active", "queued-1", "queued-2"])
      precondition(stopped.allSatisfy { item in
        item.decision == .deliverTrusted(
          kind: .stopped,
          source: .explicitSuccessfulStop
        )
      })
      precondition(state.pendingExplicitCancellationResolutions == 3)
      precondition(state.trackedOutstandingUtterances == 3)
      precondition(state.trackedOutstandingUtteranceIds == [
        "active", "queued-1", "queued-2",
      ])

      // A second begin cannot request duplicate bridge delivery while the
      // first batch remains lifecycle-owned and pending.
      precondition(state.resolveSuccessfulStop().isEmpty)
      precondition(state.pendingExplicitCancellationResolutions == 3)
      precondition(state.trackedOutstandingUtterances == 3)

      precondition(state.completeSuccessfulStopDelivery(id: "active") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 2)
      precondition(state.trackedOutstandingUtterances == 2)
      precondition(state.trackedOutstandingUtteranceIds == ["queued-1", "queued-2"])
      precondition(state.resolveSuccessfulStop().isEmpty)
      precondition(state.pendingExplicitCancellationResolutions == 2)
      precondition(state.trackedOutstandingUtterances == 2)

      precondition(state.completeSuccessfulStopDelivery(id: "queued-1") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 1)
      precondition(state.trackedOutstandingUtterances == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["queued-2"])

      precondition(state.completeSuccessfulStopDelivery(id: "queued-2") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 0)
      precondition(state.trackedOutstandingUtterances == 0)
      precondition(state.trackedOutstandingUtteranceIds.isEmpty)
    }

    run("submission cannot rotate while successful stop delivery is pending") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "stopping")
      precondition(state.resolveSuccessfulStop().map { $0.id } == ["stopping"])

      let submittedWhilePending = state.registerSubmission(id: "submitted-later")
      precondition(submittedWhilePending.generation == 1)
      precondition(submittedWhilePending.shouldRotateSynthesizer == false)
      precondition(state.pendingExplicitCancellationResolutions == 1)
      precondition(state.trackedOutstandingUtterances == 2)

      precondition(state.completeSuccessfulStopDelivery(id: "stopping") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 0)
      precondition(state.trackedOutstandingUtteranceIds == ["submitted-later"])
    }

    run("delegate terminal for a pending stop ID fails closed without accounting") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "pending-delegate")
      precondition(
        state.resolveSuccessfulStop().map { $0.id } == ["pending-delegate"]
      )

      let (decision, anomaly) = state.resolveDelegateTerminal(
        id: "pending-delegate",
        kind: .stopped,
        source: .delegateCancel
      )

      precondition(decision == .suppressDuplicate)
      precondition(anomaly == .invariantMismatch)
      precondition(state.pendingExplicitCancellationResolutions == 1)
      precondition(state.trackedOutstandingUtterances == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["pending-delegate"])
      precondition(
        state.completeSuccessfulStopDelivery(id: "pending-delegate") == nil
      )
    }

    run("wrong and duplicate stop completions leave the pending batch sticky") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "first")
      _ = state.registerSubmission(id: "second")
      precondition(
        state.resolveSuccessfulStop().map { $0.id } == ["first", "second"]
      )

      precondition(
        state.completeSuccessfulStopDelivery(id: "second") == .invariantMismatch
      )
      precondition(state.pendingExplicitCancellationResolutions == 2)
      precondition(state.trackedOutstandingUtteranceIds == ["first", "second"])

      let submittedAfterMismatch = state.registerSubmission(id: "after-mismatch")
      precondition(submittedAfterMismatch.generation == 1)
      precondition(submittedAfterMismatch.shouldRotateSynthesizer == false)
      precondition(state.pendingExplicitCancellationResolutions == 2)
      precondition(state.trackedOutstandingUtteranceIds == [
        "first", "second", "after-mismatch",
      ])

      precondition(state.completeSuccessfulStopDelivery(id: "first") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["second", "after-mismatch"])

      precondition(
        state.completeSuccessfulStopDelivery(id: "first") == .invariantMismatch
      )
      precondition(state.pendingExplicitCancellationResolutions == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["second", "after-mismatch"])

      precondition(state.completeSuccessfulStopDelivery(id: "second") == nil)
      precondition(state.pendingExplicitCancellationResolutions == 0)
      precondition(state.trackedOutstandingUtteranceIds == ["after-mismatch"])
    }

    run("late cancel after successful stop completion is a duplicate without accounting change") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "explicitly-stopped")

      precondition(
        state.resolveSuccessfulStop().map { $0.id } == ["explicitly-stopped"]
      )
      precondition(
        state.completeSuccessfulStopDelivery(id: "explicitly-stopped") == nil
      )
      _ = state.registerSubmission(id: "still-tracked")

      let countBeforeDuplicate = state.trackedOutstandingUtterances
      let idsBeforeDuplicate = state.trackedOutstandingUtteranceIds
      let (decision, anomaly) = state.resolveDelegateTerminal(
        id: "explicitly-stopped",
        kind: .stopped,
        source: .delegateCancel
      )

      precondition(decision == .suppressDuplicate)
      precondition(anomaly == .duplicateTerminal(id: "explicitly-stopped"))
      precondition(state.trackedOutstandingUtterances == countBeforeDuplicate)
      precondition(state.trackedOutstandingUtteranceIds == idsBeforeDuplicate)
    }

    run("natural cancel delivers one trusted stopped terminal and drains") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "naturally-cancelled")

      let (decision, anomaly) = state.resolveDelegateTerminal(
        id: "naturally-cancelled",
        kind: .stopped,
        source: .delegateCancel
      )

      precondition(decision == .deliverTrusted(
        kind: .stopped,
        source: .delegateCancel
      ))
      precondition(anomaly == nil)
      precondition(state.pendingExplicitCancellationResolutions == 0)
      precondition(state.trackedOutstandingUtterances == 0)
    }

    run("late terminal after resolved-history eviction remains fail-closed") {
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

    run("known outstanding terminal still delivers after terminal history saturation") {
      let state = SpeechGenerationLifecycle()
      _ = state.registerSubmission(id: "known-outstanding")

      for index in 0..<65 {
        let id = "saturating-terminal-\(index)"
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

      precondition(state.trackedOutstandingUtterances == 1)
      precondition(state.trackedOutstandingUtteranceIds == ["known-outstanding"])

      let (decision, anomaly) = state.resolveDelegateTerminal(
        id: "known-outstanding",
        kind: .done,
        source: .delegateFinish
      )
      precondition(decision == .deliverTrusted(
        kind: .done,
        source: .delegateFinish
      ))
      precondition(anomaly == nil)
      precondition(state.trackedOutstandingUtterances == 0)
      precondition(state.trackedOutstandingUtteranceIds.isEmpty)
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
