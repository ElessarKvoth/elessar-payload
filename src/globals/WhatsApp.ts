import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * Número de WhatsApp — antes vinha da variável de ambiente
 * NEXT_PUBLIC_WHATSAPP_NUMBER, o que significava que trocar de telefone exigia
 * um desenvolvedor mexendo na configuração do servidor e refazendo o deploy.
 * Agora é campo de painel: quem atende muda quando precisar.
 *
 * O formato que o link do WhatsApp exige (DDI + DDD + número, só dígitos) é
 * exatamente o tipo de detalhe que ninguém acerta de primeira — daí a validação
 * abaixo explicar o erro em vez de só recusar.
 */
function validarNumeroWhatsApp(valor: string | null | undefined): string | true {
  const digitos = (valor ?? '').replace(/\D/g, '')

  if (digitos.length === 0) {
    return 'Informe o número do WhatsApp. Sem ele o botão não tem para onde levar.'
  }
  if (!digitos.startsWith('55')) {
    return `O número precisa começar com 55, que é o código do Brasil. Você digitou "${valor}". Para o telefone (19) 99123-4567, escreva 5519991234567.`
  }
  // 55 + DDD (2) + número (8 fixo ou 9 celular) = 12 ou 13 dígitos.
  if (digitos.length < 12 || digitos.length > 13) {
    return `O número ficou com ${digitos.length} dígitos, e o certo são 12 ou 13: 55, mais o DDD, mais o telefone. Exemplo: 5519991234567.`
  }
  return true
}

export const WhatsApp: GlobalConfig = {
  slug: 'whatsapp',
  label: 'Botão de WhatsApp',
  admin: {
    group: 'Conteúdo do site',
    description:
      'O botão verde de WhatsApp que fica flutuando no canto da tela, em todas as páginas da loja. Aqui você define para qual telefone ele leva e o que já vem escrito na conversa quando o cliente clica.',
    hideAPIURL: true,
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'ativo',
      label: 'Mostrar o botão no site',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Desmarque para esconder o botão temporariamente — em férias, por exemplo, ou quando não houver ninguém para responder. Melhor esconder que deixar o cliente falando sozinho.',
      },
    },
    {
      name: 'numero',
      label: 'Número do WhatsApp',
      type: 'text',
      required: true,
      validate: validarNumeroWhatsApp,
      admin: {
        placeholder: '5519991234567',
        description:
          'Escreva o número completo, só com dígitos, começando pelo 55 do Brasil: 55, DDD, telefone. Para (19) 99123-4567 escreva 5519991234567. Sem espaço, sem parênteses, sem traço.',
      },
    },
    {
      name: 'mensagemPadrao',
      label: 'Mensagem que já vem escrita',
      type: 'textarea',
      required: true,
      defaultValue: 'Olá! Vim pelo site da Elessar Records.',
      admin: {
        description:
          'Quando o cliente clica no botão, o WhatsApp abre com esta frase já digitada — ele só aperta enviar. Serve para você saber de onde a pessoa veio. Vale a pena ser específico: "Olá! Vim pelo site da Elessar Records." é melhor que "Oi".',
      },
    },
    {
      name: 'mensagemNoProduto',
      label: 'Mensagem quando o cliente está vendo um produto',
      type: 'textarea',
      defaultValue: 'Olá! Tenho uma dúvida sobre o produto {{produto}}.',
      admin: {
        description:
          'Usada no lugar da mensagem acima quando a pessoa clica estando na página de um produto. Escreva {{produto}} onde quiser que o site encaixe o nome do disco ou da peça — ele troca sozinho. Assim você já abre a conversa sabendo do que se trata, em vez de perguntar "qual produto?". Se deixar vazio, vale a mensagem padrão em todo lugar.',
      },
    },
    {
      name: 'textoDoBotao',
      label: 'Texto que aparece ao passar o mouse',
      type: 'text',
      defaultValue: 'Fale conosco',
      admin: {
        description:
          'Uma frase curta que aparece ao lado do botão quando o cliente passa o mouse por cima. Exemplo: "Fale conosco" ou "Tire sua dúvida".',
      },
    },
    {
      name: 'horarioAtendimento',
      label: 'Horário de atendimento',
      type: 'text',
      admin: {
        description:
          'Aparece junto do botão para o cliente saber quando esperar resposta. Exemplo: "Segunda a sexta, das 9h às 18h". Deixar isso claro evita a frustração de quem manda mensagem no domingo à noite e acha que foi ignorado. Pode deixar vazio.',
      },
    },
  ],
}
