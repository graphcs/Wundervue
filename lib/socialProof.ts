// Social-proof save counts. Only surface a count once it's meaningful — a lone
// "1 saved" is noise, not proof. Tune the threshold here.
export const SOCIAL_PROOF_MIN = 3;

export function hasSocialProof(saveCount: number | undefined): boolean {
  return (saveCount ?? 0) >= SOCIAL_PROOF_MIN;
}

// "1,234 saved" — comma-grouped, matching the brief ("5,000 saved this").
export function formatSaveCount(saveCount: number): string {
  return saveCount.toLocaleString("en-US");
}
