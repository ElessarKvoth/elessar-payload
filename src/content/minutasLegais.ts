import { documento, lista, paragrafo, titulo } from '../utils/lexical'

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️  MINUTAS — PRECISAM DE REVISÃO DE ADVOGADO ANTES DE ENTRAR NO AR
   ═══════════════════════════════════════════════════════════════════════════

   Estes textos foram escritos para um e-commerce de discos de vinil no Brasil
   e refletem o que o sistema realmente faz: os prazos citados, os terceiros
   listados e os dados coletados conferem com o código. Isso os torna um ponto
   de partida honesto — NÃO um documento juridicamente revisado.

   Um advogado precisa conferir, no mínimo:

   · os prazos de troca e garantia diante do CDC e do seu processo real;
   · a redação das bases legais da LGPD e a figura do encarregado;
   · a cláusula de limitação de responsabilidade, que costuma ser a mais
     atacada em ação de consumidor e a que mais varia por jurisprudência;
   · o foro eleito — em relação de consumo o foro do domicílio do consumidor
     prevalece, e cláusula em contrário costuma ser afastada.

   Estes textos são carregados no painel por `npm run legais:carregar` e viram
   conteúdo EDITÁVEL. Depois de carregados, a fonte da verdade é o painel, não
   este arquivo: mudanças aqui não voltam sozinhas para o site.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DadosDaLoja {
  nome: string
  razaoSocial: string
  cnpj: string
  endereco: string
  email: string
  telefone: string
}

/** Marcador visível para o gerente enxergar o que falta preencher no painel. */
export const aPreencher = (o: string): string => `[PREENCHER: ${o}]`

export interface Minuta {
  titulo: string
  blocos: ReturnType<typeof paragrafo>[]
}

// ─── 1. Termos de Uso ────────────────────────────────────────────────────────

function termosDeUso(loja: DadosDaLoja): Minuta {
  return {
    titulo: 'Termos de Uso',
    blocos: [
      paragrafo(
        `Estes Termos regulam o uso da loja virtual ${loja.nome} e a compra de produtos por meio dela. ` +
          'Ao criar uma conta ou finalizar um pedido, você declara que leu e concorda com o que está escrito aqui.',
      ),

      titulo('Quem somos'),
      paragrafo(
        `A loja é operada por ${loja.razaoSocial}, inscrita no CNPJ ${loja.cnpj}, com endereço em ${loja.endereco}. ` +
          `O contato oficial para qualquer assunto tratado nestes Termos é ${loja.email}.`,
      ),

      titulo('Conta de cliente'),
      paragrafo(
        'Para comprar é necessário criar uma conta. Ao se cadastrar, você se compromete a fornecer dados verdadeiros ' +
          'e a mantê-los atualizados — é com eles que emitimos a nota e a etiqueta de entrega.',
      ),
      lista([
        'É preciso ter **18 anos ou mais** para criar conta e comprar.',
        'Cada CPF pode ter **uma única conta**.',
        'O e-mail informado precisa ser **confirmado** antes da primeira compra. Enquanto não for, a conta não entra e não finaliza pedido.',
        'A senha é pessoal. Você responde pelo que for feito na sua conta enquanto ela estiver ativa; se desconfiar de acesso indevido, troque a senha e nos avise.',
        'Podemos suspender contas com dados falsos, uso fraudulento ou tentativa de burlar limites de compra.',
      ]),

      titulo('Produtos, estado de conservação e disponibilidade'),
      paragrafo(
        'Trabalhamos com discos novos (lacrados) e usados. Para os usados, o **estado de conservação é informado no anúncio** ' +
          'e faz parte da descrição do produto: um disco anunciado como usado tem marcas de uso compatíveis com a classificação declarada.',
      ),
      paragrafo(
        'As fotos buscam representar o item real sempre que possível. Pequenas variações de cor entre a foto e o produto ' +
          'podem ocorrer por causa da tela de cada aparelho e não caracterizam produto diverso do anunciado.',
      ),
      paragrafo(
        'O estoque é limitado e frequentemente de **peça única**. Um item só é reservado quando o pagamento é confirmado; ' +
          'colocar no carrinho não garante a compra. Se um produto ficar indisponível depois do pedido, entramos em contato ' +
          'e devolvemos integralmente o valor pago.',
      ),

      titulo('Preços e pagamento'),
      paragrafo(
        'Os preços são em reais e podem mudar a qualquer momento, valendo sempre o preço exibido no momento da finalização do pedido. ' +
          'O frete é calculado à parte, conforme o CEP de destino.',
      ),
      paragrafo(
        'O pagamento é processado pelo **Mercado Pago**. A loja não recebe nem armazena os dados do seu cartão — eles são ' +
          'informados diretamente no ambiente do meio de pagamento.',
      ),
      paragrafo(
        'Em caso de **erro evidente de preço** (por exemplo, um disco anunciado por valor irrisório em razão de falha de cadastro), ' +
          'podemos cancelar o pedido e devolver integralmente o valor pago, comunicando você. Erro manifesto não gera obrigação de venda.',
      ),

      titulo('Entrega, trocas e devoluções'),
      paragrafo(
        'Os prazos, custos e condições de envio estão na Política de Entrega e Frete. As regras de arrependimento, troca e ' +
          'devolução estão na Política de Trocas e Devoluções. As duas fazem parte destes Termos.',
      ),

      titulo('Uso do site'),
      paragrafo('Ao usar a loja, você concorda em não:'),
      lista([
        'copiar, raspar ou reproduzir o conteúdo do site para fins comerciais sem autorização;',
        'tentar acessar áreas restritas, contas de terceiros ou sistemas internos;',
        'usar robôs para gerar pedidos, esgotar estoque ou consultar frete em massa;',
        'publicar conteúdo ilegal, ofensivo ou que viole direito de terceiro em qualquer campo de texto.',
      ]),

      titulo('Propriedade intelectual'),
      paragrafo(
        'A marca, o layout, os textos e as fotografias próprias da loja pertencem a ela. Capas, nomes de artistas e obras ' +
          'musicais pertencem a seus respectivos titulares e são exibidos apenas para identificar o produto à venda.',
      ),

      titulo('Responsabilidade'),
      paragrafo(
        'Respondemos pelos produtos que vendemos nos termos do Código de Defesa do Consumidor. Não respondemos por ' +
          'indisponibilidade momentânea do site, por atrasos causados por terceiros de transporte, nem pelo uso do disco ' +
          'em equipamento inadequado — agulha gasta e toca-discos desregulado danificam o vinil e esse dano não é defeito do produto.',
      ),

      titulo('Mudanças nestes Termos'),
      paragrafo(
        'Podemos alterar estes Termos. Cada versão recebe um número, exibido no rodapé desta página. ' +
          'Quando houver mudança relevante, pediremos seu aceite da nova versão no próximo acesso — e você poderá lê-la antes de concordar.',
      ),

      titulo('Lei aplicável e foro'),
      paragrafo(
        'Aplica-se a lei brasileira, em especial o Código de Defesa do Consumidor (Lei 8.078/1990) e o Marco Civil da Internet ' +
          '(Lei 12.965/2014). Fica assegurado ao consumidor o direito de demandar no foro de seu domicílio.',
      ),

      titulo('Fale com a gente'),
      paragrafo(`Dúvidas sobre estes Termos: ${loja.email}${loja.telefone ? ` · ${loja.telefone}` : ''}.`),
    ],
  }
}

// ─── 2. Política de Privacidade (LGPD) ───────────────────────────────────────

function politicaDePrivacidade(loja: DadosDaLoja): Minuta {
  return {
    titulo: 'Política de Privacidade',
    blocos: [
      paragrafo(
        `Esta Política explica quais dados pessoais a ${loja.nome} coleta, por que coleta, com quem compartilha e ` +
          'como você exerce seus direitos. Foi escrita para atender à Lei Geral de Proteção de Dados (Lei 13.709/2018).',
      ),

      titulo('Quem controla seus dados'),
      paragrafo(
        `Controlador: ${loja.razaoSocial}, CNPJ ${loja.cnpj}, ${loja.endereco}.`,
      ),
      paragrafo(
        `**Encarregado pelo tratamento de dados (DPO):** ${loja.email}. ` +
          'É por este canal que você pede acesso, correção ou exclusão dos seus dados.',
      ),

      titulo('Quais dados coletamos'),
      paragrafo('**Dados que você informa no cadastro e no pedido:**'),
      lista([
        'nome completo, CPF, data de nascimento;',
        'e-mail e telefone;',
        'endereço de entrega completo.',
      ]),
      paragrafo('**Dados gerados pelo uso da loja:**'),
      lista([
        'endereço IP e informações básicas do navegador e do aparelho;',
        'histórico de pedidos, valores, produtos e status de entrega;',
        'registros de acesso à conta (data, hora e IP), guardados como exige o Marco Civil da Internet;',
        'data, hora e IP do aceite destes documentos, guardados como prova do consentimento.',
      ]),
      paragrafo(
        '**Não coletamos dados de cartão de crédito.** Eles são informados diretamente no ambiente do Mercado Pago, ' +
          'que é quem processa o pagamento.',
      ),

      titulo('Por que usamos cada dado (finalidade e base legal)'),
      lista([
        '**Criar e manter sua conta** — necessário para executar o contrato entre você e a loja (art. 7º, V).',
        '**Processar o pedido, cobrar e entregar** — execução do contrato (art. 7º, V). Sem CPF e endereço não é possível emitir a etiqueta dos Correios.',
        '**Emitir nota fiscal e guardar registros contábeis** — cumprimento de obrigação legal e regulatória (art. 7º, II).',
        '**Guardar registros de acesso** — cumprimento de obrigação legal do Marco Civil da Internet (art. 7º, II).',
        '**Prevenir fraude e proteger a conta** — legítimo interesse da loja e do próprio titular (art. 7º, IX).',
        '**Enviar novidades e promoções** — apenas com o seu **consentimento** (art. 7º, I), dado em caixa separada no cadastro e revogável a qualquer momento.',
      ]),

      titulo('Com quem compartilhamos'),
      paragrafo(
        'Compartilhamos o mínimo necessário, e apenas com quem participa da operação da loja:',
      ),
      lista([
        '**Mercado Pago** — processamento do pagamento. Recebe nome, e-mail, CPF e valor do pedido.',
        '**SuperFrete e transportadoras (Correios)** — cálculo de frete e entrega. Recebem nome, CPF, endereço, telefone e e-mail do destinatário, dados exigidos para a emissão da etiqueta.',
        '**Resend** — envio dos e-mails da loja (confirmação de conta, recuperação de senha, avisos de pedido). Recebe seu e-mail e o conteúdo da mensagem.',
        '**Provedores de hospedagem e banco de dados** — armazenam os dados da loja com segurança e não os utilizam para finalidade própria.',
      ]),
      paragrafo(
        'Não vendemos seus dados e não os cedemos para publicidade de terceiros.',
      ),

      titulo('Transferência internacional'),
      paragrafo(
        'Alguns desses fornecedores mantêm servidores fora do Brasil. Quando isso ocorre, a transferência é feita para ' +
          'permitir a execução do contrato com você e é acompanhada dos compromissos contratuais de proteção oferecidos ' +
          'por cada fornecedor, conforme o art. 33 da LGPD.',
      ),

      titulo('Por quanto tempo guardamos'),
      lista([
        'Dados de pedido e nota fiscal: pelo prazo exigido pela legislação fiscal, de no mínimo 5 anos.',
        'Registros de acesso à conta: 6 meses, como determina o Marco Civil da Internet.',
        'Dados de cadastro: enquanto a conta existir. Se você pedir a exclusão, apagamos o que não formos obrigados a guardar por lei.',
        'Prova do aceite dos termos: enquanto a conta existir e pelo prazo em que a relação possa ser questionada.',
      ]),

      titulo('Seus direitos'),
      paragrafo('A LGPD garante a você, a qualquer momento e sem custo:'),
      lista([
        'confirmar se tratamos dados seus e acessar esses dados;',
        'corrigir dados incompletos, inexatos ou desatualizados;',
        'pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
        'pedir a portabilidade dos dados a outro fornecedor;',
        'saber com quem compartilhamos seus dados;',
        'revogar o consentimento de marketing, sem que isso afete suas compras;',
        'opor-se a tratamento feito com base em legítimo interesse.',
      ]),
      paragrafo(
        `Para exercer qualquer um deles, escreva para ${loja.email}. Respondemos em até 15 dias. ` +
          'Podemos pedir uma confirmação de identidade antes de atender — é o que impede que outra pessoa peça seus dados no seu lugar.',
      ),

      titulo('Segurança'),
      paragrafo(
        'As senhas são guardadas de forma cifrada e não são conhecidas nem pela equipe da loja. O acesso ao painel ' +
          'administrativo é restrito, a conexão com o site é criptografada, e a confirmação de e-mail é obrigatória antes ' +
          'da primeira compra. Nenhum sistema é infalível: se ocorrer incidente com risco relevante, comunicaremos você e a ANPD.',
      ),

      titulo('Menores de idade'),
      paragrafo(
        'A loja não se destina a menores de 18 anos e não coleta dados de crianças e adolescentes de forma consciente. ' +
          'Identificando cadastro nessa condição, a conta é encerrada e os dados eliminados.',
      ),

      titulo('Cookies'),
      paragrafo(
        'O uso de cookies e armazenamento local está descrito na Política de Cookies.',
      ),

      titulo('Mudanças nesta Política'),
      paragrafo(
        'Esta Política pode ser atualizada. A data da última revisão aparece no fim da página, e mudanças relevantes ' +
          'são comunicadas com pedido de novo aceite.',
      ),
    ],
  }
}

// ─── 3. Trocas e Devoluções ──────────────────────────────────────────────────

function trocasEDevolucoes(loja: DadosDaLoja): Minuta {
  return {
    titulo: 'Trocas e Devoluções',
    blocos: [
      paragrafo(
        'Aqui estão as três situações em que um disco volta para nós: você mudou de ideia, o produto veio com defeito, ' +
          'ou recebemos algo diferente do que foi pedido. Cada uma tem prazo e procedimento próprios.',
      ),

      titulo('1. Você mudou de ideia (direito de arrependimento)'),
      paragrafo(
        'Por ser compra pela internet, você tem **7 dias corridos, contados do recebimento**, para desistir da compra ' +
          'sem precisar justificar. É o direito garantido pelo art. 49 do Código de Defesa do Consumidor.',
      ),
      lista([
        'O produto deve voltar **nas mesmas condições em que chegou**, com a embalagem e os itens que o acompanhavam.',
        'Discos **lacrados** devem voltar lacrados. Rompido o lacre, o direito de arrependimento não se aplica, porque o produto deixa de ser revendável como novo.',
        '**O frete da devolução é por nossa conta** neste caso — enviamos o código de postagem.',
        'Devolvemos **o valor integral, incluindo o frete que você pagou**, em até 10 dias após recebermos o disco de volta e conferirmos as condições.',
        'O reembolso é feito pelo mesmo meio do pagamento. Em cartão, o estorno aparece conforme o prazo da administradora, geralmente na fatura seguinte.',
      ]),

      titulo('2. O produto veio com defeito'),
      paragrafo(
        'Disco é bem durável: o prazo legal para reclamar de vício aparente é de **90 dias do recebimento** (art. 26, II, do CDC). ' +
          'Para vício oculto, o prazo conta a partir do momento em que o problema fica evidente.',
      ),
      paragrafo('**Consideramos defeito:**'),
      lista([
        'disco empenado a ponto de prejudicar a reprodução;',
        'salto ou travamento em faixa, não decorrente do estado de conservação declarado;',
        'arranhão profundo não informado no anúncio;',
        'disco ou capa diferentes do anunciado (edição, cor de vinil, número de discos);',
        'dano ocorrido no transporte.',
      ]),
      paragrafo('**Não consideramos defeito, em discos usados:**'),
      lista([
        'ruído leve de superfície compatível com o **estado de conservação declarado** no anúncio;',
        'marcas de manuseio na capa descritas na descrição;',
        'sinais próprios de disco prensado há décadas, quando o anúncio informa que se trata de item usado;',
        'dano causado por agulha gasta, toca-discos desregulado ou armazenamento inadequado depois da entrega.',
      ]),
      paragrafo(
        'Reconhecido o defeito, você escolhe entre **troca por outro exemplar** (se houver), **devolução do valor pago** ' +
          'ou **abatimento proporcional do preço**. O frete de ida e volta é por nossa conta.',
      ),

      titulo('3. Produto errado ou avariado no transporte'),
      paragrafo(
        'Confira a encomenda na chegada. Se a embalagem estiver visivelmente violada ou amassada, **recuse o recebimento** ' +
          'e nos avise: isso facilita muito a reclamação junto à transportadora. Se só perceber depois de abrir, ' +
          'fotografe a embalagem e o disco e nos envie em até 7 dias — resolvemos com troca ou reembolso integral.',
      ),

      titulo('Como solicitar'),
      paragrafo(
        `Escreva para ${loja.email}${loja.telefone ? ` ou chame no ${loja.telefone}` : ''} informando o **número do pedido**, ` +
          'o que aconteceu e, quando for o caso, fotos que mostrem o problema. Respondemos em até 2 dias úteis com as ' +
          'instruções de postagem.',
      ),
      paragrafo(
        'Não envie o produto de volta antes de falar com a gente: sem o combinado prévio, a devolução pode chegar sem ' +
          'identificação e atrasar o seu reembolso.',
      ),
    ],
  }
}

// ─── 4. Entrega e Frete ──────────────────────────────────────────────────────

function entregaEFrete(loja: DadosDaLoja): Minuta {
  return {
    titulo: 'Entrega e Frete',
    blocos: [
      paragrafo(
        'Todo pedido é embalado por nós e enviado com código de rastreamento. Abaixo, o que esperar em cada etapa.',
      ),

      titulo('Prazo de postagem'),
      paragrafo(
        'Postamos em até **2 dias úteis após a confirmação do pagamento**. Pedidos pagos por PIX costumam ser confirmados ' +
          'em minutos; boleto pode levar até 3 dias úteis para compensar, e o prazo de postagem só começa a contar depois disso.',
      ),

      titulo('Prazo de entrega'),
      paragrafo(
        'O prazo mostrado no carrinho é a **estimativa da transportadora** para o seu CEP, contada a partir da postagem — ' +
          'não a partir da compra. Somando: prazo de postagem + prazo da transportadora.',
      ),
      paragrafo(
        'Esse prazo é responsabilidade da transportadora e pode variar por greve, condição climática, período de festas ' +
          'ou dificuldade de acesso à região. Quando houver atraso relevante, acompanhamos junto à transportadora e ' +
          'mantemos você informado.',
      ),

      titulo('Frete'),
      paragrafo(
        'O valor é calculado pelo peso e pelas dimensões reais da embalagem, no CEP que você informar, antes de finalizar ' +
          'a compra. O valor exibido já inclui o custo de embalagem — não há taxas somadas depois.',
      ),

      titulo('Como embalamos'),
      paragrafo(
        'Disco não sobrevive a embalagem improvisada. Cada pedido segue com proteção específica para vinil: ' +
          'o disco vai fora da capa quando necessário para evitar marca de anel, protegido contra umidade, e a caixa é ' +
          'dimensionada para impedir que o conteúdo se mova no transporte.',
      ),

      titulo('Rastreamento'),
      paragrafo(
        'Assim que a etiqueta é gerada, o código de rastreio aparece na página do seu pedido e é enviado por e-mail. ' +
          'O código pode levar até 24 horas para apresentar movimentação no site da transportadora.',
      ),

      titulo('Endereço e tentativas de entrega'),
      paragrafo(
        '**Confira o endereço antes de finalizar.** Endereço incorreto ou incompleto é a causa mais comum de devolução ao ' +
          'remetente. Nesse caso, o reenvio depende de um novo frete, por ser custo gerado por informação equivocada.',
      ),
      paragrafo(
        'A transportadora faz as tentativas de entrega previstas em seu procedimento e, sem sucesso, mantém o objeto ' +
          'disponível para retirada na unidade por prazo determinado antes de devolvê-lo.',
      ),

      titulo('Extravio'),
      paragrafo(
        'Se a encomenda for extraviada, abrimos a reclamação junto à transportadora e **resolvemos com você por reenvio ' +
          'ou reembolso integral**, sem esperar o desfecho do processo com a transportadora — isso é problema nosso, não seu.',
      ),

      titulo('Dúvidas sobre a sua entrega'),
      paragrafo(
        `Fale com a gente por ${loja.email}${loja.telefone ? ` ou ${loja.telefone}` : ''}, com o número do pedido em mãos.`,
      ),
    ],
  }
}

// ─── 5. Cookies ──────────────────────────────────────────────────────────────

function politicaDeCookies(loja: DadosDaLoja): Minuta {
  return {
    titulo: 'Política de Cookies',
    blocos: [
      paragrafo(
        'Cookies e armazenamento local são pequenos arquivos que o site guarda no seu navegador. Esta página explica ' +
          'quais usamos e para quê.',
      ),

      titulo('O que guardamos no seu navegador'),
      paragrafo('**Necessários ao funcionamento** — sem eles a loja não funciona:'),
      lista([
        '**Sessão de login:** guarda o comprovante de que você entrou na conta, para você não precisar digitar a senha a cada página. É apagado quando você sai.',
        '**Carrinho:** guarda os itens que você escolheu, para não perdê-los ao navegar entre as páginas.',
        '**Preferências de navegação:** pequenas escolhas de exibição, como filtros usados no catálogo.',
      ]),
      paragrafo('**De terceiros, durante o pagamento:**'),
      lista([
        '**Mercado Pago:** ao ir para o pagamento, você entra no ambiente deles, que usa cookies próprios para processar a transação e prevenir fraude. Esse uso é regido pela política de privacidade do Mercado Pago.',
      ]),
      paragrafo(
        `**Não usamos cookies de publicidade comportamental** e não cedemos seu histórico de navegação para redes de anúncio. ${aPreencher(
          'confirmar esta afirmação se algum dia forem instaladas ferramentas de análise ou pixel de rede social',
        )}`,
      ),

      titulo('Como desativar'),
      paragrafo(
        'Todo navegador permite bloquear ou apagar cookies e dados de sites nas configurações de privacidade. ' +
          'Vale saber o efeito: bloqueando os necessários, **o login e o carrinho deixam de funcionar** — o site abre, ' +
          'mas não é possível comprar.',
      ),

      titulo('Dados pessoais e cookies'),
      paragrafo(
        'Quando um cookie permite identificar você, ele é tratado como dado pessoal e segue as regras da nossa Política ' +
          'de Privacidade, inclusive quanto aos seus direitos de acesso e exclusão.',
      ),

      titulo('Dúvidas'),
      paragrafo(`Escreva para ${loja.email}.`),
    ],
  }
}

// ─── Reunião ─────────────────────────────────────────────────────────────────

export type ChaveMinuta = 'termos' | 'privacidade' | 'trocas' | 'entrega' | 'cookies'

export function montarMinutas(loja: DadosDaLoja): Record<ChaveMinuta, { titulo: string; texto: unknown }> {
  const construir = (m: Minuta) => ({ titulo: m.titulo, texto: documento(m.blocos) })

  return {
    termos: construir(termosDeUso(loja)),
    privacidade: construir(politicaDePrivacidade(loja)),
    trocas: construir(trocasEDevolucoes(loja)),
    entrega: construir(entregaEFrete(loja)),
    cookies: construir(politicaDeCookies(loja)),
  }
}
