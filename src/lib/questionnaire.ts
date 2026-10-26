// Which questions each plan answers, and the goal questions of the full Pro questionnaire.
import type { GoalDetails, Goal, Lift, Profile, Skill, SkillMove } from '../types';

// Free (and, later, trial) accounts answer only the key questions. Pro answers everything the coach needs.
export const SHORT_STEPS = ['goal', 'level', 'equipment', 'days', 'review'] as const;
export const FULL_STEPS = ['goal', 'level', 'details', 'equipment', 'days', 'session', 'start', 'body', 'injuries', 'reminders', 'review'] as const;
export type Step = (typeof FULL_STEPS)[number];

// Statics: the stages of each move, easiest first. A hold saves the index of the hardest stage held.
export const STATIC_STAGES: Record<Skill, string[]> = {
  handstand: ['wall', 'free'],
  lsit: ['tuck', 'oneLeg', 'full', 'vsit'],
  frontLever: ['tuck', 'advTuck', 'oneLeg', 'straddle', 'full'],
  backLever: ['tuck', 'advTuck', 'oneLeg', 'straddle', 'full'],
  planche: ['tuck', 'advTuck', 'oneLeg', 'straddle', 'full'],
};

export const SKILL_MOVES: SkillMove[] = ['muscleUpBar', 'muscleUpRings', 'wallHandstand', 'freeHandstand', 'hspu', 'lsit', 'pistol', 'dragonFlag', 'humanFlag'];
// Holds are measured in seconds, the rest in reps.
export const HOLD_MOVES: SkillMove[] = ['wallHandstand', 'freeHandstand', 'lsit', 'humanFlag'];
export const LIFTS: Lift[] = ['pullUp', 'dip', 'muscleUp', 'squat'];
export const SKILL_MINUTES = [10, 15, 20, 30];

// The goal questions that need an answer before Continue; the rest are optional numbers.
export function detailsDone(goal: Goal | undefined, details: GoalDetails | undefined): boolean {
  switch (goal) {
    case 'compete':
      return !!details?.compete?.event?.trim() && !!details.compete.date;
    case 'skills':
      return !!details?.skills?.first;
    case 'fitness':
      return !!details?.fitness?.wants.length && !!details.fitness.layoff;
    default:
      return true;
  }
}

/** Has every answer the full Pro questionnaire asks for. */
export function fullProfile(p: Profile): boolean {
  return p.sessionMin != null && !!p.startDate && p.age != null && p.weightKg != null && detailsDone(p.goal, p.details);
}
