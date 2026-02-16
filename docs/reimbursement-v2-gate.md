# Reimbursement V2 Gate

This project uses feature gates to rollout the new reimbursement architecture safely.

## Env vars

- `ENABLE_REIMBURSEMENT_V2`
  - `0`/`false` (default): keep current purchase-embedded reimbursement flow.
  - `1`/`true`: switch to standalone reimbursement flow (purchase no longer handles reimbursement submission).

- `ENABLE_REIMBURSEMENT_V2_UI`
  - Optional UI-only gate.
  - Defaults to `ENABLE_REIMBURSEMENT_V2`.

## Current behavior

When `ENABLE_REIMBURSEMENT_V2=1`:

1. Purchase action `submit_reimbursement` is blocked at API level.
2. API returns: `当前已启用独立报销，请前往“报销中心”发起报销申请`.

## Code location

- Gate definitions: `src/lib/features/gates.ts`
- Purchase workflow gate hook: `src/app/api/purchases/[id]/workflow-handler.ts`

