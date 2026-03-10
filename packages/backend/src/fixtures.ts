import type { Database } from "./types";

export function createPrototypeAlignedFixtures(now = Date.now()): Database {
  const users = [
    {
      id: "usr_ana",
      fullName: "Ana Lima",
      email: "ana@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/ana.png",
      createdAt: now - 1000000,
    },
    {
      id: "usr_caio",
      fullName: "Caio Nunes",
      email: "caio@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/caio.png",
      createdAt: now - 900000,
    },
    {
      id: "usr_marina",
      fullName: "Marina Rocha",
      email: "marina@iaprev.com",
      avatarUrl: "https://cdn.iaprev.com/avatar/marina.png",
      createdAt: now - 800000,
    },
  ];

  const conversations = [
    {
      id: "conv_ana_caio",
      participantIds: ["usr_ana", "usr_caio"],
      title: "Caio Nunes",
      lastMessagePreview: "Te envio o dossiê atualizado hoje.",
      lastMessageAt: now - 60000,
      lastActivityAt: now - 60000,
      createdAt: now - 500000,
    },
    {
      id: "conv_ana_marina",
      participantIds: ["usr_ana", "usr_marina"],
      title: "Marina Rocha",
      lastMessagePreview: "Perfeito, obrigada!",
      lastMessageAt: now - 120000,
      lastActivityAt: now - 120000,
      createdAt: now - 450000,
    },
  ];

  const messages = [
    {
      id: "msg_1",
      conversationId: "conv_ana_caio",
      senderId: "usr_caio",
      body: "Oi Ana, conseguiu revisar o caso?",
      createdAt: now - 180000,
      readBy: ["usr_caio"],
    },
    {
      id: "msg_2",
      conversationId: "conv_ana_caio",
      senderId: "usr_ana",
      body: "Sim, estou finalizando o dossiê.",
      createdAt: now - 120000,
      readBy: ["usr_ana", "usr_caio"],
    },
    {
      id: "msg_3",
      conversationId: "conv_ana_caio",
      senderId: "usr_caio",
      body: "Te envio o dossiê atualizado hoje.",
      createdAt: now - 60000,
      readBy: ["usr_caio"],
    },
    {
      id: "msg_4",
      conversationId: "conv_ana_marina",
      senderId: "usr_ana",
      body: "Confirmamos seu benefício para março.",
      createdAt: now - 180000,
      readBy: ["usr_ana", "usr_marina"],
    },
    {
      id: "msg_5",
      conversationId: "conv_ana_marina",
      senderId: "usr_marina",
      body: "Perfeito, obrigada!",
      createdAt: now - 120000,
      readBy: ["usr_marina"],
    },
  ];

  const dossiers = [
    {
      id: "dos_caio",
      contactId: "usr_caio",
      role: "Cliente",
      company: "Nunes & Filhos",
      location: "São Paulo, SP",
      summary: "Aguardando atualização de documentação previdenciária.",
      tags: ["Prioridade Alta", "Documentação"],
      updatedAt: now - 50000,
    },
  ];

  const dossierEvents = [
    {
      id: "evt_1",
      contactId: "usr_caio",
      title: "Documentos recebidos",
      description: "Upload de comprovante de residência.",
      occurredAt: now - 200000,
      type: "interaction" as const,
    },
    {
      id: "evt_2",
      contactId: "usr_caio",
      title: "Status atualizado",
      description: "Processo em revisão jurídica.",
      occurredAt: now - 90000,
      type: "status" as const,
    },
  ];

  return { users, conversations, messages, dossiers, dossierEvents };
}
