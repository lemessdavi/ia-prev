"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBusinessErrorMessage = parseBusinessErrorMessage;
function parseBusinessErrorMessage(error) {
    if (!error || typeof error !== "object") {
        return "Unexpected error.";
    }
    const candidate = error;
    if (typeof candidate.data === "string") {
        try {
            const parsed = JSON.parse(candidate.data);
            if (parsed.message) {
                return parsed.message;
            }
        }
        catch {
            if (candidate.data.length > 0) {
                return candidate.data;
            }
        }
    }
    if (candidate.data && typeof candidate.data === "object") {
        const parsed = candidate.data;
        if (parsed.message) {
            return parsed.message;
        }
    }
    return candidate.message ?? "Unexpected error.";
}
