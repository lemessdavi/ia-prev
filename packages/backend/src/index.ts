export { schema } from "./schema";
export { InMemoryBackendStore } from "./store";
export { createPrototypeAlignedFixtures } from "./fixtures";
export { listConversationsWithUnreadBadge, getContactDossierWithEvents } from "./queries";
export { sendMessage, markConversationAsRead } from "./mutations";
export { requireSession } from "./auth";
export { BackendError } from "./errors";
