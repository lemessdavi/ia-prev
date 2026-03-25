export const schema = {
  tenants: {
    indexes: ["by_slug"],
  },
  tenantWabaAccounts: {
    indexes: ["by_tenant", "by_phone_number_id"],
  },
  aiProfiles: {
    indexes: ["by_tenant", "by_tenant_active"],
  },
  users: {
    indexes: ["by_username", "by_tenant", "by_tenant_email"],
  },
  userAccounts: {
    indexes: ["by_user", "by_username", "by_role"],
  },
  sessions: {
    indexes: ["by_user", "by_tenant", "by_role"],
  },
  conversations: {
    indexes: ["by_tenant", "by_tenant_participant", "by_tenant_last_activity", "by_tenant_status"],
  },
  messages: {
    indexes: ["by_tenant_conversation", "by_tenant_conversation_created_at"],
  },
  attachments: {
    indexes: ["by_tenant_conversation"],
  },
  handoffEvents: {
    indexes: ["by_tenant_conversation_created_at"],
  },
  auditLogs: {
    indexes: ["by_tenant_created_at"],
  },
  dossiers: {
    indexes: ["by_tenant_contact"],
  },
  dossierEvents: {
    indexes: ["by_tenant_contact_occurred_at"],
  },
} as const;
