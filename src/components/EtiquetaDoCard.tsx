'use client'

import { useMemo } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'

import {
  ETIQUETA_NENHUMA,
  PREFIXO_SITUACAO,
  PREFIXO_TEXTO,
  SITUACOES_DO_DISCO,
} from '../collections/situacoesDoDisco'

/* ────────────────────────────────────────────────────────────────────────────
   "Etiqueta no card da loja" — escolhe UMA entre as etiquetas do disco.

   As opções saem do próprio formulário, ao vivo: as situações marcadas
   (Raro, Lacrado…) e as etiquetas digitadas (Gatefold branco…). Marcou uma
   situação ou escreveu uma etiqueta agora? Ela já aparece aqui, sem salvar.

   Um select fixo do Payload não serve: as etiquetas digitadas são texto livre,
   diferentes em cada disco. Por isso o valor é gravado como texto com prefixo
   (ver `situacoesDoDisco.ts`).
   ──────────────────────────────────────────────────────────────────────────── */

interface Opcao {
  valor: string
  rotulo: string
}

export function EtiquetaDoCard({ path }: { path: string }) {
  const { value, setValue } = useField<string | null>({ path })

  const situacoes = useFormFields(([campos]) => campos?.situation?.value) as string[] | null | undefined
  const raro = useFormFields(([campos]) => campos?.isRare?.value) as boolean | null | undefined
  const etiquetas = useFormFields(([campos]) => campos?.etiquetas?.value) as string[] | null | undefined

  const opcoes = useMemo<Opcao[]>(() => {
    const marcadas = new Set(situacoes ?? [])
    if (raro) marcadas.add('rare')

    const deSituacao = SITUACOES_DO_DISCO.filter((s) => marcadas.has(s.value)).map((s) => ({
      valor: `${PREFIXO_SITUACAO}${s.value}`,
      rotulo: s.label,
    }))
    const digitadas = [...new Set((etiquetas ?? []).map((t) => String(t).trim()).filter(Boolean))].map(
      (t) => ({ valor: `${PREFIXO_TEXTO}${t}`, rotulo: t }),
    )
    return [...deSituacao, ...digitadas]
  }, [situacoes, raro, etiquetas])

  // Escolha que não existe mais (situação desmarcada, etiqueta apagada) é
  // mostrada como automático; o servidor limpa o valor ao salvar.
  const atual = value && (value === ETIQUETA_NENHUMA || opcoes.some((o) => o.valor === value)) ? value : ''

  return (
    <div className="field-type" style={{ marginBottom: '1.5rem' }}>
      <label className="field-label" htmlFor={`campo-${path}`} style={{ display: 'block', marginBottom: '0.25rem' }}>
        Etiqueta no card da loja
      </label>

      <select
        id={`campo-${path}`}
        value={atual}
        onChange={(e) => setValue(e.target.value === '' ? null : e.target.value)}
        style={{
          width: '100%',
          maxWidth: '28rem',
          padding: '0.6rem 0.75rem',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 'var(--style-radius-s, 3px)',
          background: 'var(--theme-input-bg, var(--theme-elevation-0))',
          color: 'var(--theme-elevation-800)',
          fontSize: '0.95rem',
        }}
      >
        <option value="">Automático — a loja escolhe</option>
        {opcoes.length > 0 && (
          <optgroup label="Etiquetas deste disco">
            {opcoes.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </optgroup>
        )}
        <option value={ETIQUETA_NENHUMA}>Nenhuma etiqueta no card</option>
      </select>

      <p style={{ color: 'var(--theme-elevation-500)', fontSize: '0.85rem', margin: '0.5rem 0 0', maxWidth: '40rem' }}>
        O card da vitrine tem espaço para <strong>uma</strong> etiqueta; a página do produto mostra todas.
        {opcoes.length === 0
          ? ' Marque uma Situação ou escreva uma etiqueta acima para ela aparecer aqui.'
          : ' A escolhida aparece sempre no card.'}{' '}
        No automático, o card mostra estoque baixo, mais vendido, a situação mais importante ou
        &quot;lançamento&quot;, nessa ordem.
      </p>
    </div>
  )
}
