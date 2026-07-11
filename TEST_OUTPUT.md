# Test Output — `part2.test.ts`

Run via:
```
docker exec -i qa-taskboard-assessment-web-1 npx vitest run src/tests/part2.test.ts --reporter=verbose
```

---

## Before Fixes

### Step 1 — Original tests (Test A–C), initial run

These three tests shipped with the starter file and were run first, against the unmodified codebase.

```
× task access control > a viewer cannot update a task
   → expected 200 to be 403

× task access control > a viewer cannot create a task
   → expected 403 to be 401

✓ task access control > a member can create a task
```

**2 failed, 1 passed.**

- **Test A** ("a viewer cannot update a task") — real bug. The endpoint returned `200` when it should have returned `403`. Maps to BUGS.md #3 (viewer role can edit tasks).
- **Test B** ("a viewer cannot create a task") — test-expectation issue, not an application bug. The endpoint correctly returned `403` (authenticated but forbidden), but the test asserted `401`. Fixed by correcting the test's expected status from `401` to `403`.

### Step 2 — After correcting Test B's expectation

With Test B's assertion corrected (`401` → `403`), re-running Tests A–C:

```
× task access control > a viewer cannot update a task
   → expected 200 to be 403

✓ task access control > a viewer cannot create a task
✓ task access control > a member can create a task
```

**1 failed, 2 passed.** Only Test A remained failing — the genuine application bug (BUGS.md #3).

### Step 3 — Additional tests added (Test D–F)

With the suite down to a single known failure, three new tests were added to cover BUGS.md findings #1 and #2, which had no existing coverage:

```
× task access control > a viewer cannot update a task
   → expected 200 to be 403

✓ task access control > a viewer cannot create a task
✓ task access control > a member can create a task
✓ task access control - Additional Checks > task search does not error on an unescaped quote in q
✓ task access control - Additional Checks > task search does not leak user emails or password hashes via a union payload
× task access control - Additional Checks > a non-member cannot update a task in a project they don't belong to
   → expected 200 to be 403
```

### Summary (before fixes, final baseline)

| Test | Maps to | Result |
|---|---|---|
| A — viewer cannot update a task | BUGS.md #3 | **FAIL** (200, expected 403) |
| B — viewer cannot create a task | test-expectation fix applied (401→403) | pass |
| C — member can create a task | — | pass |
| D — search doesn't error on unescaped quote | BUGS.md #1 | pass |
| E — search doesn't leak users via UNION payload | BUGS.md #1 | pass (this specific payload didn't leak — SQL injection is still present via other payload shapes, confirmed manually) |
| F — non-member cannot update a task | BUGS.md #2 | **FAIL** (200, expected 403) |

**Totals: 4 passed, 2 failed (6 tests)** — the two remaining failures (A, F) are both real, reproducible application bugs (BUGS.md #3 and #2 respectively).

---

## After Fixes

_Pending — no source changes have been applied yet. Re-run the command above once the PATCH handler in `src/app/api/tasks/[id]/route.ts` adds the membership/role checks (mirroring `DELETE`) so that both the viewer-role check (Test A) and the membership check (Test F) are enforced. Paste the updated output below once fixed._

```
(results to be filled in after fixes are implemented and tests are re-run)
```

### Summary (after fixes)

| Test | Maps to | Result |
|---|---|---|
| A — viewer cannot update a task | BUGS.md #3 | _pending_ |
| B — viewer cannot create a task | — | _pending_ |
| C — member can create a task | — | _pending_ |
| D — search doesn't error on unescaped quote | BUGS.md #1 | _pending_ |
| E — search doesn't leak users via UNION payload | BUGS.md #1 | _pending_ |
| F — non-member cannot update a task | BUGS.md #2 | _pending_ |
