import * as migration_20260511_154534 from './20260511_154534';
import * as migration_20260513_235301 from './20260513_235301';

export const migrations = [
  {
    up: migration_20260511_154534.up,
    down: migration_20260511_154534.down,
    name: '20260511_154534',
  },
  {
    up: migration_20260513_235301.up,
    down: migration_20260513_235301.down,
    name: '20260513_235301'
  },
];
