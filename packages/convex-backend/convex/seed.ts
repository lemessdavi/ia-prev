import { v } from "convex/values";
import { internalMutation, internalQuery } from "./server";

const seedResultValidator = v.object({
  seeded: v.boolean(),
  tenantCount: v.number(),
  userCount: v.number(),
  conversationCount: v.number(),
});

const passwordHashesValidator = v.object({
  ana: v.string(),
  caio: v.string(),
  marina: v.string(),
  paulo: v.string(),
  superadmin: v.string(),
  bruna: v.string(),
  joao: v.string(),
});

async function countRows(ctx: any) {
  const [tenants, users, conversations] = await Promise.all([
    ctx.db.query("tenants").withIndex("by_slug").collect(),
    ctx.db.query("users").withIndex("by_tenant_id").collect(),
    ctx.db.query("conversations").withIndex("by_tenant_id_and_last_activity").collect(),
  ]);

  return {
    tenantCount: tenants.length,
    userCount: users.length,
    conversationCount: conversations.length,
  };
}

export const seedStatsInternal = internalQuery({
  args: {},
  returns: seedResultValidator,
  handler: async (ctx) => {
    const counts = await countRows(ctx);
    return {
      seeded: counts.tenantCount > 0,
      ...counts,
    };
  },
});

export const seedFixturesInternal = internalMutation({
  args: {
    passwordHashes: passwordHashesValidator,
  },
  returns: seedResultValidator,
  handler: async (ctx, args) => {
    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", "lemes-advocacia"))
      .unique();
    if (existingTenant) {
      const counts = await countRows(ctx);
      return {
        seeded: false,
        ...counts,
      };
    }

    const now = Date.now();

    const tenants = [
      {
        tenantId: "tenant_legal",
        slug: "lemes-advocacia",
        name: "Lemes Advocacia",
        isActive: true,
        createdAt: now - 1_300_000,
      },
      {
        tenantId: "tenant_clinic",
        slug: "clinica-sorriso",
        name: "Clinica Sorriso",
        isActive: true,
        createdAt: now - 1_250_000,
      },
    ] as const;

    const users = [
      {
        userId: "usr_ana",
        tenantId: "tenant_legal",
        username: "ana.lima",
        fullName: "Ana Lima",
        email: "ana@iaprev.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/ana.png",
        createdAt: now - 1_000_000,
      },
      {
        userId: "usr_caio",
        tenantId: "tenant_legal",
        username: "caio.nunes",
        fullName: "Caio Nunes",
        email: "caio@iaprev.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/caio.png",
        createdAt: now - 900_000,
      },
      {
        userId: "usr_marina",
        tenantId: "tenant_legal",
        username: "marina.rocha",
        fullName: "Marina Rocha",
        email: "marina@iaprev.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/marina.png",
        createdAt: now - 800_000,
      },
      {
        userId: "usr_paulo",
        tenantId: "tenant_legal",
        username: "paulo.inativo",
        fullName: "Paulo Inativo",
        email: "paulo@iaprev.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/paulo.png",
        createdAt: now - 780_000,
      },
      {
        userId: "usr_superadmin",
        tenantId: "tenant_legal",
        username: "ops.root",
        fullName: "Operações IA Prev",
        email: "ops@iaprev.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/ops.png",
        createdAt: now - 760_000,
      },
      {
        userId: "usr_bruna",
        tenantId: "tenant_clinic",
        username: "bruna.alves",
        fullName: "Bruna Alves",
        email: "bruna@clinic.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/bruna.png",
        createdAt: now - 700_000,
      },
      {
        userId: "usr_joao",
        tenantId: "tenant_clinic",
        username: "joao.costa",
        fullName: "João Costa",
        email: "joao@clinic.com",
        avatarUrl: "https://cdn.iaprev.com/avatar/joao.png",
        createdAt: now - 650_000,
      },
    ] as const;

    const userAccounts = [
      {
        userId: "usr_ana",
        username: "ana.lima",
        role: "tenant_user" as const,
        isActive: true,
        passwordHash: args.passwordHashes.ana,
        passwordUpdatedAt: now - 600_000,
      },
      {
        userId: "usr_caio",
        username: "caio.nunes",
        role: "tenant_user" as const,
        isActive: true,
        passwordHash: args.passwordHashes.caio,
        passwordUpdatedAt: now - 575_000,
      },
      {
        userId: "usr_marina",
        username: "marina.rocha",
        role: "tenant_user" as const,
        isActive: true,
        passwordHash: args.passwordHashes.marina,
        passwordUpdatedAt: now - 550_000,
      },
      {
        userId: "usr_paulo",
        username: "paulo.inativo",
        role: "tenant_user" as const,
        isActive: false,
        passwordHash: args.passwordHashes.paulo,
        passwordUpdatedAt: now - 500_000,
      },
      {
        userId: "usr_superadmin",
        username: "ops.root",
        role: "superadmin" as const,
        isActive: true,
        passwordHash: args.passwordHashes.superadmin,
        passwordUpdatedAt: now - 450_000,
      },
      {
        userId: "usr_bruna",
        username: "bruna.alves",
        role: "tenant_user" as const,
        isActive: true,
        passwordHash: args.passwordHashes.bruna,
        passwordUpdatedAt: now - 420_000,
      },
      {
        userId: "usr_joao",
        username: "joao.costa",
        role: "tenant_user" as const,
        isActive: true,
        passwordHash: args.passwordHashes.joao,
        passwordUpdatedAt: now - 390_000,
      },
    ] as const;

    const wabaMappings = [
      {
        tenantId: "tenant_legal",
        phoneNumberId: "waba_phone_legal_1",
        wabaAccountId: "waba_account_legal",
        displayName: "Lemes Advocacia WABA",
        isActive: true,
        createdAt: now - 1_100_000,
        updatedAt: now - 1_100_000,
      },
      {
        tenantId: "tenant_clinic",
        phoneNumberId: "waba_phone_clinic_1",
        wabaAccountId: "waba_account_clinic",
        displayName: "Clinica Sorriso WABA",
        isActive: true,
        createdAt: now - 1_050_000,
        updatedAt: now - 1_050_000,
      },
    ] as const;

    const aiProfiles = [
      {
        profileId: "aip_legal_v1",
        tenantId: "tenant_legal",
        name: "previdencia-triagem-v1",
        provider: "openai",
        model: "gpt-4.1-mini",
        credentialsRef: "secret://tenant_legal/openai_primary",
        isActive: true,
        createdAt: now - 1_000_000,
      },
      {
        profileId: "aip_legal_old",
        tenantId: "tenant_legal",
        name: "previdencia-legacy",
        provider: "openai",
        model: "gpt-4.1-mini",
        credentialsRef: "secret://tenant_legal/openai_legacy",
        isActive: false,
        createdAt: now - 950_000,
      },
      {
        profileId: "aip_clinic_v1",
        tenantId: "tenant_clinic",
        name: "dentista-atendimento-v1",
        provider: "openai",
        model: "gpt-4.1-mini",
        credentialsRef: "secret://tenant_clinic/openai_primary",
        isActive: true,
        createdAt: now - 900_000,
      },
    ] as const;

    const conversations = [
      {
        conversationId: "conv_ana_caio",
        tenantId: "tenant_legal",
        participantIds: ["usr_ana", "usr_caio"],
        conversationStatus: "PENDENTE_HUMANO" as const,
        triageResult: "APTO" as const,
        title: "Caio Nunes",
        lastMessagePreview: "Te envio os arquivos atualizados hoje.",
        lastMessageAt: now - 60_000,
        lastActivityAt: now - 60_000,
        createdAt: now - 500_000,
      },
      {
        conversationId: "conv_ana_marina",
        tenantId: "tenant_legal",
        participantIds: ["usr_ana", "usr_marina"],
        conversationStatus: "EM_TRIAGEM" as const,
        triageResult: "N_A" as const,
        title: "Marina Rocha",
        lastMessagePreview: "Perfeito, obrigada!",
        lastMessageAt: now - 120_000,
        lastActivityAt: now - 120_000,
        createdAt: now - 450_000,
      },
      {
        conversationId: "conv_bruna_joao",
        tenantId: "tenant_clinic",
        participantIds: ["usr_bruna", "usr_joao"],
        conversationStatus: "EM_TRIAGEM" as const,
        triageResult: "N_A" as const,
        title: "João Costa",
        lastMessagePreview: "Preciso reagendar para sexta.",
        lastMessageAt: now - 30_000,
        lastActivityAt: now - 30_000,
        createdAt: now - 420_000,
      },
    ] as const;

    const memberships = [
      { tenantId: "tenant_legal", conversationId: "conv_ana_caio", userId: "usr_ana" },
      { tenantId: "tenant_legal", conversationId: "conv_ana_caio", userId: "usr_caio" },
      { tenantId: "tenant_legal", conversationId: "conv_ana_marina", userId: "usr_ana" },
      { tenantId: "tenant_legal", conversationId: "conv_ana_marina", userId: "usr_marina" },
      { tenantId: "tenant_clinic", conversationId: "conv_bruna_joao", userId: "usr_bruna" },
      { tenantId: "tenant_clinic", conversationId: "conv_bruna_joao", userId: "usr_joao" },
    ] as const;

    const messages = [
      {
        messageId: "msg_1",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_caio",
        senderId: "usr_caio",
        body: "Oi Ana, conseguiu revisar o caso?",
        createdAt: now - 180_000,
        readBy: ["usr_caio"],
      },
      {
        messageId: "msg_2",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_caio",
        senderId: "usr_ana",
        body: "Sim, estou finalizando os arquivos.",
        createdAt: now - 120_000,
        readBy: ["usr_ana", "usr_caio"],
      },
      {
        messageId: "msg_3",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_caio",
        senderId: "usr_caio",
        body: "Te envio os arquivos atualizados hoje.",
        createdAt: now - 60_000,
        readBy: ["usr_caio"],
      },
      {
        messageId: "msg_4",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_marina",
        senderId: "usr_ana",
        body: "Confirmamos seu benefício para março.",
        createdAt: now - 180_000,
        readBy: ["usr_ana", "usr_marina"],
      },
      {
        messageId: "msg_5",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_marina",
        senderId: "usr_marina",
        body: "Perfeito, obrigada!",
        createdAt: now - 120_000,
        readBy: ["usr_marina"],
      },
      {
        messageId: "msg_6",
        tenantId: "tenant_clinic",
        conversationId: "conv_bruna_joao",
        senderId: "usr_joao",
        body: "Preciso reagendar para sexta.",
        createdAt: now - 30_000,
        readBy: ["usr_joao"],
      },
    ] as const;

    const attachments = [
      {
        attachmentId: "att_1",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_caio",
        messageId: "msg_3",
        fileName: "laudo-medico.pdf",
        contentType: "application/pdf",
        url: "https://cdn.iaprev.com/files/laudo-medico.pdf",
        createdAt: now - 55_000,
      },
    ] as const;

    const handoffEvents = [
      {
        handoffEventId: "hand_1",
        tenantId: "tenant_legal",
        conversationId: "conv_ana_caio",
        from: "assistant" as const,
        to: "human" as const,
        performedByUserId: "usr_ana",
        createdAt: now - 50_000,
      },
    ] as const;

    const auditLogs = [
      {
        auditLogId: "audit_1",
        tenantId: "tenant_legal",
        actorUserId: "usr_ana",
        action: "conversation.read",
        targetType: "conversation",
        targetId: "conv_ana_caio",
        createdAt: now - 40_000,
      },
    ] as const;

    const contactProfiles = [
      {
        contactProfileId: "cp_caio",
        tenantId: "tenant_legal",
        contactId: "usr_caio",
        role: "Cliente",
        company: "Nunes & Filhos",
        location: "São Paulo, SP",
        summary: "Aguardando atualização de documentação previdenciária.",
        tags: ["Prioridade Alta", "Documentação"],
        updatedAt: now - 50_000,
      },
      {
        contactProfileId: "cp_joao",
        tenantId: "tenant_clinic",
        contactId: "usr_joao",
        role: "Paciente",
        company: "Clinica Sorriso",
        location: "Campinas, SP",
        summary: "Solicitou retorno sobre procedimento odontológico.",
        tags: ["Retorno", "Agenda"],
        updatedAt: now - 25_000,
      },
    ] as const;

    const contactProfileEvents = [
      {
        eventId: "evt_1",
        tenantId: "tenant_legal",
        contactId: "usr_caio",
        title: "Documentos recebidos",
        description: "Upload de comprovante de residência.",
        occurredAt: now - 200_000,
        type: "interaction" as const,
      },
      {
        eventId: "evt_2",
        tenantId: "tenant_legal",
        contactId: "usr_caio",
        title: "Status atualizado",
        description: "Processo em revisão jurídica.",
        occurredAt: now - 90_000,
        type: "status" as const,
      },
    ] as const;

    await Promise.all(tenants.map((row) => ctx.db.insert("tenants", row)));
    await Promise.all(users.map((row) => ctx.db.insert("users", row)));
    await Promise.all(userAccounts.map((row) => ctx.db.insert("userAccounts", row)));
    await Promise.all(wabaMappings.map((row) => ctx.db.insert("wabaTenantMappings", row)));
    await Promise.all(aiProfiles.map((row) => ctx.db.insert("aiProfiles", row)));
    await Promise.all(conversations.map((row) => ctx.db.insert("conversations", row)));
    await Promise.all(memberships.map((row) => ctx.db.insert("conversationMemberships", row)));
    await Promise.all(messages.map((row) => ctx.db.insert("messages", row)));
    await Promise.all(attachments.map((row) => ctx.db.insert("attachments", row)));
    await Promise.all(handoffEvents.map((row) => ctx.db.insert("handoffEvents", row)));
    await Promise.all(auditLogs.map((row) => ctx.db.insert("auditLogs", row)));
    await Promise.all(contactProfiles.map((row) => ctx.db.insert("contactProfiles", row)));
    await Promise.all(contactProfileEvents.map((row) => ctx.db.insert("contactProfileEvents", row)));

    const counts = await countRows(ctx);
    return {
      seeded: true,
      ...counts,
    };
  },
});
