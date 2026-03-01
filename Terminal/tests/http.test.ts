import request from "supertest";
import { app } from "../src/index";

describe("Terminal HTTP endpoint hardening", () => {
  test("rejects missing command", async () => {
    const response = await request(app)
      .post("/tools/run_terminal_command")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe("INVALID_INPUT");
  });

  test("blocks denied command pattern", async () => {
    const response = await request(app)
      .post("/tools/run_terminal_command")
      .send({ command: "rm -rf /tmp/test" });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe("POLICY_BLOCKED");
  });

  test("blocks cwd escaping workspace root", async () => {
    const response = await request(app)
      .post("/tools/run_terminal_command")
      .send({ command: "echo hello", cwd: "../.." });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe("POLICY_BLOCKED");
  });

  test("executes safe command", async () => {
    const response = await request(app)
      .post("/tools/run_terminal_command")
      .send({ command: "echo hello" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.stdout).toBe("string");
    expect(response.body.stdout.toLowerCase()).toContain("hello");
  });
});
