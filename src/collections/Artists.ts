import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { generateSlug } from '../utils/generateSlug'

export const Artists: CollectionConfig = {
  slug: 'artists',
  labels: {
    singular: 'Artista ou Banda',
    plural: 'Artistas e Bandas',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    description: 'Cadastre os artistas e bandas dos produtos da loja.',
    defaultColumns: ['name', 'slug', 'active'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      index: true,
      admin: {
        description: 'Auto-generated from name. Can be overridden manually.',
      },
    },
    {
      name: 'photo',
      label: 'Foto do artista ou banda',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'Foto QUADRADA, no mínimo 1000 x 1000 pixels. Depois de escolher, use "Editar imagem" e ' +
          'posicione o PONTO DE FOCO sobre o rosto (ou o centro do grupo): assim ele não é cortado ' +
          'nos cards nem no destaque da página de artistas.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      // Era `foundedAt`, do tipo data completa com dia e mês.
      //
      // Dois motivos para virar só o ano. O primeiro é que ninguém sabe o dia
      // exato em que uma banda se formou — quem cataloga acervo conhece o ano,
      // e um campo que pede precisão inexistente ou fica vazio ou é preenchido
      // com chute. O segundo é técnico: guardar "1968" como data vira meia-noite
      // em UTC, que no fuso do Brasil volta como 31/12/1967. O ano apareceria
      // errado na tela sem ninguém entender por quê.
      //
      // A descrição antiga prometia destacar o artista mais próximo do
      // aniversário na página de Artistas. Esse recurso nunca foi construído:
      // o storefront apenas declara o tipo do campo e não o usa em lugar
      // nenhum. Prometer na tela o que o site não faz é pior que não ter o
      // campo, então a promessa saiu junto.
      name: 'anoDeFormacao',
      label: 'Ano de formação',
      type: 'number',
      min: 1900,
      max: new Date().getFullYear(),
      admin: {
        placeholder: '1968',
        description:
          'O ano em que a banda se formou, ou em que o artista começou a carreira. Só o ano, quatro dígitos: 1968. Aparece na página do artista. Pode deixar vazio se não souber — é melhor vazio que errado.',
      },
      validate: (valor: number | null | undefined): string | true => {
        if (valor === null || valor === undefined) return true
        const anoAtual = new Date().getFullYear()
        if (!Number.isInteger(valor)) {
          return 'Escreva só o ano, sem vírgula nem ponto. Exemplo: 1968.'
        }
        if (valor < 1900 || valor > anoAtual) {
          return `O ano precisa estar entre 1900 e ${anoAtual}. Você escreveu ${valor} — provavelmente faltou ou sobrou um dígito.`
        }
        return true
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, operation }) => {
        if (data?.name && !data.slug) {
          data.slug = generateSlug(data.name)
        }
        return data
      },
    ],
  },
}
