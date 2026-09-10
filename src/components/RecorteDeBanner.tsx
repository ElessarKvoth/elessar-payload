'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import { useField, useFormFields } from '@payloadcms/ui'
import 'react-image-crop/dist/ReactCrop.css'

import {
  BANNER_DESKTOP,
  BANNER_MOBILE,
  type EspecificacaoDeArte,
} from '../utils/proporcaoDeBanner'

/* ────────────────────────────────────────────────────────────────────────────
   CORTADOR DE BANNER COM PROPORÇÃO TRAVADA.

   POR QUE ESTE COMPONENTE EXISTE
   ──────────────────────────────
   O editor de imagem nativo do Payload tem recorte livre: ele renderiza o
   <ReactCrop> SEM a propriedade `aspect`
   (@payloadcms/ui/dist/elements/EditUpload/index.js:175) e não oferece nenhuma
   configuração para acrescentá-la. Na prática, quem recortava escolhia uma área
   de proporção qualquer, o site depois reenquadrava aquilo em 8:3, e o
   resultado não tinha relação com o que a pessoa tinha visto na tela — foi o
   que cortou o "@elessarrecords" do banner que foi ao ar.

   Aqui a janela é travada na proporção do banner. Só dá para mover e
   redimensionar mantendo o formato. O que aparece dentro da janela é
   exatamente o que vai para o site.

   POR QUE O RECORTE FICA NO BANNER, E NÃO NA IMAGEM
   ─────────────────────────────────────────────────
   A coleção de Imagens é COMPARTILHADA: a mesma foto pode ser capa de disco num
   card quadrado e fundo de banner. Um recorte 8:3 gravado na imagem valeria para
   os dois e destruiria o card. Por isso o retângulo mora no banner, ao lado do
   campo que o usa.

   O QUE É GRAVADO
   ───────────────
   Porcentagens (0–100) do original, não pixels. Assim o recorte continua
   fazendo sentido se a imagem for trocada por outra de tamanho diferente, e
   segue a mesma convenção do ponto de foco do Payload, que também é percentual.
   ──────────────────────────────────────────────────────────────────────────── */

export interface RetanguloDeRecorte {
  /** Distância da borda esquerda, em % da largura do original. */
  x: number
  /** Distância do topo, em % da altura do original. */
  y: number
  /** Largura da janela, em % da largura do original. */
  largura: number
  /** Altura da janela, em % da altura do original. */
  altura: number
}

interface Midia {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
}

interface Props {
  path: string
  /** Campo de imagem que este recorte acompanha. */
  campoDaImagem: 'image' | 'imageMobile'
  spec: EspecificacaoDeArte
}

/** Abaixo disso a arte recortada aparece borrada na tela do cliente. */
const NITIDEZ_MINIMA = 0.75

function RecorteDeBanner({ path, campoDaImagem, spec }: Props) {
  const { value, setValue } = useField<RetanguloDeRecorte | null>({ path })

  // O id da imagem escolhida vive no campo irmão. Lido do formulário para o
  // cortador reagir na hora em que o usuário troca a imagem, sem salvar antes.
  const valorDaImagem = useFormFields(([fields]) => fields?.[campoDaImagem]?.value)

  const [midia, setMidia] = useState<Midia | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const proporcao = spec.largura / spec.altura

  // ── Busca a imagem escolhida ──────────────────────────────────────────────
  useEffect(() => {
    const id =
      typeof valorDaImagem === 'object' && valorDaImagem !== null
        ? (valorDaImagem as { id?: string | number }).id
        : valorDaImagem

    if (id === null || id === undefined || id === '') {
      setMidia(null)
      setErro(null)
      return
    }

    let cancelado = false
    setCarregando(true)
    setErro(null)

    fetch(`/api/media/${id}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((doc: Midia) => {
        if (cancelado) return
        setMidia(doc)
      })
      .catch(() => {
        if (cancelado) return
        setErro('Não consegui carregar a imagem para recortar. Salve o banner e recarregue a página.')
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [valorDaImagem])

  // ── Estado do recorte, em % ───────────────────────────────────────────────
  const crop: Crop | undefined = useMemo(() => {
    if (!value) return undefined
    return { unit: '%', x: value.x, y: value.y, width: value.largura, height: value.altura }
  }, [value])

  /**
   * Primeira abertura sem recorte salvo: propõe a maior janela possível na
   * proporção certa, centralizada. É o recorte que a pessoa provavelmente
   * escolheria à mão, e evita a tela abrir com uma janelinha no canto.
   */
  const aoCarregarImagem = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget
      if (value) return

      const { width, height } = e.currentTarget
      const inicial = centerCrop(
        makeAspectCrop({ unit: '%', width: 100 }, proporcao, width, height),
        width,
        height,
      )
      setValue({
        x: inicial.x,
        y: inicial.y,
        largura: inicial.width,
        altura: inicial.height,
      })
    },
    [proporcao, setValue, value],
  )

  const aoMudar = useCallback(
    (_pixels: unknown, emPorcento: Crop) => {
      setValue({
        x: emPorcento.x,
        y: emPorcento.y,
        largura: emPorcento.width,
        altura: emPorcento.height,
      })
    },
    [setValue],
  )

  const limpar = useCallback(() => setValue(null), [setValue])

  // ── Aviso de nitidez ──────────────────────────────────────────────────────
  // Recortar sempre joga pixels fora. Uma arte que já era pequena pode passar a
  // não ter resolução para a tela em que vai aparecer — e nenhum cortador
  // resolve isso, só exportar a arte maior.
  const aviso = useMemo(() => {
    if (!midia?.width || !midia?.height || !value) return null

    const larguraReal = (value.largura / 100) * midia.width
    const alturaReal = (value.altura / 100) * midia.height

    if (larguraReal >= spec.largura * NITIDEZ_MINIMA) return null

    return (
      `O pedaço escolhido tem ${Math.round(larguraReal)} x ${Math.round(alturaReal)} pixels, ` +
      `e o site vai esticá-lo até ${spec.largura} x ${spec.altura}. ` +
      'Vai aparecer borrado. Aumente a janela do recorte ou, melhor, envie uma arte maior — ' +
      `o ideal é a arte inteira já ter ${spec.largura} x ${spec.altura} pixels.`
    )
  }, [midia, value, spec])

  // ── Telas ─────────────────────────────────────────────────────────────────
  if (!valorDaImagem) {
    return (
      <div className="field-type">
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
          Escolha a imagem acima e o recorte aparece aqui.
        </p>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="field-type">
        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem' }}>Carregando a imagem…</p>
      </div>
    )
  }

  if (erro || !midia?.url) {
    return (
      <div className="field-type">
        <p style={{ color: 'var(--theme-error-500)', fontSize: '0.85rem' }}>
          {erro ?? 'Esta imagem não tem arquivo para recortar.'}
        </p>
      </div>
    )
  }

  return (
    <div className="field-type" style={{ marginBottom: '1.5rem' }}>
      <label className="field-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
        Recorte do {spec.contexto} — {spec.proporcao}
      </label>

      <p
        style={{
          color: 'var(--theme-elevation-500)',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          margin: '0 0 0.75rem',
        }}
      >
        Arraste para mover e puxe os cantos para dar zoom. <strong>A proporção é fixa</strong> —
        o que estiver dentro da janela é exatamente o que aparece no site, nem mais nem menos.
      </p>

      <div
        style={{
          maxWidth: 620,
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--theme-elevation-50)',
        }}
      >
        <ReactCrop
          crop={crop}
          onChange={aoMudar}
          aspect={proporcao}
          keepSelection
          minWidth={40}
          ruleOfThirds
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={midia.url}
            alt={midia.alt ?? 'Arte do banner'}
            onLoad={aoCarregarImagem}
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </ReactCrop>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.6rem' }}>
        <button
          type="button"
          onClick={limpar}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--theme-elevation-600)',
            fontSize: '0.8rem',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Recomeçar o recorte
        </button>

        {midia.width && midia.height && (
          <span style={{ color: 'var(--theme-elevation-450)', fontSize: '0.75rem' }}>
            Arte enviada: {midia.width} x {midia.height} px
          </span>
        )}
      </div>

      {aviso && (
        <p
          style={{
            color: 'var(--theme-warning-600, #a86800)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            marginTop: '0.6rem',
          }}
        >
          ⚠️ {aviso}
        </p>
      )}
    </div>
  )
}

/* Dois invólucros porque o Payload referencia componentes por caminho e nome,
   sem passar parâmetros próprios: cada campo aponta para o seu. */

export function RecorteDesktop({ path }: { path: string }) {
  return <RecorteDeBanner path={path} campoDaImagem="image" spec={BANNER_DESKTOP} />
}

export function RecorteMobile({ path }: { path: string }) {
  return <RecorteDeBanner path={path} campoDaImagem="imageMobile" spec={BANNER_MOBILE} />
}
