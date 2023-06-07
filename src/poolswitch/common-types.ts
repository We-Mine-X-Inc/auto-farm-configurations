import { Miner, Pool } from "wemine-apis";

export type SwitchPoolParams = {
  miner: Miner;
  pool: Pool;
};

export type VerifyOperationsParams = {
  miner: Miner;
  pool: Pool;
};
