export type LegalSection = {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export const termsTitle = 'Termos de Uso — SplitMate'
export const privacyTitle = 'Política de Privacidade — SplitMate'

export const termsSections: LegalSection[] = [
  {
    title: '1. Aceitação dos Termos',
    paragraphs: [
      'Ao acessar ou utilizar o aplicativo SplitMate, você concorda com estes Termos de Uso. Caso não concorde com alguma das condições descritas, recomendamos que não utilize o aplicativo.',
    ],
  },
  {
    title: '2. Sobre o SplitMate',
    paragraphs: [
      'O SplitMate é uma ferramenta criada para ajudar grupos de pessoas a registrar despesas compartilhadas e acompanhar quem deve ou tem valores a receber dentro de um grupo.',
      'O aplicativo tem finalidade organizacional e informativa, facilitando o controle de despesas entre usuários.',
    ],
  },
  {
    title: '3. Responsabilidade dos Usuários',
    paragraphs: [
      'Os registros de despesas, pagamentos e confirmações são feitos pelos próprios usuários.',
      'Cada participante do grupo é responsável por garantir que as informações registradas estejam corretas.',
      'O SplitMate não intermedia pagamentos e não realiza transferências financeiras entre usuários.',
    ],
  },
  {
    title: '4. Confirmação de Pagamentos',
    paragraphs: [
      'A marcação de pagamentos como "quitados" depende da confirmação dos próprios participantes do grupo.',
      'O aplicativo funciona apenas como ferramenta de registro e organização.',
    ],
  },
  {
    title: '5. Uso Adequado do Serviço',
    paragraphs: [
      'Ao utilizar o SplitMate, o usuário concorda em:',
      'O descumprimento dessas regras pode resultar na suspensão ou limitação de acesso ao serviço.',
    ],
    bullets: [
      'Não utilizar o aplicativo para atividades ilegais',
      'Não tentar acessar contas de outros usuários',
      'Não manipular informações com intenção de fraude',
      'Não prejudicar o funcionamento do aplicativo',
    ],
  },
  {
    title: '6. Limitação de Responsabilidade',
    paragraphs: [
      'O SplitMate não se responsabiliza por disputas financeiras entre usuários.',
      'O aplicativo fornece apenas uma ferramenta para registro e visualização de informações inseridas pelos próprios participantes.',
    ],
  },
  {
    title: '7. Atualizações do Serviço',
    paragraphs: [
      'O aplicativo pode ser atualizado, modificado ou melhorado a qualquer momento para aprimorar sua segurança, desempenho e funcionalidades.',
    ],
  },
  {
    title: '8. Contato',
    paragraphs: [
      'Caso tenha dúvidas sobre estes Termos de Uso, o usuário poderá entrar em contato pelos canais oficiais do aplicativo.',
    ],
  },
]

export const privacySections: LegalSection[] = [
  {
    title: '1. Introdução',
    paragraphs: [
      'Esta Política de Privacidade explica como o SplitMate coleta, utiliza e protege as informações dos usuários ao utilizar o aplicativo.',
      'Nosso objetivo é garantir transparência sobre como os dados são utilizados dentro da plataforma.',
    ],
  },
  {
    title: '2. Informações Coletadas',
    paragraphs: [
      'Para funcionamento do aplicativo, podem ser coletadas algumas informações básicas, como:',
      'Essas informações são utilizadas exclusivamente para o funcionamento do aplicativo.',
    ],
    bullets: [
      'identificação do usuário',
      'e-mail ou dados de login',
      'grupos criados pelo usuário',
      'registros de despesas',
      'histórico de pagamentos',
      'participantes dos grupos',
    ],
  },
  {
    title: '3. Uso das Informações',
    paragraphs: [
      'Os dados coletados são utilizados para:',
    ],
    bullets: [
      'permitir login e identificação do usuário',
      'criar e gerenciar grupos',
      'registrar despesas e pagamentos',
      'exibir saldos entre participantes',
      'manter o funcionamento correto do aplicativo',
    ],
  },
  {
    title: '4. Compartilhamento de Dados',
    paragraphs: [
      'O SplitMate não vende nem comercializa dados pessoais dos usuários.',
      'As informações registradas em um grupo são visíveis apenas para os participantes daquele grupo.',
    ],
  },
  {
    title: '5. Armazenamento e Segurança',
    paragraphs: [
      'Os dados são armazenados em serviços seguros e protegidos por mecanismos de autenticação e criptografia.',
      'Adotamos medidas técnicas para proteger as informações contra acesso não autorizado.',
    ],
  },
  {
    title: '6. Direitos do Usuário',
    paragraphs: [
      'O usuário pode:',
      'Caso a conta seja excluída, os dados associados ao usuário poderão ser removidos do sistema.',
    ],
    bullets: [
      'atualizar suas informações',
      'solicitar a exclusão da conta',
      'remover grupos ou registros criados',
    ],
  },
  {
    title: '7. Retenção de Dados',
    paragraphs: [
      'As informações são mantidas apenas enquanto a conta do usuário estiver ativa ou enquanto forem necessárias para o funcionamento do aplicativo.',
    ],
  },
  {
    title: '8. Alterações nesta Política',
    paragraphs: [
      'Esta política pode ser atualizada periodicamente para refletir melhorias no aplicativo ou mudanças legais.',
      'Sempre que ocorrerem alterações relevantes, os usuários poderão ser informados dentro do próprio aplicativo.',
    ],
  },
  {
    title: '9. Contato',
    paragraphs: [
      'Caso tenha dúvidas sobre esta Política de Privacidade, o usuário poderá entrar em contato através dos canais de suporte do aplicativo.',
    ],
  },
]
