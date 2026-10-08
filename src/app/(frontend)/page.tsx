import { redirect } from 'next/navigation'

// A raiz do backend não é uma página: o site da loja é o storefront, e aqui só
// existe o painel. Antes vivia a página de boas-vindas do template do Payload,
// que mostrava o e-mail de quem estava logado e um link `vscode://file/...`
// com o caminho do arquivo no servidor.
export default function Raiz() {
  redirect('/admin')
}
