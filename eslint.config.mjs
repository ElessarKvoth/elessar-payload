import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/*
 * Antes este arquivo usava `FlatCompat.extends('next/core-web-vitals', ...)`,
 * o caminho de compatibilidade para configs no formato ANTIGO (.eslintrc).
 * A partir do eslint-config-next 16 o pacote já publica flat config nativo,
 * exposto nos subpaths `./core-web-vitals` e `./typescript`. Passar por
 * FlatCompat fazia o validador legado do @eslint/eslintrc reprovar a config
 * e, ao montar a mensagem de erro, chamar JSON.stringify num objeto com
 * referência circular (`configs.flat.plugins.react`). O resultado era o
 * "Converting circular structure to JSON": o lint morria antes de checar
 * qualquer arquivo, e o erro real ficava escondido atrás do erro do próprio
 * formatador de mensagem.
 *
 * O elessar-front já usava a forma nativa — por isso o lint dele funcionava.
 */

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },

  globalIgnores([
    // Padrões do próprio eslint-config-next, repetidos porque globalIgnores
    // substitui a lista padrão em vez de somar a ela.
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Gerados pelo Payload — não são código escrito à mão.
    'src/payload-types.ts',
    'src/payload-generated-schema.ts',
    // Idem: `payload migrate:create` gera a assinatura `(payload, req)` e as
    // migrations quase nunca usam os dois, então rendiam 16 avisos de
    // parâmetro não usado que ninguém vai corrigir. Mesma razão das duas
    // linhas acima — decisão nova, porque o lint nunca chegou a rodar antes.
    'src/migrations/**',
  ]),
])

export default eslintConfig
