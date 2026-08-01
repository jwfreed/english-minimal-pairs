# Phase 3.8A.1 — Boundary Verification and Operational Hardening

Date: 2026-08-01

Status: **verified; rollout remains disabled; Phase 3.8B remains blocked**

This review verifies the implemented Phase 3.8A.1 evidence system against the
observer-only constraints in the evidence-completeness proposal and the Phase
3.8 stabilization plan. It does not add an evaluator, change rollout behavior,
or activate migration.

## Dependency boundary

The production reverse-import audit found one importer of diagnostic storage:
`src/analytics/masteryRolloutDiagnostics.ts`, the diagnostic reporting layer.
No learner-facing module, migration orchestrator, rollout-control module, or
feature-flag module imports diagnostic storage or its snapshot read API.

Migration and learner-state storage modules emit fire-and-forget facts through
the reporting interface. They do not read the snapshot, producer manifest,
reliability ledger, or persisted counters. `masteryRolloutSafety.ts` likewise
does not import diagnostic storage; its existing pure gate accepts caller-owned
input and is not wired to runtime diagnostics.

The regression coverage in
`scripts/masteryRolloutDiagnostics.test.js` checks the reverse-import class,
forbidden evidence-read symbols in learner and orchestration paths, feature-flag
isolation, and the absence of evaluator symbols from diagnostic modules.

## Producer/evaluator separation

The producers answer only “what happened?” Their outputs are event outcomes,
counts, provenance, language identity, operation identity, rollout state at the
time of observation, and explicit evidence-loss facts.

The producer and persistence modules do not calculate readiness, confidence,
safety decisions, rollout recommendations, or migration recommendations. Terms
such as `legacyFallbackRatio` and `storageFailureRate` in the producer manifest
declare that the underlying raw numerator/denominator evidence is available;
no rate or threshold is calculated by Phase 3.8A.1. Interpretation remains
Phase 3.8B work.

### Producer-growth guardrail

The producer manifest is an explicit capability declaration, not permission to
collect arbitrary telemetry. Any future diagnostic producer or produced field
must document, in its focused change and regression coverage:

1. The exact runtime fact being observed.
2. Why that fact cannot be derived from existing raw evidence.
3. Why absence of that evidence matters to evidence completeness.

If those questions cannot be answered, the producer does not belong in this
diagnostic package. A producer must still report a raw occurrence or outcome;
it must not add an interpretation, recommendation, threshold, or control path.
The existing manifest/catalogue cross-check remains the structural guard
against an undeclared producer capability. No producer registration framework
is required.

## Storage measurements

Measurements are reproducible with:

```sh
node scripts/measure-mastery-rollout-diagnostics.js
```

The 2026-08-01 reference run used Node v22.21.0 on darwin-x64. Timing values are
developer-machine characterization, not a mobile-device AsyncStorage service
level objective.

| Characteristic | Fixture/result |
|---|---|
| Typical snapshot | One cold start plus clean stable-read, legacy-read, shadow-comparison, and compatibility-write evidence for three languages: 13 events, no open conditions, **5,930 bytes (5.79 KiB)** |
| Structurally saturated snapshot | 100 largest-shape events, 64 open conditions, all 14 language observations, all maps present, and maximum safe-integer counts: **99,898 bytes (97.56 KiB)** |
| Typical serialization | Deterministic sorted JSON; median **0.200 ms**, p95 **0.215 ms** over 100 samples |
| Saturated serialization | Deterministic sorted JSON; median **2.055 ms**, p95 **2.347 ms** over 100 samples |
| In-memory read/parse/reduce/serialize/write | Median **0.525 ms**, p95 **0.612 ms**, max **0.640 ms** over 40 sequential writes |
| Injected-latency adapter | A 15 ms delay on each of the one read and one write produced **35.19 ms** end-to-end, confirming that awaited persistence duration includes storage latency |

The implemented bound is defined by 100 recent events, 64 open reliability
conditions, 14 registered languages, fixed enum-keyed maps, validated strings,
and safe-integer counters. The saturated fixture passes the production parser.
A regression assertion caps that fixture at 100 KiB. The proposal's earlier
~28 KB estimate did not model the full implemented shadow-event shape or
maximum-width counters and is superseded by this measurement.

Every diagnostic persistence operation reads the current snapshot, parses and
reduces it, deterministically serializes the complete bounded snapshot, then
writes the value. Writes are serialized on a diagnostics-only bounded queue.
Learner operations do not await that queue; existing slow/broken-storage tests
prove observer latency and failure cannot delay or change learner-state reads.
No production optimization or schema change was made in response to these
measurements.

### Diagnostic Storage Performance Contract

This contract records current behavior; the developer-machine timing figures
above are characterization boundaries, not mobile-device latency guarantees.

- **Non-blocking:** learner operations emit diagnostics fire-and-forget and
  never await diagnostic reads, serialization, queueing, or writes.
- **Bounded work:** an accepted event performs one diagnostic read and one
  whole-snapshot write. Typical modeled writes are approximately 5.79 KiB; the
  current schema-saturated document is 97.56 KiB and is protected by a 100 KiB
  regression ceiling.
- **Whole-snapshot amplification is explicit:** even when one event causes less
  than 1 KiB of logical growth at the capped ring, persistence rewrites the
  complete large snapshot. The focused append regression preserves this
  observable behavior without treating it as an optimization mandate.
- **Degradation reduces completeness:** slow storage, failed storage, a full
  queue, or process termination may delay or lose diagnostic evidence.
- **Isolation is absolute:** diagnostic latency, failure, loss, or saturation
  must never delay, fail, retry, reorder, or otherwise change a learner
  operation, mastery authority decision, migration decision, feature flag, or
  rollout state.

If device measurements later exceed these expectations, the permitted outcome
is less complete diagnostic evidence. Changing learner behavior to preserve
diagnostics is not permitted.

## Best-effort evidence invariant

This is an explicit operational restatement of the existing provenance and
unknown-state architecture, not a new decision:

> **Diagnostic completeness is not guaranteed. Diagnostic correctness is
> guaranteed when evidence exists. Missing evidence means unknown, never
> safe.**

“Evidence exists” means it survived diagnostic delivery and passed the strict
snapshot validator. A missing snapshot, malformed snapshot, failed write,
queue drop, unexercised producer, or interrupted process cannot be converted
to a clean zero. Delivery-loss counters and producer witnesses preserve this
uncertainty when they are themselves available; they do not make best-effort
delivery complete. Phase 3.8A.1 records these facts. Only a future Phase 3.8B
evaluator may interpret them, and that evaluator remains unwired.

## Diagnostic schema evolution

Diagnostic evidence has intentionally different evolution rules from learner
state:

- Learner state is authoritative and uses explicit migration state and
  compatibility behavior.
- Diagnostic state is non-authoritative, loss-aware operational evidence. It
  must never become migration orchestration.
- A diagnostic v1 snapshot read by the strict v2 parser is classified as
  malformed and replaced in memory with an inert empty v2 snapshot.
- The next diagnostic event writes a valid v2 snapshot to the same
  diagnostics-only key. No v1 data is converted, and no learner-state or
  migration marker is read or written.

Therefore no diagnostic migration mechanism is required or permitted. If an
evidence collection window matters operationally, its snapshot must be exported
before upgrading the diagnostic schema.

## Remaining operational risks

- The timing measurements are Node/in-memory characterizations; actual mobile
  AsyncStorage latency still varies by device and storage pressure.
- A process can terminate before queued best-effort evidence is persisted. The
  queue is deliberately bounded and loss is surfaced when the process remains
  alive long enough to record its self-metrics.
- The implementation rewrites one bounded JSON value per event. The current
  measurements do not justify optimization, but a future schema expansion must
  rerun the measurement and intentionally revise the 100 KiB regression bound.

None of these risks grants diagnostics authority over learner behavior,
migration, feature flags, or rollout. Phase 3.8B remains blocked until its
separate evidence-evaluation work begins.
