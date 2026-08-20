import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive } from "./redact";

test("redacts nested secrets without hiding ordinary ASC errors", () => {
  assert.deepEqual(redactSensitive({
    errors: [{ detail: "Invalid field", meta: { demoAccountPassword: "secret", accessToken: "token" } }],
    status: 422,
  }), {
    errors: [{ detail: "Invalid field", meta: { demoAccountPassword: "<redacted>", accessToken: "<redacted>" } }],
    status: 422,
  });
});
