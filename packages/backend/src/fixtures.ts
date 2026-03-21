import type { Database } from "./types";
import { hashPassword } from "./security";

export function createPrototypeAlignedFixtures(now = Date.now()): Database {
  const tenants = [
    {
      id: "tenant_legal",
      slug: "lemes-advocacia",
      name: "Lemes Advocacia",
      isActive: true,
      createdAt: now - 1_300_000,
    },
    {
      id: "tenant_clinic",
      slug: "clinica-sorriso",
      name: "Clinica Sorriso",
      isActive: true,
      createdAt: now - 1_250_000,
    },
  ];

  const tenantWabaAccounts = [
    {
      id: "waba_map_legal_1",
      tenantId: "tenant_legal",
      phoneNumberId: "waba_phone_legal_1",
      wabaAccountId: "waba_account_legal",
      displayName: "Lemes Advocacia WABA",
      createdAt: now - 1_100_000,
    },
    {
      id: "waba_map_clinic_1",
      tenantId: "tenant_clinic",
      phoneNumberId: "waba_phone_clinic_1",
      wabaAccountId: "waba_account_clinic",
      displayName: "Clinica Sorriso WABA",
      createdAt: now - 1_050_000,
    },
  ];

  const aiProfiles = [
    {
      id: "aip_legal_v1",
      tenantId: "tenant_legal",
      name: "previdencia-triagem-v1",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialsRef: "secret://tenant_legal/openai_primary",
      isActive: true,
      createdAt: now - 1_000_000,
    },
    {
      id: "aip_legal_old",
      tenantId: "tenant_legal",
      name: "previdencia-legacy",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialsRef: "secret://tenant_legal/openai_legacy",
      isActive: false,
      createdAt: now - 950_000,
    },
    {
      id: "aip_clinic_v1",
      tenantId: "tenant_clinic",
      name: "dentista-atendimento-v1",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialsRef: "secret://tenant_clinic/openai_primary",
      isActive: true,
      createdAt: now - 900_000,
    },
  ];

  const users = [
    {
      id: "usr_ana",
      tenantId: "tenant_legal",
      username: "ana.lima",
      fullName: "Ana Lima",
      email: "ana@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/ana.png",
      createdAt: now - 1000000,
    },
    {
      id: "usr_caio",
      tenantId: "tenant_legal",
      username: "caio.nunes",
      fullName: "Caio Nunes",
      email: "caio@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/caio.png",
      createdAt: now - 900000,
    },
    {
      id: "usr_marina",
      tenantId: "tenant_legal",
      username: "marina.rocha",
      fullName: "Marina Rocha",
      email: "marina@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/marina.png",
      createdAt: now - 800000,
    },
    {
      id: "usr_paulo",
      tenantId: "tenant_legal",
      username: "paulo.inativo",
      fullName: "Paulo Inativo",
      email: "paulo@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/paulo.png",
      createdAt: now - 780000,
    },
    {
      id: "usr_superadmin",
      tenantId: "tenant_legal",
      username: "ops.root",
      fullName: "Operações IA Prev",
      email: "ops@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/ops.png",
      createdAt: now - 760000,
    },
    {
      id: "usr_bruna",
      tenantId: "tenant_clinic",
      username: "bruna.alves",
      fullName: "Bruna Alves",
      email: "bruna@clinic.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/bruna.png",
      createdAt: now - 700000,
    },
    {
      id: "usr_joao",
      tenantId: "tenant_clinic",
      username: "joao.costa",
      fullName: "João Costa",
      email: "joao@clinic.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/joao.png",
      createdAt: now - 650000,
    },
  ];

  const userAccounts = [
    {
      userId: "usr_ana",
      username: "ana.lima",
      role: "tenant_user" as const,
      isActive: true,
      passwordHash: hashPassword("Ana@123456"),
      passwordUpdatedAt: now - 600000,
    },
    {
      userId: "usr_marina",
      username: "marina.rocha",
      role: "tenant_user" as const,
      isActive: true,
      passwordHash: hashPassword("Marina@123456"),
      passwordUpdatedAt: now - 550000,
    },
    {
      userId: "usr_paulo",
      username: "paulo.inativo",
      role: "tenant_user" as const,
      isActive: false,
      passwordHash: hashPassword("Paulo@123456"),
      passwordUpdatedAt: now - 500000,
    },
    {
      userId: "usr_superadmin",
      username: "ops.root",
      role: "superadmin" as const,
      isActive: true,
      passwordHash: hashPassword("Root@123456"),
      passwordUpdatedAt: now - 450000,
    },
    {
      userId: "usr_bruna",
      username: "bruna.alves",
      role: "tenant_user" as const,
      isActive: true,
      passwordHash: hashPassword("Bruna@123456"),
      passwordUpdatedAt: now - 420000,
    },
  ];

  const conversations = [
    {
      id: "conv_ana_caio",
      tenantId: "tenant_legal",
      participantIds: ["usr_ana", "usr_caio"],
      conversationStatus: "PENDENTE_HUMANO" as const,
      triageResult: "APTO" as const,
      title: "Caio Nunes",
      lastMessagePreview: "Te envio o dossiê atualizado hoje.",
      lastMessageAt: now - 60000,
      lastActivityAt: now - 60000,
      createdAt: now - 500000,
    },
    {
      id: "conv_ana_marina",
      tenantId: "tenant_legal",
      participantIds: ["usr_ana", "usr_marina"],
      conversationStatus: "EM_TRIAGEM" as const,
      triageResult: "N_A" as const,
      title: "Marina Rocha",
      lastMessagePreview: "Perfeito, obrigada!",
      lastMessageAt: now - 120000,
      lastActivityAt: now - 120000,
      createdAt: now - 450000,
    },
    {
      id: "conv_bruna_joao",
      tenantId: "tenant_clinic",
      participantIds: ["usr_bruna", "usr_joao"],
      conversationStatus: "EM_TRIAGEM" as const,
      triageResult: "N_A" as const,
      title: "João Costa",
      lastMessagePreview: "Preciso reagendar para sexta.",
      lastMessageAt: now - 30000,
      lastActivityAt: now - 30000,
      createdAt: now - 420000,
    },
  ];

  const attachments = [
    {
      id: "att_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      messageId: "msg_3",
      fileName: "laudo-medico.pdf",
      contentType: "application/pdf",
      url: "https://cdn.iaprev.com/files/laudo-medico.pdf",
      createdAt: now - 55_000,
    },
  ];

  const handoffEvents = [
    {
      id: "hand_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      from: "assistant" as const,
      to: "human" as const,
      performedByUserId: "usr_ana",
      createdAt: now - 50_000,
    },
  ];

  const auditLogs = [
    {
      id: "audit_1",
      tenantId: "tenant_legal",
      actorUserId: "usr_ana",
      action: "conversation.read",
      targetType: "conversation",
      targetId: "conv_ana_caio",
      createdAt: now - 40_000,
    },
  ];

  const messages = [
    {
      id: "msg_1",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      senderId: "usr_caio",
      body: "Oi Ana, conseguiu revisar o caso?",
      createdAt: now - 180000,
      readBy: ["usr_caio"],
    },
    {
      id: "msg_2",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      senderId: "usr_ana",
      body: "Sim, estou finalizando o dossiê.",
      createdAt: now - 120000,
      readBy: ["usr_ana", "usr_caio"],
    },
    {
      id: "msg_3",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_caio",
      senderId: "usr_caio",
      body: "Te envio o dossiê atualizado hoje.",
      createdAt: now - 60000,
      readBy: ["usr_caio"],
    },
    {
      id: "msg_4",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_marina",
      senderId: "usr_ana",
      body: "Confirmamos seu benefício para março.",
      createdAt: now - 180000,
      readBy: ["usr_ana", "usr_marina"],
    },
    {
      id: "msg_5",
      tenantId: "tenant_legal",
      conversationId: "conv_ana_marina",
      senderId: "usr_marina",
      body: "Perfeito, obrigada!",
      createdAt: now - 120000,
      readBy: ["usr_marina"],
    },
    {
      id: "msg_6",
      tenantId: "tenant_clinic",
      conversationId: "conv_bruna_joao",
      senderId: "usr_joao",
      body: "Preciso reagendar para sexta.",
      createdAt: now - 30000,
      readBy: ["usr_joao"],
    },
  ];

  const dossiers = [
    {
      id: "dos_caio",
      tenantId: "tenant_legal",
      contactId: "usr_caio",
      role: "Cliente",
      company: "Nunes & Filhos",
      location: "São Paulo, SP",
      summary: "Aguardando atualização de documentação previdenciária.",
      tags: ["Prioridade Alta", "Documentação"],
      updatedAt: now - 50000,
    },
    {
      id: "dos_joao",
      tenantId: "tenant_clinic",
      contactId: "usr_joao",
      role: "Paciente",
      company: "Clinica Sorriso",
      location: "Campinas, SP",
      summary: "Solicitou retorno sobre procedimento odontológico.",
      tags: ["Retorno", "Agenda"],
      updatedAt: now - 25000,
    },
  ];

  const dossierEvents = [
    {
      id: "evt_1",
      tenantId: "tenant_legal",
      contactId: "usr_caio",
      title: "Documentos recebidos",
      description: "Upload de comprovante de residência.",
      occurredAt: now - 200000,
      type: "interaction" as const,
    },
    {
      id: "evt_2",
      tenantId: "tenant_legal",
      contactId: "usr_caio",
      title: "Status atualizado",
      description: "Processo em revisão jurídica.",
      occurredAt: now - 90000,
      type: "status" as const,
    },
    {
      id: "evt_3",
      tenantId: "tenant_clinic",
      contactId: "usr_joao",
      title: "Pedido de reagendamento",
      description: "Cliente pediu agenda para sexta-feira.",
      occurredAt: now - 28000,
      type: "interaction" as const,
    },
  ];

  return {
    tenants,
    tenantWabaAccounts,
    aiProfiles,
    users,
    userAccounts,
    sessions: [],
    conversations,
    messages,
    attachments,
    handoffEvents,
    auditLogs,
    dossiers,
    dossierEvents,
  };
}
