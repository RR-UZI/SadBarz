// Resistance bands for assisted pull ups, dips, muscle ups and other skills.
// The usual colors of the common loop bands, lightest to strongest, with roughly how much
// body weight each one takes off. Brands differ, so the numbers are a guide.
import type { BandColor } from '../types';

export interface Band {
  id: BandColor;
  hex: string;
  kg: [number, number];
  lb: [number, number];
}

export const BANDS: Band[] = [
  { id: 'yellow', hex: '#F5D90A', kg: [2, 7], lb: [5, 15] },
  { id: 'red', hex: '#E5484D', kg: [7, 16], lb: [15, 35] },
  { id: 'black', hex: '#2B2B2B', kg: [11, 29], lb: [25, 65] },
  { id: 'purple', hex: '#8E4EC6', kg: [16, 39], lb: [35, 85] },
  { id: 'green', hex: '#30A46C', kg: [23, 57], lb: [50, 125] },
  { id: 'blue', hex: '#0090FF', kg: [29, 79], lb: [65, 175] },
];

export const bandById = (id?: BandColor) => BANDS.find((b) => b.id === id);

/** "7–16 kg (15–35 lb)": how much weight the band takes off. */
export function bandRange(b: Band) {
  return `${b.kg[0]}–${b.kg[1]} kg (${b.lb[0]}–${b.lb[1]} lb)`;
}
