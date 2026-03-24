import assert from "node:assert/strict";
import test from "node:test";
import { parseBusinessErrorMessage } from "../src/lib/business-error";

test("extracts message from serialized ConvexError data", () => {
  const message = parseBusinessErrorMessage({
    data: JSON.stringify({
      code: "FORBIDDEN",
      message: "You do not have permission to access this resource.",
    }),
  });

  assert.equal(message, "You do not have permission to access this resource.");
});

test("falls back to top-level message when no structured payload exists", () => {
  const message = parseBusinessErrorMessage({
    message: "Unexpected error.",
  });

  assert.equal(message, "Unexpected error.");
});
