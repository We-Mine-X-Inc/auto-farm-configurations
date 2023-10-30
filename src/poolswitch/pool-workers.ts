import { PoolPurposeType } from "wemine-apis";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";

export const CLIENT_WORKER_PREFIX = "cl";

export const COMPANY_FEE_WORKER_PREFIX = "co_fee";

export const COMPANY_FULL_TIME_WORKER_PREFIX = "co";

export function getPoolWorker(
  switchPoolInfo: SwitchPoolParams | VerifyOperationsParams
) {
  const purpose = switchPoolInfo.pool.purpose;
  const friendlyPoolId = switchPoolInfo.pool.friendlyPoolId;
  const friendlyMinerId = switchPoolInfo.miner.friendlyMinerId;
  return `${getPoolWorkerPrefix(purpose)}_${friendlyPoolId}_${friendlyMinerId}`;
}

function getPoolWorkerPrefix(purpose: PoolPurposeType) {
  switch (purpose) {
    case PoolPurposeType.CLIENT_REVENUE:
      return CLIENT_WORKER_PREFIX;
    case PoolPurposeType.MINING_FEE:
      return COMPANY_FEE_WORKER_PREFIX;
    case PoolPurposeType.PURE_COMPANY_REVENUE:
      return COMPANY_FULL_TIME_WORKER_PREFIX;
    default:
      return "";
  }
}
