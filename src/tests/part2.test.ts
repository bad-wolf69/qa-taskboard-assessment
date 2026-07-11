// @vitest-environment node
// Part 2 starter — do not modify the test descriptions or setup
// Requires the dev server running on http://localhost:3000

import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const data = (await res.json()) as { token: string };
  return data.token;
}

let tokens: { meera: string; arjun: string; dev: string };
let projectId: string;
let taskId: string;

beforeAll(async () => {
  const [meera, arjun, dev] = await Promise.all([
    login("meera@taskboard.dev"),
    login("arjun@taskboard.dev"),
    login("dev@example.com"),
  ]);
  tokens = { meera, arjun, dev };

  const projectsRes = await fetch(`${BASE_URL}/api/projects`, {
    headers: { Authorization: `Bearer ${meera}` },
  });
  const { projects } = (await projectsRes.json()) as {
    projects: { id: string; name: string }[];
  };
  projectId = projects.find((p) => p.name === "Q3 Launch")!.id;

  const tasksRes = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
    headers: { Authorization: `Bearer ${meera}` },
  });
  const { tasks } = (await tasksRes.json()) as { tasks: { id: string }[] };
  taskId = tasks[0].id;
});

describe("task access control", () => {
  // Test A
  it("a viewer cannot update a task", async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.dev}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "viewer update attempt" }),
    });
    expect(res.status).toBe(403);
  });

  // Test B
  it("a viewer cannot create a task", async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.dev}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "viewer create attempt" }),
    });
    expect(res.status).toBe(403);
  });

  // Test C
  it("a member can create a task", async () => {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.arjun}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "member create — baseline" }),
    });
    expect(res.status).toBe(201);
  });
});

// Additional coverage for findings in BUGS.md not exercised above.
// BUGS.md #4 (login form pre-fills live credentials) is a UI/component-level
// issue and isn't exercised by this API integration file.
describe("task access control - Additional Checks", () => {
  // Test D
  it("task search does not error on an unescaped quote in q", async () => {
    const res = await fetch(
      `${BASE_URL}/api/projects/${projectId}/tasks?q=${encodeURIComponent("x' OR '1'='1")}`,
      { headers: { Authorization: `Bearer ${tokens.meera}` } },
    );
    expect(res.status).not.toBe(500);
  });

  // Test E
  it("task search does not leak user emails or password hashes via a union payload", async () => {
    const payload =
      "nonexistent' UNION SELECT id, project_id, email, password_hash, 'x', null, null, 0, created_at, updated_at FROM users -- ";
    const res = await fetch(
      `${BASE_URL}/api/projects/${projectId}/tasks?q=${encodeURIComponent(payload)}`,
      { headers: { Authorization: `Bearer ${tokens.meera}` } },
    );
    const body = await res.text();
    expect(body).not.toMatch(/@taskboard\.dev|@example\.com/);
  });

  // Test F
  it("a non-member cannot update a task in a project they don't belong to", async () => {
    const linaToken = await login("lina@example.com"); // member of Onboarding only, not Q3 Launch
    const res = await fetch(`${BASE_URL}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${linaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "non-member update attempt" }),
    });
    expect(res.status).toBe(403);
  });
});
