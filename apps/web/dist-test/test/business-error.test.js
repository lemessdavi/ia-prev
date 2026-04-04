"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const business_error_1 = require("../src/lib/business-error");
(0, node_test_1.default)("extracts message from serialized ConvexError data", () => {
    const message = (0, business_error_1.parseBusinessErrorMessage)({
        data: JSON.stringify({
            code: "FORBIDDEN",
            message: "You do not have permission to access this resource.",
        }),
    });
    strict_1.default.equal(message, "You do not have permission to access this resource.");
});
(0, node_test_1.default)("falls back to top-level message when no structured payload exists", () => {
    const message = (0, business_error_1.parseBusinessErrorMessage)({
        message: "Unexpected error.",
    });
    strict_1.default.equal(message, "Unexpected error.");
});
