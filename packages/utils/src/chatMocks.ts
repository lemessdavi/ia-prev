export type ConversationStatus = 'Apto' | 'Em triagem' | 'Revisão Humana'

export type Conversation = {
  id: string
  name: string
  preview: string
  time: string
  status: ConversationStatus
  selected?: boolean
}

export type Message = {
  id: string
  from: 'agent' | 'client'
  text?: string
  time: string
}

export const conversations: Conversation[] = [
  { id: '1', name: 'Carlos Mendes', preview: 'Enviei o laudo médico...', time: '10:42', status: 'Apto', selected: true },
  { id: '2', name: 'Mariana Souza', preview: 'Aguardando análise da...', time: '09:15', status: 'Revisão Humana' },
  { id: '3', name: '+55 11 99999-0000', preview: 'Qual o próximo passo?', time: 'Ontem', status: 'Em triagem' }
]

export const messages: Message[] = [
  {
    id: 'm1',
    from: 'agent',
    text: 'Olá, Carlos. Sou a assistente virtual da Lemes Advocacia. Para verificarmos sua elegibilidade ao Auxílio-Acidente, preciso fazer algumas perguntas. Você concorda com o tratamento dos seus dados conforme a LGPD?',
    time: '09:30'
  },
  { id: 'm2', from: 'client', text: 'Sim, concordo.', time: '09:31' },
  { id: 'm3', from: 'agent', text: 'Obrigada. Por favor, envie uma foto do laudo médico ou descreva o acidente.', time: '09:32' }
]

export const dossier = {
  name: 'Carlos Mendes',
  phone: '+55 11 99999-8888',
  city: 'São Paulo, SP',
  consent: 'Consentimento LGPD Aceito',
  consentAt: '10/10/2025 às 09:31',
  documents: ['Foto_Acidente.jpg', 'Laudo_Medico.pdf']
}
