// Core data shapes for SadBarz. Everything the app saves is built from these.

export type ExerciseKind = 'reps' | 'hold' | 'distance' | 'calories';

export type Category = 'push' | 'pull' | 'legs' | 'core' | 'tubos' | 'cardio' | 'skills';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  category: Category;
  custom?: boolean;
}

// One move inside a block, with its target.
export interface BlockItem {
  id: string;
  exerciseId: string;
  reps?: number;
  seconds?: number;
  meters?: number;
  calories?: number;
  weightKg?: number;
  max?: boolean; // "máximo": as many as possible
  note?: string; // DS, unbroken, explosivas, "resto del minuto: correr"...
}

// A row of the "sets" format: N sets of the same items, then rest.
export interface SetRow {
  id: string;
  sets: number;
  items: BlockItem[]; // 1 item = normal set, 2+ = "Doble" / biserie
  restSec: number;
}

// emom    = every N seconds, X rounds (EMOM, E30", E50", EM2M...)
// tabata  = work / rest, X rounds
// sets    = sets x reps with rest between (pyramids, weighted work)
// circuit = list of moves for X rounds, stopwatch running
export type BlockFormat = 'emom' | 'tabata' | 'sets' | 'circuit';

export interface Block {
  id: string;
  title?: string;
  format: BlockFormat;
  items: BlockItem[]; // emom, tabata, circuit
  rows: SetRow[]; // sets
  intervalSec: number; // emom
  rounds: number; // emom, tabata, circuit
  perRound: 'all' | 'rotate'; // emom/tabata: all items every round, or one item per round in turn
  workSec: number; // tabata
  restSec: number; // tabata
  restAfterSec?: number; // the routine's suggested break after this block
  note?: string;
}

export interface Routine {
  id: string;
  name: string;
  note?: string;
  blocks: Block[];
  example?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type BlockStatus = 'done' | 'skipped';

// What was actually done for one item of a block.
export interface LogEntry {
  exerciseId: string;
  rounds: number; // rounds or sets completed
  reps?: number; // per round / set
  seconds?: number;
  meters?: number;
  calories?: number;
  weightKg?: number;
}

export interface BlockLog {
  blockId: string;
  title: string;
  format: BlockFormat;
  status: BlockStatus;
  durationSec: number;
  entries: LogEntry[];
}

export interface Workout {
  id: string;
  routineId?: string;
  routineName: string;
  totalBlocks?: number;
  startedAt: number;
  finishedAt: number;
  blocks: BlockLog[];
  note?: string;
}

export type Language = 'es' | 'en';

export interface Settings {
  language: Language;
  leadInSec: 0 | 3 | 5 | 10;
  startSound: boolean;
  roundSound: boolean;
  lastBeepsSec: 0 | 3 | 5;
  endSound: boolean;
  vibration: boolean;
  voice: boolean;
  autoStartNext: boolean;
  breakMode: 'ask' | 'fixed';
  fixedBreakSec: number;
  keepAwake: boolean;
  volume: number; // 0..1
}

// ---------- Training profile (onboarding answers) ----------
// The coach builds the weekly plan from these, so keep the values plain and stable.

export type Goal = 'endurance' | 'skills' | 'statics' | 'fitness';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'bar' | 'dips' | 'parallettes' | 'rings' | 'bands' | 'weights' | 'tubes' | 'none';
export type Skill = 'handstand' | 'lsit' | 'frontLever' | 'backLever' | 'planche';
export type Injury = 'shoulder' | 'elbow' | 'wrist' | 'lowerBack' | 'knee' | 'other';

export interface MaxReps {
  pullUps: number;
  dips: number;
  pushUps: number;
  muscleUps: number;
}

export interface Profile {
  version: 1;
  goal: Goal;
  /** From the max reps test, or picked by hand when they don't know their max. */
  level: Level;
  levelSource: 'test' | 'picked';
  maxReps?: MaxReps;
  skills: Skill[];
  equipment: Equipment[];
  /** 0 = Monday … 6 = Sunday. The count is the days per week. */
  trainingDays: number[];
  /** 0 = no time limit. */
  sessionMin: 0 | 30 | 45 | 60 | 90;
  /** First day of the plan, YYYY-MM-DD. */
  startDate: string;
  age: number;
  weightKg: number;
  sex?: 'male' | 'female';
  injuries: Injury[];
  injuryNote?: string;
  reminders: boolean;
  /** HH:MM, local time. */
  reminderTime: string;
  updatedAt: string;
}
