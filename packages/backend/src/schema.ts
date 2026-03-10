export const schema = {
  users: {
    indexes: ["by_email"],
  },
  conversations: {
    indexes: ["by_participant", "by_last_activity"],
  },
  messages: {
    indexes: ["by_conversation", "by_conversation_created_at"],
  },
  dossiers: {
    indexes: ["by_contact"],
  },
  dossierEvents: {
    indexes: ["by_contact_occurred_at"],
  },
} as const;
