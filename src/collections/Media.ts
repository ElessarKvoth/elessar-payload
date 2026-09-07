import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'
import { uploadToCloudinary } from '../hooks/uploadToCloudinary'

// Abaixo disso a imagem tende a aparecer borrada no site (os cards do catálogo
// já pedem 1000px em telas de alta densidade).
const LADO_MINIMO_RECOMENDADO = 1000

// Transforma "capa-do-disco_01.jpg" em "Capa do disco 01".
function descricaoPeloNomeDoArquivo(nome: string): string {
  const semExtensao = nome.replace(/\.[^.]+$/, '')
  const limpo = semExtensao
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpo) return 'Imagem'
  return limpo.charAt(0).toUpperCase() + limpo.slice(1)
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Imagem',
    plural: 'Imagens',
  },
  admin: {
    group: 'Marketing',
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'avisoQualidade', 'createdAt'],
    description:
      'Todas as imagens do site. Aceita JPG, PNG, WebP e GIF. ' +
      'Depois de escolher o arquivo, use "Editar imagem" para RECORTAR (escolher o pedaço que aparece) ' +
      'e para posicionar o PONTO DE FOCO — a mirinha marca o que nunca pode ser cortado, ' +
      'e o site respeita esse ponto em qualquer formato (card quadrado, banner largo no computador, banner alto no celular). ' +
      'Prefira imagens grandes: no mínimo 1000 x 1000 pixels.',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [
      uploadToCloudinary,
      // Preenche a descrição sozinho e avisa (sem bloquear) quando a imagem for
      // pequena demais. Roda depois do upload para já ter width/height.
      ({ data, req }) => {
        const d = data as Record<string, unknown>

        if (typeof d.alt !== 'string' || d.alt.trim() === '') {
          const nome = req.file?.name ?? (d.filename as string | undefined) ?? ''
          d.alt = nome ? descricaoPeloNomeDoArquivo(nome) : 'Imagem'
        }

        const largura = Number(d.width)
        const altura = Number(d.height)
        if (Number.isFinite(largura) && Number.isFinite(altura) && largura > 0 && altura > 0) {
          const menorLado = Math.min(largura, altura)
          d.avisoQualidade =
            menorLado < LADO_MINIMO_RECOMENDADO
              ? `Esta imagem tem ${largura} x ${altura} pixels. O recomendado é no mínimo ` +
                `${LADO_MINIMO_RECOMENDADO} x ${LADO_MINIMO_RECOMENDADO} — ela pode aparecer borrada no site. ` +
                'Se possível, envie uma versão maior.'
              : null
        }

        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Payload gera `url` apontando para /api/media/file/... (localhost).
        // Com disableLocalStorage, esse arquivo não existe.
        // Substitui pelo URL real do Cloudinary para que o frontend receba a URL correta.
        if (doc.cloudinaryURL) {
          doc.url = doc.cloudinaryURL
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Descrição da imagem',
      type: 'text',
      admin: {
        description:
          'O que aparece na imagem, em poucas palavras (ex: "Capa do disco Paranoid, do Black Sabbath"). ' +
          'Usada por leitores de tela e pelo Google. Se deixar vazio, preenchemos com o nome do arquivo.',
      },
    },
    {
      name: 'avisoQualidade',
      label: 'Aviso de qualidade',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Preenchido automaticamente quando a imagem enviada é pequena demais.',
        condition: (data) => Boolean(data?.avisoQualidade),
      },
    },
    {
      name: 'cloudinaryURL',
      label: 'Endereço do arquivo',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Preenchido automaticamente após o upload.',
      },
    },
  ],
  upload: {
    // Files go to Cloudinary — no need to persist locally.
    disableLocalStorage: true,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    // Explícitos de propósito: são a base de todo o sistema de imagens.
    // `crop` dá o recorte manual; `focalPoint` grava focalX/focalY, que o site
    // usa para recortar em qualquer proporção sem perder o assunto.
    // Desligar qualquer um dos dois quebra o fluxo para quem cadastra.
    crop: true,
    focalPoint: true,
    adminThumbnail: ({ doc }) => {
      const url = doc.cloudinaryURL as string | undefined
      if (!url) return null
      // Cloudinary on-the-fly transformation for admin thumbnails.
      return url.replace('/upload/', '/upload/c_fill,w_300,h_300/')
    },
  },
}
