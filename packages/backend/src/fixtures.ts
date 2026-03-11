import type { Database } from "./types";

export function createPrototypeAlignedFixtures(now = Date.now()): Database {
  const users = [
    {
      id: "usr_ana",
      tenantId: "tenant_legal",
      fullName: "Ana Lima",
      email: "ana@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/ana.png",
      createdAt: now - 1000000,
    },
    {
      id: "usr_caio",
      tenantId: "tenant_legal",
      fullName: "Caio Nunes",
      email: "caio@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/caio.png",
      createdAt: now - 900000,
    },
    {
      id: "usr_marina",
      tenantId: "tenant_legal",
      fullName: "Marina Rocha",
      email: "marina@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/marina.png",
      createdAt: now - 800000,
    },
    {
      id: "usr_bruna",
      tenantId: "tenant_clinic",
      fullName: "Bruna Alves",
      email: "bruna@clinic.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/bruna.png",
      createdAt: now - 700000,
    },
    {
      id: "usr_joao",
      tenantId: "tenant_clinic",
      fullName: "João Costa",
      email: "joao@clinic.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/joao.png",
      createdAt: now - 650000,
    },
  ];

  const conversations = [
    {
      id: "conv_ana_caio",
      tenantId: "tenant_legal",
      participantIds: ["usr_ana", "usr_caio"],
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
      title: "João Costa",
      lastMessagePreview: "Preciso reagendar para sexta.",
      lastMessageAt: now - 30000,
      lastActivityAt: now - 30000,
      createdAt: now - 420000,
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

  return { users, conversations, messages, dossiers, dossierEvents };
}
