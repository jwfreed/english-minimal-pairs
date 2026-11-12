# Learner progress persistence guarantees

Applies to the active (legacy) storage scheme: mastery in `@mastery_<label>`
and attempt history in `@pairProgress_v2`. The writers are
`src/hooks/useContrastPairs.ts` and `src/storage/progressStorage.ts`.

## While the app is running

- A mutation is `pending` from the moment it is made until storage
  acknowledges it. A rejected write is retried twice (0.3 s, 1.5 s), then again
  on every new practice round (mastery) or the next answer (history).
- One write at a time per store, always of the latest value: an older value
  never lands after a newer one, one category never overwrites another, and a
  reset is ordered after any write already in flight.
- History attempts are written exactly once. If storage rejects a write that
  it actually committed, the next pass recognises the stored bytes and does
  not append the attempts again. Attempts are never compared by value.
- A stored value that is not entirely valid is never rewritten. Its valid
  entries stay readable and saving is `blocked`.

## What is not guaranteed

Unsaved work is held in process memory only. There is no durable journal.

| Situation | Outcome |
|---|---|
| App terminated while a mastery write is unacknowledged | Storage keeps the last acknowledged level for that category. At most the unacknowledged promotions or placement since then are lost. Normally this window is a few milliseconds; it is longer only while storage is rejecting writes. |
| App terminated while history attempts are pending | Those attempts are lost. Stored history is unchanged. |
| App terminated before a reset is acknowledged | The reset did not happen: the stored value is still there on next launch. |
| A storage call never settles | That store's writer waits on it: later writes for the store queue behind it and stay `pending`. Nothing is lost while the app runs, nothing is written, and the learner sees no notice because no write has failed. There is deliberately no timeout: abandoning a write that may still complete could let an older value land after a newer one. |
| Storage rejects every write for the whole session | Practice continues in memory with the "progress can't be saved" notice. Everything since the last acknowledged write is lost on exit. |

Nothing above deletes or overwrites data that was already stored.
