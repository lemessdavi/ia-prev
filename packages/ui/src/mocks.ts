export type ConversationStatus = 'Apto' | 'Em triagem' | 'Revisão Humana';

export interface Conversation {
  id: string;
  name: string;
  preview: string;
  time: string;
  status: ConversationStatus;
}

export interface ChatMessage {
  id: string;
  text: string;
  time: string;
  from: 'assistant' | 'client';
}

export const conversationMocks: Conversation[] = [
  { id: '1', name: 'Carlos Mendes', preview: 'Enviei o laudo médico...', time: '10:42', status: 'Apto' },
  { id: '2', name: 'Mariana Souza', preview: 'Aguardando análise da...', time: '09:15', status: 'Revisão Humana' },
  { id: '3', name: '+55 11 99999-0000', preview: 'Qual o próximo passo?', time: 'Ontem', status: 'Em triagem' },
];

export const messageMocks: ChatMessage[] = [
  {
    id: 'm1',
    from: 'assistant',
    time: '09:30',
    text: 'Olá, Carlos. Sou a assistente virtual da Lemes Advocacia. Você concorda com o tratamento dos seus dados conforme a LGPD?',
  },
  { id: 'm2', from: 'client', time: '09:31', text: 'Sim, concordo.' },
  {
    id: 'm3',
    from: 'assistant',
    time: '09:32',
    text: 'Obrigada. Por favor, envie uma foto do laudo médico ou descreva o acidente.',
  },
];
