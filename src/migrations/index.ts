import * as migration_20260511_154534 from './20260511_154534';
import * as migration_20260513_235301 from './20260513_235301';
import * as migration_20260520_010721 from './20260520_010721';
import * as migration_20260520_025535 from './20260520_025535';

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
    name: '20260520_025535'
  },
];
