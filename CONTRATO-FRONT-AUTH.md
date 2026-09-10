# Contrato de autenticação — backend → storefront

Tudo o que o storefront precisa saber para fazer conta, login, confirmação de
e-mail e recuperação de senha funcionarem contra este backend.

**Base da API:** `NEXT_PUBLIC_PAYLOAD_URL` (o front já usa como `PAYLOAD_URL`).
Todos os caminhos abaixo são relativos a ela.

**Autenticação:** o Payload devolve um JWT em `token`. O storefront guarda no
`localStorage` e manda em `Authorization: Bearer <token>` — de propósito
separado do cookie do painel admin, para uma sessão não interferir na outra.

**Idioma das mensagens:** os endpoints **próprios** (`/api/conta/*`) respondem
em português com um campo `estado` legível por máquina. Os endpoints **nativos
do Payload** (`/api/users/*`) respondem em inglês e sem código estável — está
marcado onde isso acontece, porque é o principal ponto de atrito desta
integração.

---

## Estado atual — leia antes de implementar

| Fluxo | Situação |
|---|---|
| Cadastro | ✅ funciona (`POST /api/users`), **exige aceite dos termos** |
| Confirmação de e-mail | ✅ endpoint próprio com estados nomeados |
| Reenviar confirmação | ✅ endpoint próprio com rate limit |
| Login | ✅ endpoint próprio com estados nomeados |
| Aceite de termos | ✅ validado no servidor, com prova jurídica gravada |
| Esqueci a senha | ✅ endpoint próprio, resposta genérica + teto por e-mail |
| Redefinir senha | ✅ endpoint próprio, **derruba todas as sessões** |
| Trocar senha logado | ✅ endpoint próprio, exige a senha atual |

**Todos os fluxos de senha migraram para `/api/conta/*`.** Os nativos
(`/api/users/forgot-password`, `/api/users/reset-password`) continuam existindo
porque o Payload os monta sozinho, mas **não use nenhum deles**: não derrubam
sessão, não mandam aviso e não têm teto por e-mail.

> **A senha não muda mais por `PATCH /api/users/:id`.** O campo é recusado com
> 400 fora dos endpoints próprios. Antes ele funcionava, e era por ali que o
> storefront trocava senha — sem derrubar sessão e sem avisar ninguém.

**Verificação:** `npm run auth:diag` percorre esta página inteira contra o
servidor real e diz o que está de pé. Rode antes de mexer no front.

---

## 1. Criar conta

```http
POST /api/users
Content-Type: application/json

{
  "name": "Rhaziel Elessar",
  "email": "cliente@exemplo.com",
  "password": "senhaForte123",
  "cpf": "12345678909",
  "phone": "(11) 91234-5678",
  "birthDate": "1990-05-20",
  "aceitouTermos": true,
  "aceitouComunicacoesMarketing": false
}
```

**Obrigatórios:** `name`, `email`, `password`, `cpf`, `aceitouTermos`.
**Opcionais:** `phone`, `birthDate`, `aceitouComunicacoesMarketing`.

- `aceitouTermos` — **precisa ser `true`**, senão a conta não é criada (ver
  erros abaixo). Ao aceitar, o servidor grava sozinho a versão dos termos, a
  data e hora, o IP e a impressão digital do texto vigente. **Não envie esses
  campos** — são calculados no servidor; prova que o próprio interessado
  escreve não vale como prova.
- `aceitouComunicacoesMarketing` — consentimento de marketing, **separado e
  opcional** como manda a LGPD. Precisa ser um checkbox próprio na tela, nunca
  embutido no aceite obrigatório. Ausente = `false`.

- `cpf` — pode ir com ou sem máscara; o servidor normaliza para só dígitos. É
  **único**: uma conta por CPF. O servidor valida os dígitos verificadores de
  verdade, não só o formato.
- `birthDate` — se enviado, o servidor exige **18 anos ou mais**.
- `role` — **nunca envie**. É calculado no servidor a partir de `ADMIN_EMAILS` e
  qualquer valor enviado é descartado.
- `_verified` — **nunca envie**. Descartado no servidor. (Já foi aceito: dava
  para nascer com a conta confirmada, pular o e-mail inteiro e, com ele, o
  portão do checkout. Fechado — mas se algum dia o cadastro "confirmar sozinho"
  em teste, é aqui que se olha.)

**Sucesso — 201**

```json
{ "doc": { "id": 4, "email": "cliente@exemplo.com", "name": "...", "_verified": false }, "message": "..." }
```

Ao criar, o backend dispara automaticamente o e-mail de confirmação. A conta
nasce **não verificada** e **não consegue logar** até confirmar.

→ Depois desta chamada, leve o cliente para a tela **"Confirme seu e-mail"**.
Não tente logar automaticamente: vai falhar com 403.

**Erros — 400**

```json
{ "errors": [ { "message": "...", "data": { "field": "cpf" } } ] }
```

| Situação | Como reconhecer | Texto sugerido |
|---|---|---|
| E-mail já cadastrado | `field: "email"` ou mensagem com "email" | "Este e-mail já está cadastrado. Tente entrar." |
| CPF já cadastrado | `field: "cpf"` | "Este CPF já está cadastrado." |
| CPF inválido | mensagem "CPF inválido..." | "Este CPF não é válido. Confira os números." |
| Menor de 18 | mensagem sobre idade | "É necessário ter 18 anos ou mais." |
| Termos não aceitos | mensagem "Para criar sua conta é preciso aceitar..." | Use a mensagem do servidor, que já vem pronta em português |

Resposta real do servidor quando falta o aceite (HTTP 400):

```json
{ "errors": [ { "message": "Para criar sua conta é preciso aceitar os Termos de Uso e a Política de Privacidade." } ] }
```

---

## 2. Confirmar e-mail

```http
POST /api/conta/verificar
{ "token": "<token da URL>" }
```

O cliente chega em `/verificar-email?token=...`. **Use este endpoint, não o
`/api/users/verify/:token` nativo** — o nativo responde 403 igual para link
expirado, link já usado e token inventado, e é isso que faz o cliente achar
que a conta quebrou.

**Resposta** — sempre `{ estado, mensagem }`:

| `estado` | HTTP | Significado | Ação de saída na tela |
|---|---|---|---|
| `sucesso` | 200 | Confirmou agora | "Entrar na minha conta" |
| `ja_verificado` | 200 | Link já usado antes; a conta está ativa | "Entrar na minha conta" |
| `token_expirado` | 410 | Passou das 24h | Botão **"Enviar novo link"** (§3) |
| `token_invalido` | 400 | Token que nunca existiu | Botão **"Enviar novo link"** (§3) |

Também pode vir **429** (`estado: "token_invalido"`) se houver mais de 30
tentativas por minuto no mesmo IP — mostre "Muitas tentativas, aguarde um
minuto" e respeite o header `Retry-After`.

O link do e-mail vale **24 horas**.

---

## 3. Reenviar confirmação

```http
POST /api/conta/reenviar-verificacao
{ "email": "cliente@exemplo.com" }
```

**A resposta de sucesso é SEMPRE a mesma**, aconteça o que acontecer — conta
inexistente, já confirmada, bloqueada pelo limite ou e-mail realmente enviado:

```json
{ "estado": "enviado", "mensagem": "Se este e-mail estiver cadastrado e ainda não confirmado, enviamos um novo link. Confira sua caixa de entrada e o spam." }
```

Isso é intencional: se a resposta variasse, o endereço viraria uma ferramenta
para descobrir quem tem conta na loja. **Não tente inferir nada da resposta** —
mostre a mesma mensagem sempre.

| `estado` | HTTP | Quando |
|---|---|---|
| `enviado` | 200 | Sempre que o pedido foi aceito |
| `email_invalido` | 400 | Formato de e-mail inválido |
| `muitas_tentativas` | 429 | Mais de 5 pedidos por hora no mesmo IP |

**Limites que o front precisa respeitar:** 1 reenvio a cada **60 segundos** por
conta e 5 por hora. Pedidos dentro do minuto são descartados em silêncio (com
resposta de sucesso). Por isso o botão de reenviar precisa de **contador
regressivo de 60s** — sem ele o cliente clica cinco vezes achando que não
funcionou, e nenhum e-mail extra sai.

Cada reenvio **invalida o link anterior**.

---

## 4. Login

```http
POST /api/conta/entrar
{ "email": "cliente@exemplo.com", "password": "senhaForte123" }
```

**Use este endpoint, não o `/api/users/login` nativo.** O nativo devolve os três
motivos de recusa em prosa inglesa, e dois deles com o mesmo código HTTP — o
front teria que decidir por `.includes('locked')`, que quebra em silêncio na
próxima atualização do Payload. Aqui a distinção é feita no backend por classe
de erro e chega pronta.

**Sucesso — 200**

```json
{
  "estado": "sucesso",
  "token": "<jwt>",
  "exp": 1234567890,
  "user": { "id": 4, "email": "...", "_verified": true, "role": "client" },
  "precisaAceitarNovosTermos": false,
  "versaoDosTermosVigente": "1.0"
}
```

Guarde `token`. A sessão dura **2 horas**.

`precisaAceitarNovosTermos: true` significa que o gerente publicou uma versão
nova das regras depois que esta pessoa se cadastrou. **Não bloqueie a entrada** —
mostre o pedido de novo aceite depois de logar. Trancar alguém para fora da
própria conta por causa de uma alteração nos termos seria desproporcional.

**Erros**

| `estado` | HTTP | O que mostrar |
|---|---|---|
| `email_nao_confirmado` | 403 | "Confirme seu e-mail antes de entrar." + **botão de reenviar** (§3). A resposta traz `podeReenviarConfirmacao: true` |
| `conta_travada` | 423 | "Conta bloqueada por tentativas erradas. Aguarde 10 minutos." |
| `credenciais_invalidas` | 401 | "E-mail ou senha incorretos." |
| `muitas_tentativas` | 429 | "Muitas tentativas. Aguarde um minuto." — respeite o `Retry-After` |

Todas as respostas trazem `mensagem` em português, pronta para exibir.

> **Detalhe que muda a tela:** o Payload confere a **senha antes** da
> confirmação de e-mail. Ou seja, `email_nao_confirmado` só aparece quando a
> senha está **certa**; com a senha errada, uma conta não confirmada devolve
> `credenciais_invalidas` como qualquer outra. Isso é proposital — não revela o
> estado da conta a quem não sabe a senha — mas significa que o botão de
> reenviar confirmação **só pode aparecer depois de um 403**, nunca antes.

**Bloqueio por tentativas — explique na tela:** 5 senhas erradas travam a conta
por 10 minutos, e **durante o bloqueio até a senha certa é recusada**. Sem esse
aviso, o cliente insiste, reinicia a contagem e conclui que a conta quebrou —
foi exatamente o que aconteceu em produção com a conta do administrador.

O endpoint nativo `/api/users/login` continua existindo e funcionando; só não
tem os estados nomeados.

---

## 5. Sessão

```http
GET  /api/users/me       Authorization: Bearer <token>   → { user } ou { user: null }
POST /api/users/logout   Authorization: Bearer <token>
```

`GET /me` devolve `user: null` para token expirado **ou para conta que deixou de
ser verificada** — trate os dois como "deslogado" e limpe o `localStorage`.

---

## 6. Esqueci minha senha

```http
POST /api/conta/esqueci-senha
{ "email": "cliente@exemplo.com" }
```

**A resposta de sucesso é SEMPRE a mesma**, exista a conta ou não:

```json
{ "estado": "enviado", "mensagem": "Se este e-mail estiver cadastrado, enviamos as instruções para redefinir a senha. Confira a caixa de entrada e o spam." }
```

| `estado` | HTTP | Quando |
|---|---|---|
| `enviado` | 200 | Sempre que o pedido foi aceito |
| `email_invalido` | 400 | Formato de e-mail inválido |
| `muitas_tentativas` | 429 | Mais de 5 pedidos por hora no mesmo IP |

Há também um teto de **3 pedidos por hora por e-mail**, que não aparece na
resposta: estourá-lo devolve o mesmo 200 e não manda nada. Ele existe porque o
limite por IP não impede inundar a caixa de entrada de uma pessoa específica a
partir de vários IPs.

O e-mail leva link para `/redefinir-senha?token=...`, válido por **1 hora**.

---

## 7. Redefinir senha

```http
POST /api/conta/redefinir-senha
{ "token": "<token da URL>", "password": "novaSenha123" }
```

| `estado` | HTTP | Significado |
|---|---|---|
| `sucesso` | 200 | Senha trocada, **todas as sessões derrubadas** |
| `link_invalido` | 400 | Expirado, já usado ou inventado — os três juntos |
| `senha_fraca` | 400 | Menos de 8 caracteres |
| `muitas_tentativas` | 429 | Mais de 10 tentativas por minuto no mesmo IP |

> **O sucesso NÃO devolve token, de propósito.** Todas as sessões da conta são
> apagadas, inclusive a que a redefinição criaria. A resposta traz
> `precisaEntrarDeNovo: true` e a tela deve mandar entrar de novo — não prometa
> "você já está conectado". Se o front tiver token guardado, **descarte-o**:
> ele já não vale.
>
> Isto é o ponto do fluxo, não um detalhe: quem redefine a senha quase sempre
> está expulsando alguém. Deixar a sessão do invasor de pé desfaz o motivo da
> troca.

O cliente também recebe um e-mail avisando que a senha mudou.

Link expirado, já usado e inventado continuam indistinguíveis — o servidor não
tem como separar. Uma tela só para os três: "Este link expirou ou já foi usado"
+ botão "Pedir um novo link".

---

## 7b. Trocar a senha estando logado

```http
POST /api/conta/trocar-senha        Authorization: Bearer <token>
{ "senhaAtual": "...", "novaSenha": "..." }
```

| `estado` | HTTP | O que mostrar |
|---|---|---|
| `sucesso` | 200 | "Senha alterada. Todos os aparelhos foram desconectados." |
| `senha_atual_incorreta` | 403 | "A senha atual está incorreta." |
| `senha_fraca` | 400 | Mínimo de 8 caracteres |
| `senha_repetida` | 400 | "A nova senha precisa ser diferente da atual." |
| `dados_incompletos` | 400 | Faltou um dos dois campos |
| `nao_autenticado` | 401 | Sessão expirada: mande entrar de novo |
| `muitas_tentativas` | 429 | 5 tentativas por 15 minutos, por conta |

Como no §7, o sucesso derruba todas as sessões (a desta aba inclusive) e devolve
`precisaEntrarDeNovo: true`. **Descarte o token e leve para o login.**

> **Não faça isso na mão.** Conferir a senha atual chamando `/api/conta/entrar`
> e depois gravar a nova por `PATCH /api/users/:id` foi o que o storefront fazia,
> e tinha três defeitos: errar a senha atual cinco vezes trancava o cliente para
> fora da conta em que ele já estava (o login conta tentativas e bloqueia por 10
> minutos), o login de conferência gravava um token novo por cima do atual e
> disparava "novo acesso à sua conta", e o PATCH não derrubava sessão nem
> avisava. O PATCH agora recusa `password` — este endpoint é o caminho.

---

## 8. Comprar exige e-mail confirmado

`POST /api/orders` e `POST /api/pedidos/criar-pagamento` recusam conta não
verificada:

```json
{ "erro": "Confirme seu e-mail antes de finalizar a compra.", "estado": "email_nao_confirmado" }
```

HTTP **403** no endpoint de pagamento. Leve o cliente para a tela de confirmação
com o botão de reenviar.

---

## 9. Textos legais (Termos, Privacidade, etc.)

```http
GET /api/globals/paginas-legais
```

Público, sem autenticação. Estrutura:

```json
{
  "versaoDosTermos": "1.0",
  "comoComprar": { "titulo": "...", "texto": <richText>, "atualizadoEm": "2026-01-15T..." },
  "entrega":     { "titulo": "...", "texto": <richText>, "atualizadoEm": null },
  "trocas":      { ... },
  "privacidade": { ... },
  "termos":      { ... },
  "cookies":     { ... }
}
```

`versaoDosTermos` é o número que o servidor grava na conta no momento do
cadastro. O front **não precisa enviá-lo** — só exibi-lo, se quiser, no rodapé
dos modais ("versão 1.0").

`texto` é **Lexical rich text**, não HTML nem markdown — o front já tem
`components/ui/RichText.tsx` para renderizar. Um `texto` vazio significa
"página ainda não escrita": não renderize a seção.

**Nenhum texto legal deve ser escrito no front.** Os modais de Termos e
Privacidade consomem `termos` e `privacidade` daqui.

---

## 10. Telas que o storefront precisa ter

| Rota | Estados a tratar |
|---|---|
| `/criar-conta` | Etapa 1 (dados), Etapa 2 (acesso e termos), erro por campo |
| `/confirme-seu-email` | Após o cadastro: instruções, spam, reenviar com contador de 60s |
| `/verificar-email?token=` | `sucesso`, `ja_verificado`, `token_expirado`, `token_invalido`, 429 |
| `/entrar` | Credenciais erradas, conta travada, **e-mail não confirmado (403) com botão de reenvio** |
| `/esqueci-senha` | Resposta genérica sempre |
| `/redefinir-senha?token=` | Sucesso (**mandar entrar de novo**), link expirado/inválido (mesma tela), senha fraca |
| `/perfil` → segurança | Troca de senha por `/api/conta/trocar-senha`, e sair da sessão no sucesso |

---

## 11. O que ainda falta no backend

Escrito aqui para o front não ser construído em cima de suposição:

1. **Minutas dos documentos legais** — os campos e a versão existem, mas o
   TEXTO das cinco páginas ainda está vazio no painel. Os modais de Termos e
   Privacidade vão aparecer em branco até o gerente escrever (ou até as minutas
   serem carregadas).
2. **Excluir conta** — o botão existe no `/perfil` mas não chama nada; falta o
   endpoint e a decisão sobre o que fazer com os pedidos já feitos.

### Armadilha do Payload que já custou caro aqui

**`admin.condition` desliga a validação do campo no servidor.** O Payload usa a
condição do painel para decidir se valida:

```js
passesCondition = field.admin.condition(data, ...)
skipValidationFromHere = skipValidation || !passesCondition
// fields/hooks/beforeChange/promise.js:37-43
```

O `birthDate` tinha `condition: (data) => Boolean(data.id)` — posto ali só para
esconder o campo na tela de "criar usuário" do painel. Como a condição é falsa
em toda criação, **a checagem de 18 anos ficou desligada exatamente no
cadastro**: uma conta de menor de idade entrava com HTTP 201. Levou meses até
`npm run auth:diag` apontar.

Regra que fica: **validação que precisa valer no servidor vai em hook de
collection**, não em `validate` de campo com `admin.condition`. O `validate` do
campo serve à experiência no painel; o hook é que é a regra.

### Limitações conhecidas, registradas para não virarem susto

- Trocar a senha **apaga `acessosRecentes` e `dispositivosConhecidos`**. O
  adapter reescreve as tabelas de array numa gravação de conta, e reenviar os
  arrays não impediu (testado). O cliente perde o histórico justamente quando
  ele seria útil.
- Trocar a senha estando logado ainda dispara **um e-mail de "novo acesso" a
  mais**, quando o aparelho não é conhecido. Nenhuma das três marcas de contexto
  impediu (testado). Incomoda, não expõe nada.

---

## 12. Histórico deste documento

Este arquivo já esteve **errado**, e o custo foi alto: descrevia como "Etapa 4
pendente" três endpoints que já existiam e funcionavam. O storefront foi
construído acreditando nele e ficou meses nos endpoints nativos — sem derrubar
sessão ao trocar senha, e trancando clientes para fora ao errar a senha atual.

Se você mudar um endpoint de auth, **mude este arquivo no mesmo commit**. E
prefira confiar no `npm run auth:diag`, que pergunta ao servidor, do que na
prosa acima.
