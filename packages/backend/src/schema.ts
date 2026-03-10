export const schema = {
  users: {
    indexes: ["by_tenant", "by_tenant_email"],
  },
  conversations: {
    indexes: ["by_tenant", "by_tenant_participant", "by_tenant_last_activity"],
  },
  messages: {
    indexes: ["by_tenant_conversation", "by_tenant_conversation_created_at"],
  },
  dossiers: {
    indexes: ["by_tenant_contact"],
  },
  dossierEvents: {
    indexes: ["by_tenant_contact_occurred_at"],
  },
} as const;
