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
  /** Alternating blocks: items with the same turn are done together in one round. */
  turn?: number;
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
// amrap   = as many rounds as possible before the time cap runs out
// fortime = the list (or N rounds of it) once, as fast as possible, under a time cap
export type BlockFormat = 'emom' | 'tabata' | 'sets' | 'circuit' | 'amrap' | 'fortime';

export interface Block {
  id: string;
  title?: string;
  format: BlockFormat;
  items: BlockItem[]; // emom, tabata, circuit, amrap
  rows: SetRow[]; // sets
  intervalSec: number; // emom
  rounds: number; // emom, tabata, circuit, fortime
  perRound: 'all' | 'rotate'; // emom/tabata: all items every round, or one item per round in turn
  workSec: number; // tabata
  restSec: number; // tabata
  capSec?: number; // amrap, fortime: time cap
  restAfterSec?: number; // the routine's suggested break after this block
  note?: string;
}

export interface Routine {
  id: string;
  name: string;
  note?: string;
  blocks: Block[];
  example?: boolean;
  /** Added by redeeming a plan code (that code). Like the examples, it doesn't count toward the free limit. */
  fromCode?: string;
  /** For a routine from a code: the plan day it copies, and the plan version it has (so a fixed plan updates it). */
  codeDay?: number;
  codeVersion?: string;
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
  score?: AmrapScore; // amrap
  forTime?: ForTimeScore; // fortime
}

// AMRAP result: full rounds plus the reps done in the unfinished round.
export interface AmrapScore {
  rounds: number;
  reps: number;
}

// For time result: the finish time, or (time cap reached / stopped early) the reps done.
export interface ForTimeScore {
  timeSec?: number; // finished: total time
  reps?: number; // not finished: reps done by the cap
  rounds: number; // full rounds done
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

export type Goal = 'compete' | 'endurance' | 'strength' | 'skills' | 'statics' | 'fitness';
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

// ---------- Pro questionnaire: extra questions for each goal ----------

// Statics: the hardest stage held (index into STATIC_STAGES in lib/questionnaire) and for how long.
export interface StaticHold {
  stage: number;
  sec: number;
}

export type SkillMove = 'muscleUpBar' | 'muscleUpRings' | 'wallHandstand' | 'freeHandstand' | 'hspu' | 'lsit' | 'pistol' | 'dragonFlag' | 'humanFlag';
export type SkillStage = 'far' | 'basics' | 'progressions' | 'sometimes' | 'polish';
export type SkillBlocker = 'strength' | 'technique' | 'fear' | 'mobility' | 'unsure';
export type CompeteFormat = 'fortime' | 'amrap' | 'maxReps' | 'freestyle' | 'unsure';
export type CompeteCategory = 'beginner' | 'intermediate' | 'advanced' | 'elite' | 'other';
export type WeakMove = 'pullUps' | 'dips' | 'pushUps' | 'muscleUps' | 'squats' | 'burpees' | 'handstand' | 'lsit';
export type FitnessWant = 'fatLoss' | 'muscle' | 'mobility' | 'energy' | 'health';
export type Layoff = 'now' | 'lt6m' | 'm6to2y' | 'gt2y' | 'never';
export type OtherSport = 'running' | 'soccer' | 'gym' | 'other' | 'none';
export type DayType = 'sitting' | 'standing' | 'physical';
export type Lift = 'pullUp' | 'dip' | 'muscleUp' | 'squat';

export interface GoalDetails {
  statics?: { holds: Partial<Record<Skill, StaticHold>> };
  endurance?: { squats?: number; pistols?: number; legRaises?: number; hspu?: number };
  // Added weight in kg (squat: total bar weight) and the reps done with it.
  strength?: { lifts: Partial<Record<Lift, { kg: number; reps: number }>> };
  skills?: {
    have: Partial<Record<SkillMove, number>>; // reps, or seconds for holds
    first?: SkillMove;
    second?: SkillMove;
    stage?: SkillStage;
    blocker?: SkillBlocker;
    minutes?: number;
  };
  compete?: {
    event?: string; // one of COMPETITIONS, or what they typed
    date?: string; // YYYY-MM-DD
    category?: CompeteCategory;
    formats: CompeteFormat[];
    pistols?: number;
    lastResult?: string;
    weakest?: WeakMove;
  };
  fitness?: {
    wants: FitnessWant[];
    layoff?: Layoff;
    pushUps?: number;
    squats1min?: number;
    plankSec?: number;
    hangSec?: number;
    sports: OtherSport[];
    day?: DayType;
    targetKg?: number;
  };
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
  // The rest is asked only in the full Pro questionnaire; a free account's profile may not have it.
  /** 0 = no time limit. */
  sessionMin?: 0 | 30 | 45 | 60 | 90;
  /** First day of the plan, YYYY-MM-DD. */
  startDate?: string;
  age?: number;
  weightKg?: number;
  sex?: 'male' | 'female';
  /** Answers to the goal questions, kept per goal so switching back keeps them. */
  details?: GoalDetails;
  injuries: Injury[];
  injuryNote?: string;
  reminders: boolean;
  /** HH:MM, local time. */
  reminderTime: string;
  updatedAt: string;
}

// ---------- Athlete profile: photo and personal records ----------

// reps = most reps in one set, sec = longest hold, kg = most added weight,
// time = fastest finish of a routine or test (lower is better).
export type RecordUnit = 'reps' | 'sec' | 'kg' | 'time';

// A record the athlete writes down by hand (a test day, a competition...).
export interface PersonalRecord {
  id: string;
  name: string; // the move or the test, as shown
  exerciseId?: string; // set when it was picked from the exercise list
  unit: RecordUnit;
  value: number; // reps, seconds or kg
  reps?: number; // kg: lifted for this many reps
  date: string; // YYYY-MM-DD
  note?: string;
  updatedAt: number;
}
