// Starter exercise library and example routines taken from Uzi's own training.
import type { Block, BlockItem, Exercise, Routine, SetRow } from '../types';

export const SEED_EXERCISES: Exercise[] = [
  // Push
  { id: 'ex_fondos', name: 'Fondos', kind: 'reps', category: 'push' },
  { id: 'ex_bardips', name: 'Fondos en barra (bar dips)', kind: 'reps', category: 'push' },
  { id: 'ex_push', name: 'Push ups', kind: 'reps', category: 'push' },
  { id: 'ex_push_cerrada', name: 'Push ups cerradas', kind: 'reps', category: 'push' },
  { id: 'ex_hspu', name: 'Handstand push ups (HSP)', kind: 'reps', category: 'push' },
  { id: 'ex_rompe', name: 'Rompe cráneos', kind: 'reps', category: 'push' },
  // Pull
  { id: 'ex_pull', name: 'Pull ups', kind: 'reps', category: 'pull' },
  { id: 'ex_chin', name: 'Chin ups', kind: 'reps', category: 'pull' },
  { id: 'ex_muscle', name: 'Muscle ups', kind: 'reps', category: 'pull' },
  { id: 'ex_australian', name: 'Australianas', kind: 'reps', category: 'pull' },
  { id: 'ex_chin_hold', name: 'Chin up isométrico', kind: 'hold', category: 'pull' },
  { id: 'ex_dead_hang', name: 'Dead hang', kind: 'hold', category: 'pull' },
  // Tubos
  { id: 'ex_tubo', name: 'Tubo', kind: 'reps', category: 'tubos' },
  { id: 'ex_tubo_recto', name: 'Tubo recto', kind: 'reps', category: 'tubos' },
  { id: 'ex_tubo_inclinado', name: 'Tubo inclinado', kind: 'reps', category: 'tubos' },
  { id: 'ex_chimuela', name: 'Chimuela', kind: 'reps', category: 'tubos' },
  { id: 'ex_cuerda', name: 'Cuerda', kind: 'reps', category: 'tubos' },
  // Legs
  { id: 'ex_sentadilla', name: 'Sentadillas', kind: 'reps', category: 'legs' },
  { id: 'ex_sentadilla_expl', name: 'Sentadillas explosivas', kind: 'reps', category: 'legs' },
  { id: 'ex_sentadilla_iso', name: 'Sentadilla isométrica', kind: 'hold', category: 'legs' },
  { id: 'ex_goblet', name: 'Goblet squat', kind: 'reps', category: 'legs' },
  { id: 'ex_desplantes', name: 'Desplantes (por pierna)', kind: 'reps', category: 'legs' },
  { id: 'ex_desplantes_expl', name: 'Desplantes explosivos', kind: 'reps', category: 'legs' },
  { id: 'ex_bulgaras', name: 'Sentadillas búlgaras (por pierna)', kind: 'reps', category: 'legs' },
  { id: 'ex_stepup', name: 'Step ups explosivos', kind: 'reps', category: 'legs' },
  { id: 'ex_pistol', name: 'Pistol squat', kind: 'reps', category: 'legs' },
  { id: 'ex_boxjump', name: 'Box jumps', kind: 'reps', category: 'legs' },
  // Core
  { id: 'ex_lsit', name: 'L-sit', kind: 'hold', category: 'core' },
  { id: 'ex_t2b', name: 'Toes to bar', kind: 'reps', category: 'core' },
  { id: 'ex_legraise', name: 'Leg raises', kind: 'reps', category: 'core' },
  // Skills
  { id: 'ex_front', name: 'Front lever', kind: 'hold', category: 'skills' },
  { id: 'ex_handstand', name: 'Handstand', kind: 'hold', category: 'skills' },
  { id: 'ex_lsit_hs', name: 'L-sit a handstand', kind: 'reps', category: 'skills' },
  // Cardio
  { id: 'ex_burpees', name: 'Burpees', kind: 'reps', category: 'cardio' },
  { id: 'ex_medio_burpee', name: 'Medios burpees', kind: 'reps', category: 'cardio' },
  { id: 'ex_correr', name: 'Correr', kind: 'distance', category: 'cardio' },
  { id: 'ex_calorias', name: 'Calorías (bici / remo)', kind: 'calories', category: 'cardio' },
];

let n = 0;
const id = (p: string) => `${p}_seed_${++n}`;

function it(exerciseId: string, target: Omit<BlockItem, 'id' | 'exerciseId'> = {}): BlockItem {
  return { id: id('it'), exerciseId, ...target };
}

function emom(title: string, intervalSec: number, rounds: number, perRound: 'all' | 'rotate', items: BlockItem[], restAfterSec?: number, note?: string): Block {
  return { id: id('bl'), title, format: 'emom', items, rows: [], intervalSec, rounds, perRound, workSec: 20, restSec: 10, restAfterSec, note };
}

function tabata(title: string, workSec: number, restSec: number, rounds: number, perRound: 'all' | 'rotate', items: BlockItem[], restAfterSec?: number): Block {
  return { id: id('bl'), title, format: 'tabata', items, rows: [], intervalSec: 60, rounds, perRound, workSec, restSec, restAfterSec };
}

function row(sets: number, items: BlockItem[], restSec: number): SetRow {
  return { id: id('row'), sets, items, restSec };
}

function sets(title: string, rows: SetRow[], restAfterSec?: number, note?: string): Block {
  return { id: id('bl'), title, format: 'sets', items: [], rows, intervalSec: 60, rounds: 1, perRound: 'all', workSec: 20, restSec: 10, restAfterSec, note };
}

function circuit(title: string, rounds: number, items: BlockItem[], restAfterSec?: number, note?: string): Block {
  return { id: id('bl'), title, format: 'circuit', items, rows: [], intervalSec: 60, rounds, perRound: 'all', workSec: 20, restSec: 10, restAfterSec, note };
}

/** The example week, Monday to Friday. Home lists these first, in this order. */
export const WEEK_ROUTINE_IDS = [
  'rt_seed_lunes_emom50',
  'rt_seed_martes_em2m',
  'rt_seed_miercoles_pierna',
  'rt_seed_jueves_pullpush',
  'rt_seed_viernes_full',
];

// One routine per weekday, Monday to Friday, in the order Uzi trains them.
export function seedRoutines(): Routine[] {
  n = 0;
  const now = Date.now();
  const base = { example: true, createdAt: now, updatedAt: now };
  return [
    {
      ...base,
      id: 'rt_seed_lunes_emom50',
      name: 'Lunes · Lastre push y pull',
      note: 'Cada bloque alterna: ronda con lastre, ronda sin lastre. 2 min de descanso entre bloques.',
      blocks: [
        emom('Fondos', 50, 10, 'rotate', [it('ex_fondos', { reps: 12, weightKg: 30 }), it('ex_fondos', { reps: 30 })], 120),
        emom('Muscle ups', 50, 10, 'rotate', [it('ex_muscle', { reps: 5, weightKg: 10 }), it('ex_muscle', { reps: 8 })], 120),
        emom('Push ups', 50, 10, 'rotate', [it('ex_push', { reps: 20, weightKg: 20 }), it('ex_push', { reps: 30 })], 120),
        emom('Pull ups', 50, 10, 'rotate', [it('ex_pull', { reps: 8, weightKg: 20 }), it('ex_pull', { reps: 15 })]),
      ],
    },
    {
      ...base,
      id: 'rt_seed_martes_em2m',
      name: 'Martes · Tubos, reps y cardio',
      note: 'EM2M: todo dentro de los 2 minutos, lo que sobre es descanso.',
      blocks: [
        emom('Tubo + fondos + correr', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_fondos', { reps: 20 }), it('ex_correr', { meters: 200 })], 120),
        emom('Tubo + muscle + burpees', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_muscle', { reps: 5 }), it('ex_burpees', { reps: 10 })], 120),
        emom('Pull + muscle + correr', 120, 6, 'all', [it('ex_pull', { reps: 8 }), it('ex_muscle', { reps: 2 }), it('ex_correr', { meters: 200 })], 120),
        emom('Tubo + push + box jumps', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_push', { reps: 25 }), it('ex_boxjump', { reps: 15 })]),
      ],
    },
    {
      ...base,
      id: 'rt_seed_miercoles_pierna',
      name: 'Miércoles · Pierna y abdomen',
      note: 'Pierna con lastre y explosivos, cierra con abdomen. Es el día de recuperar el tren superior.',
      blocks: [
        tabata('Calentamiento', 20, 5, 12, 'rotate', [it('ex_sentadilla', { reps: 20 }), it('ex_desplantes', { reps: 10 }), it('ex_sentadilla_iso', { seconds: 20 })], 120),
        emom('Sentadillas', 60, 12, 'rotate', [it('ex_sentadilla', { reps: 6, weightKg: 60 }), it('ex_sentadilla_expl', { reps: 20 })], 120),
        emom('Desplantes', 60, 12, 'rotate', [it('ex_desplantes', { reps: 8, weightKg: 15 }), it('ex_desplantes_expl', { reps: 20 })], 120),
        emom('Búlgaras + step ups', 60, 12, 'rotate', [it('ex_bulgaras', { reps: 8, weightKg: 10 }), it('ex_stepup', { reps: 20 })], 120),
        emom('Box jumps + isometría', 60, 12, 'rotate', [it('ex_boxjump', { reps: 20 }), it('ex_sentadilla_iso', { seconds: 30, weightKg: 10 })], 120),
        emom('Abdomen · toes to bar', 60, 10, 'all', [it('ex_t2b', { reps: 8 })], 60),
        emom('Abdomen · leg raises', 60, 8, 'all', [it('ex_legraise', { reps: 12 })], 60),
        emom('Abdomen · toes to bar cruzados', 60, 6, 'all', [it('ex_t2b', { reps: 10, note: 'cruzados' })]),
      ],
    },
    {
      ...base,
      id: 'rt_seed_jueves_pullpush',
      name: 'Jueves · Pull, push y tubo',
      note: 'Primera parte: rondas de volumen, cada ejercicio unbroken. Segunda parte: EMOM cada 1:30. Cierra corriendo 10 min.',
      blocks: [
        circuit('Calentamiento', 3, [it('ex_fondos', { reps: 10 }), it('ex_muscle', { reps: 4 }), it('ex_boxjump', { reps: 10 }), it('ex_pull', { reps: 6 }), it('ex_push', { reps: 10 })], 120, 'A tu ritmo, controlando cada repetición.'),
        circuit('Primera parte · 1', 2, [it('ex_fondos', { reps: 30 }), it('ex_muscle', { reps: 10 }), it('ex_boxjump', { reps: 20 }), it('ex_pull', { reps: 15 }), it('ex_push', { reps: 30 })], 120, 'Unbroken cada ejercicio.'),
        circuit('Primera parte · 2', 2, [it('ex_fondos', { reps: 25 }), it('ex_muscle', { reps: 8 }), it('ex_boxjump', { reps: 20 }), it('ex_pull', { reps: 12 }), it('ex_push', { reps: 25 })], 120, 'Unbroken cada ejercicio.'),
        circuit('Primera parte · 3', 2, [it('ex_fondos', { reps: 20 }), it('ex_muscle', { reps: 6 }), it('ex_boxjump', { reps: 20 }), it('ex_pull', { reps: 10 }), it('ex_push', { reps: 20 })], 180, 'Sin descanso.'),
        emom('Segunda parte', 90, 10, 'all', [it('ex_muscle', { reps: 5 }), it('ex_bardips', { reps: 10 }), it('ex_pull', { reps: 5 }), it('ex_burpees', { reps: 15 })], 120),
        emom('Correr', 600, 1, 'all', [it('ex_correr', { note: '10 min' })]),
      ],
    },
    {
      ...base,
      id: 'rt_seed_viernes_full',
      name: 'Viernes · Full body',
      note: 'EMOM de 12 min por bloque: minuto 1 tren superior, minuto 2 pierna o cardio. Cada vuelta son 2 minutos.',
      blocks: [
        emom('Tubo + fondos · sentadillas', 120, 6, 'all', [
          it('ex_tubo', { reps: 1 }),
          it('ex_fondos', { reps: 20 }),
          it('ex_sentadilla', { reps: 10, weightKg: 20 }),
          it('ex_sentadilla_expl', { reps: 10 }),
        ], 120),
        emom('Tubo + muscle · desplantes', 120, 6, 'all', [
          it('ex_tubo', { reps: 1 }),
          it('ex_muscle', { reps: 5 }),
          it('ex_desplantes', { reps: 8, weightKg: 10 }),
          it('ex_desplantes_expl', { reps: 12 }),
        ], 120),
        emom('Pull + muscle · burpees', 120, 6, 'all', [
          it('ex_pull', { reps: 8 }),
          it('ex_muscle', { reps: 2 }),
          it('ex_burpees', { reps: 5 }),
          it('ex_sentadilla_expl', { reps: 10 }),
        ], 120),
        emom('Tubo + push · box jumps', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_push', { reps: 25 }), it('ex_boxjump', { reps: 15 })]),
      ],
    },
  ];
}
