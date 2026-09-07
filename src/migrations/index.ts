import * as migration_20260511_154534 from './20260511_154534';
import * as migration_20260513_235301 from './20260513_235301';
import * as migration_20260520_010721 from './20260520_010721';
import * as migration_20260520_025535 from './20260520_025535';
import * as migration_20260628_234953 from './20260628_234953';
import * as migration_20260907_155313 from './20260907_155313';
import * as migration_20260907_171110 from './20260907_171110';
import * as migration_20260907_173225 from './20260907_173225';
import * as migration_20260907_180747 from './20260907_180747';
import * as migration_20260907_221118_etapa2_verificacao_email from './20260907_221118_etapa2_verificacao_email';
import * as migration_20260907_224103_etapa5_aceite_de_termos from './20260907_224103_etapa5_aceite_de_termos';

export const migrations = [
  {
    up: migration_20260511_154534.up,
    down: migration_20260511_154534.down,
    name: '20260511_154534',
  },
  {
    up: migration_20260513_235301.up,
    down: migration_20260513_235301.down,
    name: '20260513_235301',
  },
  {
    up: migration_20260520_010721.up,
    down: migration_20260520_010721.down,
    name: '20260520_010721',
  },
  {
    up: migration_20260520_025535.up,
    down: migration_20260520_025535.down,
    name: '20260520_025535',
  },
  {
    up: migration_20260628_234953.up,
    down: migration_20260628_234953.down,
    name: '20260628_234953',
  },
  {
    up: migration_20260907_155313.up,
    down: migration_20260907_155313.down,
    name: '20260907_155313',
  },
  {
    up: migration_20260907_171110.up,
    down: migration_20260907_171110.down,
    name: '20260907_171110',
  },
  {
    up: migration_20260907_173225.up,
    down: migration_20260907_173225.down,
    name: '20260907_173225',
  },
  {
    up: migration_20260907_180747.up,
    down: migration_20260907_180747.down,
    name: '20260907_180747',
  },
  {
    up: migration_20260907_221118_etapa2_verificacao_email.up,
    down: migration_20260907_221118_etapa2_verificacao_email.down,
    name: '20260907_221118_etapa2_verificacao_email',
  },
  {
    up: migration_20260907_224103_etapa5_aceite_de_termos.up,
    down: migration_20260907_224103_etapa5_aceite_de_termos.down,
    name: '20260907_224103_etapa5_aceite_de_termos'
  },
];
