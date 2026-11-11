// Starter exercise library and the example routines (in Uzi's style of training), one per level, new every week.
import type { Block, BlockItem, Exercise, Level, Routine, SetRow } from '../types';

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

// Calisthenics competitions offered as PR names (their record is the finish time).
export const COMPETITIONS = ['Desert Battles', 'Califest', 'Barranca Day', 'Street Battles Guadalajara'];

// ---------- Example routines ----------
// Three examples, one per level, that change every Monday (a cycle of four weeks). Each level keeps its id,
// so a week's routine simply replaces last week's.
export const EXAMPLE_IDS: Record<Level, string> = {
  beginner: 'rt_seed_beginner',
  intermediate: 'rt_seed_intermediate',
  advanced: 'rt_seed_advanced',
};
export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
// The examples before they had levels (one per weekday): replaced by the ones above.
export const OLD_EXAMPLE_IDS = ['rt_seed_lunes_emom50', 'rt_seed_martes_em2m', 'rt_seed_miercoles_pierna', 'rt_seed_jueves_pullpush', 'rt_seed_viernes_full'];

type Day = Pick<Routine, 'name' | 'note' | 'blocks'>;
type Week = () => Record<Level, Day>;

const week1: Week = () => ({
  beginner: {
    name: 'Bases de pull y push',
    note: 'Para construir las primeras dominadas y fondos. Push ups en rodillas si hace falta: lo importante es la técnica.',
    blocks: [
      emom('Australianas + push ups', 60, 10, 'rotate', [it('ex_australian', { reps: 8 }), it('ex_push', { reps: 8 })], 120),
      emom('Dead hang', 60, 6, 'all', [it('ex_dead_hang', { seconds: 20 })], 120),
      emom('Sentadillas + chin isométrico', 60, 8, 'rotate', [it('ex_sentadilla', { reps: 15 }), it('ex_chin_hold', { seconds: 10 })], 120),
      emom('Core', 60, 6, 'all', [it('ex_legraise', { reps: 8 })]),
    ],
  },
  intermediate: {
    name: 'Push y pull en EMOM',
    note: 'Cada minuto alterna ejercicio. Si te sobra mucho tiempo, sube 1 o 2 repeticiones.',
    blocks: [
      emom('Pull ups + fondos', 60, 10, 'rotate', [it('ex_pull', { reps: 6 }), it('ex_fondos', { reps: 12 })], 120),
      emom('Chin ups + push ups', 60, 10, 'rotate', [it('ex_chin', { reps: 6 }), it('ex_push', { reps: 20 })], 120),
      emom('Australianas', 60, 8, 'all', [it('ex_australian', { reps: 12 })], 120),
      emom('Core', 60, 8, 'rotate', [it('ex_legraise', { reps: 10 }), it('ex_lsit', { seconds: 10 })]),
    ],
  },
  advanced: {
    name: 'Lastre push y pull',
    note: 'Cada bloque alterna: ronda con lastre, ronda sin lastre. 2 min de descanso entre bloques.',
    blocks: [
      emom('Fondos', 50, 10, 'rotate', [it('ex_fondos', { reps: 12, weightKg: 30 }), it('ex_fondos', { reps: 30 })], 120),
      emom('Muscle ups', 50, 10, 'rotate', [it('ex_muscle', { reps: 5, weightKg: 10 }), it('ex_muscle', { reps: 8 })], 120),
      emom('Push ups', 50, 10, 'rotate', [it('ex_push', { reps: 20, weightKg: 20 }), it('ex_push', { reps: 30 })], 120),
      emom('Pull ups', 50, 10, 'rotate', [it('ex_pull', { reps: 8, weightKg: 20 }), it('ex_pull', { reps: 15 })]),
    ],
  },
});

const week2: Week = () => ({
  beginner: {
    name: 'Full body en circuito',
    note: 'Tres vueltas a tu ritmo, descansando lo necesario entre ejercicios. Cierra con un tabata.',
    blocks: [
      circuit('Circuito', 3, [it('ex_australian', { reps: 8 }), it('ex_push', { reps: 10 }), it('ex_sentadilla', { reps: 15 }), it('ex_desplantes', { reps: 8 }), it('ex_medio_burpee', { reps: 8 })], 120, 'Descansa lo necesario entre ejercicios.'),
      tabata('Tabata', 20, 10, 8, 'rotate', [it('ex_sentadilla', { max: true }), it('ex_push', { max: true })]),
    ],
  },
  intermediate: {
    name: 'Full body EM2M',
    note: 'EM2M: todo dentro de los 2 minutos, lo que sobre es descanso.',
    blocks: [
      emom('Pull + sentadillas + correr', 120, 6, 'all', [it('ex_pull', { reps: 6 }), it('ex_sentadilla', { reps: 20 }), it('ex_correr', { meters: 200 })], 120),
      emom('Fondos + desplantes + burpees', 120, 6, 'all', [it('ex_fondos', { reps: 12 }), it('ex_desplantes', { reps: 12 }), it('ex_burpees', { reps: 8 })], 120),
      emom('Chin ups + box jumps', 120, 6, 'all', [it('ex_chin', { reps: 6 }), it('ex_boxjump', { reps: 12 })], 120),
      emom('Push + sentadillas explosivas', 120, 6, 'all', [it('ex_push', { reps: 20 }), it('ex_sentadilla_expl', { reps: 12 })]),
    ],
  },
  advanced: {
    name: 'Volumen pull y push',
    note: 'Bloque 1: 3 vueltas, cada ejercicio unbroken. Luego EMOM cada 1:15 cambiando de ejercicio. Cierra corriendo 8 min.',
    blocks: [
      circuit('Calentamiento', 3, [it('ex_australian', { reps: 10 }), it('ex_push', { reps: 15 }), it('ex_pull', { reps: 5 }), it('ex_fondos', { reps: 10 })], 120, 'A tu ritmo, controlando cada repetición.'),
      circuit('Bloque 1', 3, [it('ex_pull', { reps: 10 }), it('ex_fondos', { reps: 20 }), it('ex_muscle', { reps: 5 }), it('ex_push', { reps: 25 }), it('ex_burpees', { reps: 10 })], 180, 'Unbroken cada ejercicio.'),
      emom('EMOM cada 1:15', 75, 12, 'rotate', [it('ex_muscle', { reps: 4 }), it('ex_bardips', { reps: 12 }), it('ex_pull', { reps: 8 })], 120),
      emom('Correr', 480, 1, 'all', [it('ex_correr', { note: '8 min' })]),
    ],
  },
});

const week3: Week = () => ({
  beginner: {
    name: 'Primeras dominadas',
    note: 'Dominadas con liga y negativas para ganar fuerza de jalón. Elige la liga que te deje hacer las 5 con buena técnica.',
    blocks: [
      sets('Dominadas con liga', [row(4, [it('ex_pull', { reps: 5, band: 'green' })], 90)], 120),
      sets('Negativas', [row(3, [it('ex_pull', { reps: 3, note: 'negativas, 5 s de bajada' })], 120)], 120),
      emom('Chin isométrico + australianas', 60, 8, 'rotate', [it('ex_chin_hold', { seconds: 10 }), it('ex_australian', { reps: 8 })], 120),
      sets('Push ups', [row(3, [it('ex_push', { reps: 10 })], 60)]),
    ],
  },
  intermediate: {
    name: 'Fuerza en series',
    note: 'Series con descanso completo: cada repetición limpia, sin balanceo.',
    blocks: [
      sets('Pull ups', [row(4, [it('ex_pull', { reps: 8 })], 120)], 120),
      sets('Fondos', [row(4, [it('ex_fondos', { reps: 12 })], 120)], 120),
      sets('Superserie', [row(3, [it('ex_australian', { reps: 12 }), it('ex_push', { reps: 20 })], 90)], 120),
      sets('Core', [row(3, [it('ex_legraise', { reps: 12 }), it('ex_lsit', { seconds: 15 })], 60)]),
    ],
  },
  advanced: {
    name: 'Fuerza con lastre',
    note: 'Series pesadas: descansa completo entre series y cuida la técnica.',
    blocks: [
      sets('Pull ups con lastre', [row(5, [it('ex_pull', { reps: 5, weightKg: 25 })], 120)], 120),
      sets('Fondos con lastre', [row(5, [it('ex_fondos', { reps: 8, weightKg: 35 })], 120)], 120),
      sets('Muscle ups con lastre', [row(4, [it('ex_muscle', { reps: 4, weightKg: 5 })], 150)], 120),
      sets('Superserie', [row(3, [it('ex_push', { reps: 20, weightKg: 20 }), it('ex_chin', { reps: 10 })], 90)]),
    ],
  },
});

const week4: Week = () => ({
  beginner: {
    name: 'Pierna y core',
    note: 'Pierna sin peso y core. Controla la bajada en cada sentadilla.',
    blocks: [
      tabata('Calentamiento', 20, 10, 8, 'rotate', [it('ex_sentadilla', { reps: 12 }), it('ex_desplantes', { reps: 8 })], 120),
      emom('Sentadillas + step ups', 60, 10, 'rotate', [it('ex_sentadilla', { reps: 15 }), it('ex_stepup', { reps: 10 })], 120),
      emom('Isometría', 60, 6, 'all', [it('ex_sentadilla_iso', { seconds: 20 })], 120),
      emom('Core', 60, 8, 'rotate', [it('ex_legraise', { reps: 8 }), it('ex_lsit', { seconds: 10, note: 'con rodillas dobladas' })]),
    ],
  },
  intermediate: {
    name: 'Circuito de volumen',
    note: 'Cuatro vueltas a ritmo constante. Cierra practicando skills y corriendo 5 min.',
    blocks: [
      circuit('Circuito', 4, [it('ex_pull', { reps: 6 }), it('ex_fondos', { reps: 12 }), it('ex_push', { reps: 20 }), it('ex_sentadilla', { reps: 20 }), it('ex_burpees', { reps: 10 })], 180, 'A tu ritmo, sin parar entre ejercicios si puedes.'),
      emom('Skills', 60, 8, 'rotate', [it('ex_handstand', { seconds: 20, note: 'contra la pared' }), it('ex_dead_hang', { seconds: 30 })], 120),
      emom('Correr', 300, 1, 'all', [it('ex_correr', { note: '5 min' })]),
    ],
  },
  advanced: {
    name: 'Full body con tubos',
    note: 'EMOM de 12 min por bloque: minuto 1 tren superior, minuto 2 pierna o cardio. Cada vuelta son 2 minutos.',
    blocks: [
      emom('Tubo + fondos · sentadillas', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_fondos', { reps: 20 }), it('ex_sentadilla', { reps: 10, weightKg: 20 }), it('ex_sentadilla_expl', { reps: 10 })], 120),
      emom('Tubo + muscle · desplantes', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_muscle', { reps: 5 }), it('ex_desplantes', { reps: 8, weightKg: 10 }), it('ex_desplantes_expl', { reps: 12 })], 120),
      emom('Pull + muscle · burpees', 120, 6, 'all', [it('ex_pull', { reps: 8 }), it('ex_muscle', { reps: 2 }), it('ex_burpees', { reps: 5 }), it('ex_sentadilla_expl', { reps: 10 })], 120),
      emom('Tubo + push · box jumps', 120, 6, 'all', [it('ex_tubo', { reps: 1 }), it('ex_push', { reps: 25 }), it('ex_boxjump', { reps: 15 })]),
    ],
  },
});

const WEEKS = [week1, week2, week3, week4];
// Week 1 of the cycle is the week of Monday 2026-11-09; every Monday moves to the next one.
const FIRST_MONDAY = Date.UTC(2026, 10, 9);

/** The Monday (YYYY-MM-DD, local) of the week `at` falls in: the example week it gets. */
export function exampleMonday(at = Date.now()): string {
  const d = new Date(at);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Which of the example weeks a Monday gets (0-based, cycles through all of them). */
export function exampleWeekIndex(monday: string): number {
  const [y, m, d] = monday.split('-').map(Number);
  const weeks = Math.round((Date.UTC(y, m - 1, d) - FIRST_MONDAY) / (7 * 86_400_000));
  return ((weeks % WEEKS.length) + WEEKS.length) % WEEKS.length;
}

/** This week's examples: beginner, intermediate, advanced. */
export function seedRoutines(at = Date.now()): Routine[] {
  n = 0;
  const now = Date.now();
  const monday = exampleMonday(at);
  const week = WEEKS[exampleWeekIndex(monday)]();
  return LEVELS.map((level) => ({ ...week[level], id: EXAMPLE_IDS[level], level, example: true, exampleWeek: monday, createdAt: now, updatedAt: now }));
}

const exampleIds = new Set<string>([...Object.values(EXAMPLE_IDS), ...OLD_EXAMPLE_IDS]);

/** An example nobody edited that isn't this week's (or is one of the old weekday examples). */
export function isOldExample(r: Routine, monday = exampleMonday()) {
  return !!r.example && r.updatedAt === r.createdAt && r.exampleWeek !== monday && exampleIds.has(r.id);
}
