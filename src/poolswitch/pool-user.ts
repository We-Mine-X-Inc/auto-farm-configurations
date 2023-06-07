import { PoolType } from "wemine-apis";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";
import { getPoolWorker } from "./pool-workers";

export function constructPoolUser(
  params: SwitchPoolParams | VerifyOperationsParams
) {
  return `${params.pool.username}${getPoolPaymentMethod(
    params
  )}.${getPoolWorker(params)}`;
}

function getPoolPaymentMethod(
  switchPoolInfo: SwitchPoolParams | VerifyOperationsParams
) {
  switch (switchPoolInfo.pool.poolType) {
    case PoolType.POOL_MARS:
      return "+pps";
    case PoolType.SLUSH_POOL:
    case PoolType.DX_POOL:
      return "";
    default:
      return "";
  }
}
