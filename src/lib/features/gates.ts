/**
 * Feature gates for progressive rollout.
 *
 * Defaults are conservative to avoid changing current production behavior.
 */

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

/**
 * New reimbursement architecture gate:
 * - true: enable standalone reimbursement module (purchase/reimbursement decoupled path)
 * - false: keep legacy purchase-embedded reimbursement flow
 */
export const ENABLE_REIMBURSEMENT_V2 = parseBooleanEnv(
  process.env.ENABLE_REIMBURSEMENT_V2,
  false
);

/**
 * Optional soft rollout gate for UI only.
 * Useful when backend APIs are ready but menu/entry should be controlled separately.
 */
export const ENABLE_REIMBURSEMENT_V2_UI = parseBooleanEnv(
  process.env.ENABLE_REIMBURSEMENT_V2_UI,
  ENABLE_REIMBURSEMENT_V2
);

export const featureGates = Object.freeze({
  reimbursementV2: ENABLE_REIMBURSEMENT_V2,
  reimbursementV2UI: ENABLE_REIMBURSEMENT_V2_UI,
});

export function isReimbursementV2Enabled(): boolean {
  return featureGates.reimbursementV2;
}

export function isReimbursementV2UIEnabled(): boolean {
  return featureGates.reimbursementV2UI;
}

