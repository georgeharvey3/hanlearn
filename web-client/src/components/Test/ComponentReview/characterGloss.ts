/** The dictionary answer for a single character. */
export interface CharacterGloss {
  pinyins: string[];
  meanings: string[];
  /** True when the lookup failed, as opposed to finding nothing. */
  failed?: boolean;
}
