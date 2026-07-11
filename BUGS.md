# Bug Report

Ranked by business impact (highest first).

---

## 1. SQL Injection in Task Search (`?q=` parameter)

- **Severity:** Critical
- **Category:** Security / Data Integrity
- **Files:** `src/app/api/projects/[id]/tasks/route.ts` (lines 25-35)

The `q` search parameter is interpolated directly into a raw SQL string and executed via `prisma.$queryRawUnsafe`, with no parameterization or escaping (`WHERE project_id = '${projectId}' AND (title ILIKE '%${q}%' ...)`). This allows an authenticated user to inject arbitrary SQL through the task search endpoint, including UNION-based queries to read data from unrelated tables such as `users` (emails, password hashes). Verified exploitable via `GET /api/projects/:id/tasks?q=' UNION SELECT ... FROM users--`.

---

## 2. Any Non-Member Can Edit Any Task

- **Severity:** Critical
- **Category:** Security
- **Files:** `src/app/api/tasks/[id]/route.ts` (PATCH handler, lines 16-38); contrast with `DELETE` handler (lines 40-57) in the same file, which correctly calls `getProjectMembership` and `canEditTasks`.

The `PATCH /api/tasks/:id` handler only verifies that the requester is authenticated (`getCurrentUser`) and never checks whether they belong to the task's project. Any registered user — including one with zero memberships anywhere in the system — can modify the title, description, status, or assignee of any task in any project. Verified: a freshly registered user with no project memberships successfully changed a task's title and status in a project it was denied direct read access to (`GET /api/projects/:id` correctly returned 403, but `PATCH /api/tasks/:id` returned 200).

---

## 3. Viewer Role Can Edit Tasks (Business Logic / Authorization Bypass)

- **Severity:** Critical
- **Category:** Security / Architecture

- **Files:** `src/app/api/tasks/[id]/route.ts` (PATCH handler); role rule defined in `src/lib/auth.ts` (`canEditTasks`, lines 55-57: `role === "admin" || role === "member"` — deliberately excludes `viewer`).

The `viewer` project role is defined to explicitly exclude edit permissions (enforced correctly in the `DELETE` handler, which returns "viewers cannot delete tasks"), but `PATCH` performs no role check at all. A user with `viewer` membership on a project can therefore edit any task within it, directly violating the app's own permission model. Verified: `dev@example.com` (role: `viewer` on "Q3 Launch") successfully changed a task title via `PATCH /api/tasks/:id`, returning 200 instead of the expected 403.

> When a viewer edits a task via `PATCH /api/tasks/:id`, the app applies the change and returns 200, but should reject the request with 403 (consistent with the viewer restriction already enforced on task deletion).

---

## 4. Login Form Pre-fills Live Admin Credentials

- **Severity:** Medium-High
- **Category:** Security
- **Files:** `src/app/login/page.tsx` (lines 10-11)

The login form's email and password fields are initialized with hardcoded default state — `useState("meera@taskboard.dev")` and `useState("password123")` — rather than empty strings, and neither input sets an `autoComplete` attribute. This means the credentials of a real seeded admin account (`meera@taskboard.dev`, an `admin` on two projects) are visibly populated in the form the moment the login page loads, requiring no lookup or guessing. Any person with access to the running instance can sign in as this admin account without ever needing to know the password.

> When any user opens the login page, the app pre-fills the email and password fields with a real admin account's live credentials, but should render the form with empty fields and no embedded credentials.
