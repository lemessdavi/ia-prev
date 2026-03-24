import { randomUUID } from "node:crypto";
import { requirePersistedSession, requireSuperadmin } from "./auth";
import { BackendError, logInfo } from "./errors";
import { hashPassword } from "./security";
import { InMemoryBackendStore } from "./store";
import type { Session, UserRole } from "./types";
import {
  assertAttachmentUrl,
  assertEmail,
  assertId,
  assertMessageBody,
  assertPassword,
  assertSlug,
  assertTenantName,
  assertUsername,
} from "./validators";

export function sendMessage(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  body: string;
  attachmentUrl?: string;
  now?: number;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const body = assertMessageBody(input.body);
  const attachmentUrl = assertAttachmentUrl(input.attachmentUrl);
  const now = input.now ?? Date.now();

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }

  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("You cannot send messages to this conversation.", "FORBIDDEN", {
      conversationId,
      userId: session.userId,
      tenantId: session.tenantId,
    });
  }

  const message = {
    id: `msg_${conversationId}_${now}`,
    tenantId: session.tenantId,
    conversationId,
    senderId: session.userId,
    body,
    attachmentUrl,
    createdAt: now,
    readBy: [session.userId],
  };

  input.store.insertMessage(message);
  input.store.updateConversation(conversationId, session.tenantId, {
    lastMessagePreview: body,
    lastMessageAt: now,
    lastActivityAt: now,
  });

  logInfo("Message sent.", {
    tenantId: session.tenantId,
    conversationId,
    userId: session.userId,
    hasAttachment: Boolean(attachmentUrl),
  });
  return message;
}

export function markConversationAsRead(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }
  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("You cannot update this conversation.", "FORBIDDEN", {
      conversationId,
      userId: session.userId,
      tenantId: session.tenantId,
    });
  }

  const updatedCount = input.store.markConversationRead(conversationId, session.tenantId, session.userId);
  logInfo("Conversation read state updated.", {
    tenantId: session.tenantId,
    conversationId,
    userId: session.userId,
    updatedCount,
  });
  return { conversationId, updatedCount };
}

export function resetUserPassword(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  userId: string;
  nextPassword: string;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const userId = assertId(input.userId, "userId");
  const nextPassword = assertPassword(input.nextPassword, "nextPassword");
  const user = input.store.findUserById(userId);
  const account = input.store.findUserAccountByUserId(userId);

  if (!user || !account) {
    throw new BackendError("User not found.", "NOT_FOUND", { userId });
  }

  input.store.upsertUserAccount({
    ...account,
    passwordHash: hashPassword(nextPassword),
    passwordUpdatedAt: input.now ?? Date.now(),
  });

  const revokedSessionCount = input.store.revokeSessionsByUserId(userId);
  logInfo("Password reset by superadmin.", {
    actorUserId: session.userId,
    actorTenantId: session.tenantId,
    targetUserId: userId,
    targetTenantId: user.tenantId,
    revokedSessionCount,
  });

  return {
    userId: user.id,
    tenantId: user.tenantId,
    revokedSessionCount,
  };
}

export function createTenant(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  id?: string;
  slug: string;
  name: string;
  isActive?: boolean;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = input.id ? assertId(input.id, "id") : `tenant_${randomUUID()}`;
  const slug = assertSlug(input.slug, "slug");
  const name = assertTenantName(input.name, "name");

  if (input.store.findTenantById(tenantId)) {
    throw new BackendError("Tenant id already exists.", "BAD_REQUEST", { tenantId });
  }

  if (input.store.findTenantBySlug(slug)) {
    throw new BackendError("Tenant slug already exists.", "BAD_REQUEST", { slug });
  }

  const tenant = {
    id: tenantId,
    slug,
    name,
    isActive: input.isActive ?? true,
    createdAt: input.now ?? Date.now(),
  };

  input.store.insertTenant(tenant);

  logInfo("Tenant created.", {
    actorUserId: session.userId,
    tenantId: tenant.id,
  });

  return tenant;
}

export function updateTenant(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId: string;
  name?: string;
  slug?: string;
  isActive?: boolean;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = assertId(input.tenantId, "tenantId");
  const existing = input.store.findTenantById(tenantId);
  if (!existing) {
    throw new BackendError("Tenant not found.", "NOT_FOUND", { tenantId });
  }

  const name = input.name !== undefined ? assertTenantName(input.name, "name") : existing.name;
  const slug = input.slug !== undefined ? assertSlug(input.slug, "slug") : existing.slug;
  const isActive = input.isActive ?? existing.isActive;

  const tenantWithSlug = input.store.findTenantBySlug(slug);
  if (tenantWithSlug && tenantWithSlug.id !== tenantId) {
    throw new BackendError("Tenant slug already exists.", "BAD_REQUEST", { slug });
  }

  const updated = input.store.updateTenant(tenantId, {
    name,
    slug,
    isActive,
  });

  if (!updated) {
    throw new BackendError("Tenant not found.", "NOT_FOUND", { tenantId });
  }

  logInfo("Tenant updated.", {
    actorUserId: session.userId,
    tenantId,
    isActive,
  });

  return updated;
}

export function upsertTenantWabaAccount(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId: string;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = assertId(input.tenantId, "tenantId");
  const phoneNumberId = assertId(input.phoneNumberId, "phoneNumberId");
  const wabaAccountId = assertId(input.wabaAccountId, "wabaAccountId");
  const displayName = assertTenantName(input.displayName, "displayName");

  if (!input.store.findTenantById(tenantId)) {
    throw new BackendError("Tenant not found.", "NOT_FOUND", { tenantId });
  }

  const phoneNumberOwner = input.store.findTenantWabaByPhoneNumberId(phoneNumberId);
  if (phoneNumberOwner && phoneNumberOwner.tenantId !== tenantId) {
    throw new BackendError("phone_number_id already mapped to another tenant.", "BAD_REQUEST", {
      phoneNumberId,
      tenantId: phoneNumberOwner.tenantId,
    });
  }

  const existing = input.store.findTenantWabaByTenantId(tenantId);
  const mapping = {
    id: existing?.id ?? `waba_map_${tenantId}_${randomUUID()}`,
    tenantId,
    phoneNumberId,
    wabaAccountId,
    displayName,
    createdAt: existing?.createdAt ?? input.now ?? Date.now(),
  };

  input.store.upsertTenantWabaAccount(mapping);

  logInfo("Tenant WABA mapping upserted.", {
    actorUserId: session.userId,
    tenantId,
    phoneNumberId,
  });

  return mapping;
}

export function createTenantUser(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  userId?: string;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = assertId(input.tenantId, "tenantId");
  const userId = input.userId ? assertId(input.userId, "userId") : `usr_${randomUUID()}`;
  const username = assertUsername(input.username);
  const fullName = assertTenantName(input.fullName, "fullName");
  const email = assertEmail(input.email);
  const password = assertPassword(input.password);
  const role = input.role ?? "tenant_user";
  const now = input.now ?? Date.now();

  if (!input.store.findTenantById(tenantId)) {
    throw new BackendError("Tenant not found.", "NOT_FOUND", { tenantId });
  }

  if (input.store.findUserById(userId)) {
    throw new BackendError("User id already exists.", "BAD_REQUEST", { userId });
  }

  if (input.store.findUserAccountByUsername(username)) {
    throw new BackendError("Username already exists.", "BAD_REQUEST", { username });
  }

  const emailInTenant = input.store
    .snapshot()
    .users.find((user) => user.tenantId === tenantId && user.email.toLowerCase() === email);
  if (emailInTenant) {
    throw new BackendError("Email already exists for this tenant.", "BAD_REQUEST", { email, tenantId });
  }

  const user = {
    id: userId,
    tenantId,
    username,
    fullName,
    email,
    avatarUrl: "https://cdn.iaprev.com/avatar/default.png",
    createdAt: now,
  };

  input.store.insertUser(user);
  input.store.upsertUserAccount({
    userId,
    username,
    role,
    isActive: input.isActive ?? true,
    passwordHash: hashPassword(password),
    passwordUpdatedAt: now,
  });

  logInfo("Tenant user created.", {
    actorUserId: session.userId,
    tenantId,
    userId,
    role,
  });

  return {
    userId,
    tenantId,
    username,
    fullName,
    email,
    role,
    isActive: input.isActive ?? true,
  };
}

export function setUserActive(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  userId: string;
  isActive: boolean;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const userId = assertId(input.userId, "userId");
  const user = input.store.findUserById(userId);
  const account = input.store.findUserAccountByUserId(userId);
  if (!user || !account) {
    throw new BackendError("User not found.", "NOT_FOUND", { userId });
  }

  input.store.upsertUserAccount({
    ...account,
    isActive: input.isActive,
  });

  if (!input.isActive) {
    input.store.revokeSessionsByUserId(userId);
  }

  logInfo("User active status updated.", {
    actorUserId: session.userId,
    userId,
    isActive: input.isActive,
  });

  return {
    userId,
    tenantId: user.tenantId,
    isActive: input.isActive,
  };
}

export function createAiProfile(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  id?: string;
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  credentialsRef: string;
  isActive?: boolean;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const id = input.id ? assertId(input.id, "id") : `aip_${randomUUID()}`;
  const tenantId = assertId(input.tenantId, "tenantId");
  const name = assertTenantName(input.name, "name");
  const provider = assertId(input.provider, "provider");
  const model = assertId(input.model, "model");
  const credentialsRef = assertId(input.credentialsRef, "credentialsRef");

  if (!input.store.findTenantById(tenantId)) {
    throw new BackendError("Tenant not found.", "NOT_FOUND", { tenantId });
  }

  if (input.store.findAiProfile(id)) {
    throw new BackendError("AI profile id already exists.", "BAD_REQUEST", { id });
  }

  const profile = {
    id,
    tenantId,
    name,
    provider,
    model,
    credentialsRef,
    isActive: false,
    createdAt: input.now ?? Date.now(),
  };

  input.store.upsertAiProfile(profile);

  if (input.isActive) {
    const activated = input.store.setAiProfileActive(tenantId, id);
    if (!activated) {
      throw new BackendError("AI profile not found.", "NOT_FOUND", { id, tenantId });
    }
    logInfo("AI profile created and activated.", {
      actorUserId: session.userId,
      tenantId,
      profileId: id,
    });
    return activated;
  }

  const hasActiveProfile = input.store.listAiProfiles(tenantId).some((candidate) => candidate.isActive);
  if (!hasActiveProfile) {
    const activated = input.store.setAiProfileActive(tenantId, id);
    if (!activated) {
      throw new BackendError("AI profile not found.", "NOT_FOUND", { id, tenantId });
    }
    return activated;
  }

  logInfo("AI profile created.", {
    actorUserId: session.userId,
    tenantId,
    profileId: id,
  });

  return profile;
}

export function setActiveAiProfile(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId: string;
  profileId: string;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const tenantId = assertId(input.tenantId, "tenantId");
  const profileId = assertId(input.profileId, "profileId");
  const profile = input.store.findAiProfile(profileId);

  if (!profile || profile.tenantId !== tenantId) {
    throw new BackendError("AI profile not found for this tenant.", "NOT_FOUND", {
      tenantId,
      profileId,
    });
  }

  const activated = input.store.setAiProfileActive(tenantId, profileId);
  if (!activated) {
    throw new BackendError("AI profile not found for this tenant.", "NOT_FOUND", {
      tenantId,
      profileId,
    });
  }

  logInfo("AI profile activated.", {
    actorUserId: session.userId,
    tenantId,
    profileId,
  });

  return activated;
}
