import { assertTenantAccess, requirePersistedSession, requireSuperadmin } from "./auth";
import { BackendError, logInfo } from "./errors";
import { InMemoryBackendStore } from "./store";
import type { AIProfile, ConversationListItem, Session, Tenant, TenantWabaAccount, UserAccountSummary } from "./types";
import { assertId } from "./validators";

export function listConversationsWithUnreadBadge(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
}): ConversationListItem[] {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversations = input.store.listConversationsByUser(session.userId, session.tenantId);

  const result = conversations.map((conversation) => {
    const unreadCount = input.store
      .listMessages(conversation.id, session.tenantId)
      .filter((message) => message.senderId !== session.userId && !message.readBy.includes(session.userId)).length;

    return {
      conversationId: conversation.id,
      title: conversation.title,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      lastActivityAt: conversation.lastActivityAt,
      unreadCount,
    };
  });

  logInfo("Conversations listed.", { tenantId: session.tenantId, userId: session.userId, count: result.length });
  return result;
}

export function getContactDossierWithEvents(input: {
  session?: Session | null;
  contactId: string;
  store: InMemoryBackendStore;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const contactId = assertId(input.contactId, "contactId");
  if (!input.store.findUser(session.userId, session.tenantId)) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      tenantId: session.tenantId,
      contactId,
    });
  }

  const dossier = input.store.findDossier(contactId, session.tenantId);
  if (!dossier) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const canAccess =
    session.userId === contactId ||
    input.store.hasConversationWithContact(session.userId, contactId, session.tenantId);
  if (!canAccess) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const events = input.store.listDossierEvents(contactId, session.tenantId).slice(0, 5);
  logInfo("Dossier fetched.", { tenantId: session.tenantId, userId: session.userId, contactId, events: events.length });

  return {
    contactId,
    dossier,
    recentEvents: events,
  };
}

export function listUsers(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId?: string;
}): UserAccountSummary[] {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const requestedTenantId = input.tenantId ? assertId(input.tenantId, "tenantId") : undefined;
  const scopedTenantId =
    session.role === "superadmin"
      ? requestedTenantId
      : assertTenantAccess(session, requestedTenantId ?? session.tenantId);

  const users = input.store
    .listUserAccounts(scopedTenantId)
    .map((account) => {
      const user = input.store.findUserById(account.userId);
      if (!user) {
        throw new BackendError("User account is linked to an unknown user.", "NOT_FOUND", {
          userId: account.userId,
        });
      }

      return {
        userId: user.id,
        tenantId: user.tenantId,
        username: account.username,
        fullName: user.fullName,
        email: user.email,
        role: account.role,
        isActive: account.isActive,
      };
    })
    .sort((a, b) => {
      const tenantCompare = a.tenantId.localeCompare(b.tenantId);
      return tenantCompare !== 0 ? tenantCompare : a.username.localeCompare(b.username);
    });

  logInfo("Users listed.", {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    requestedTenantId: requestedTenantId ?? "all",
    count: users.length,
  });

  return users;
}

export function resolveTenantByPhoneNumberId(input: {
  phoneNumberId: string;
  store: InMemoryBackendStore;
}) {
  const phoneNumberId = assertId(input.phoneNumberId, "phoneNumberId");
  const mapping = input.store.findTenantWabaByPhoneNumberId(phoneNumberId);
  if (!mapping) {
    throw new BackendError("WABA mapping not found for phone_number_id.", "NOT_FOUND", { phoneNumberId });
  }

  logInfo("Tenant resolved from phone_number_id.", {
    phoneNumberId,
    tenantId: mapping.tenantId,
    wabaAccountId: mapping.wabaAccountId,
  });

  return {
    tenantId: mapping.tenantId,
    wabaAccountId: mapping.wabaAccountId,
    displayName: mapping.displayName,
  };
}

export function listTenants(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
}): Tenant[] {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenants = input.store.listTenants();
  logInfo("Tenants listed.", {
    userId: session.userId,
    tenantId: session.tenantId,
    count: tenants.length,
  });
  return tenants;
}

export function listTenantWabaAccounts(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId?: string;
}): TenantWabaAccount[] {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = input.tenantId ? assertId(input.tenantId, "tenantId") : undefined;
  const mappings = input.store.listTenantWabaAccounts(tenantId);
  logInfo("Tenant WABA accounts listed.", {
    userId: session.userId,
    tenantId: session.tenantId,
    requestedTenantId: tenantId ?? "all",
    count: mappings.length,
  });
  return mappings;
}

export function listAiProfiles(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId: string;
}): AIProfile[] {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = assertId(input.tenantId, "tenantId");
  const profiles = input.store.listAiProfiles(tenantId);
  logInfo("AI profiles listed.", {
    userId: session.userId,
    tenantId: session.tenantId,
    requestedTenantId: tenantId,
    count: profiles.length,
  });
  return profiles;
}
