import { Miner, MinerApiType } from "wemine-apis";
import {
  rebootAntminerMiner,
  switchAntminerPool,
  verifyAntminerFanSpeed,
  verifyAntminerHashRate,
  verifyAntminerPool,
  verifyAntminerTemperature,
} from "./antminer-commands";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";
import {
  rebootGoldshellMiner,
  switchGoldshellPool,
  verifyGoldshellFanSpeed,
  verifyGoldshellHashRate,
  verifyGoldshellPool,
  verifyGoldshellTemperature,
} from "./goldshell-commands";
import { format as prettyFormat } from "pretty-format";
import {
  rebootBraiinsMiner,
  switchBraiinsPool,
  verifyBraiinsFanSpeed,
  verifyBraiinsHashRate,
  verifyBraiinsPool,
  verifyBraiinsTemperature,
} from "./braiins-commands";

export const POOL_SWITCH_FUNCTION: Record<
  MinerApiType,
  (p: SwitchPoolParams) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: switchUnknownPool,
  [MinerApiType.ANTMINER]: switchAntminerPool,
  [MinerApiType.BRAIINS]: switchBraiinsPool,
  [MinerApiType.GOLDSHELL]: switchGoldshellPool,
};

export const POOL_VERIFICATION_FUNCTION: Record<
  MinerApiType,
  (p: VerifyOperationsParams) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: verifyUnknownApiPool,
  [MinerApiType.ANTMINER]: verifyAntminerPool,
  [MinerApiType.BRAIINS]: verifyBraiinsPool,
  [MinerApiType.GOLDSHELL]: verifyGoldshellPool,
};

export const REBOOT_MINER_FUNCTION: Record<
  MinerApiType,
  (p: SwitchPoolParams) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: rebootUnknownMiner,
  [MinerApiType.ANTMINER]: rebootAntminerMiner,
  [MinerApiType.BRAIINS]: rebootBraiinsMiner,
  [MinerApiType.GOLDSHELL]: rebootGoldshellMiner,
};

export const HASHRATE_VERIFICATION_FUNCTION: Record<
  MinerApiType,
  (miner: Miner) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: verifyUnknownMinerHashRate,
  [MinerApiType.ANTMINER]: verifyAntminerHashRate,
  [MinerApiType.BRAIINS]: verifyBraiinsHashRate,
  [MinerApiType.GOLDSHELL]: verifyGoldshellHashRate,
};

export const FAN_SPEED_VERIFICATION_FUNCTION: Record<
  MinerApiType,
  (miner: Miner) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: verifyUnknownMinerFanSpeed,
  [MinerApiType.ANTMINER]: verifyAntminerFanSpeed,
  [MinerApiType.BRAIINS]: verifyBraiinsFanSpeed,
  [MinerApiType.GOLDSHELL]: verifyGoldshellFanSpeed,
};

export const TEMPERATURE_VERIFICATION_FUNCTION: Record<
  MinerApiType,
  (miner: Miner) => Promise<any>
> = {
  [MinerApiType.UNKNOWN]: verifyUnknownMinerTemperature,
  [MinerApiType.ANTMINER]: verifyAntminerTemperature,
  [MinerApiType.BRAIINS]: verifyBraiinsTemperature,
  [MinerApiType.GOLDSHELL]: verifyGoldshellTemperature,
};

async function switchUnknownPool(params: SwitchPoolParams): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(params)}`);
}

async function verifyUnknownApiPool(
  params: VerifyOperationsParams
): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(params)}`);
}

async function rebootUnknownMiner(params: SwitchPoolParams): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(params)}`);
}

async function verifyUnknownMinerHashRate(miner: Miner): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(miner)}`);
}

async function verifyUnknownMinerFanSpeed(miner: Miner): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(miner)}`);
}

async function verifyUnknownMinerTemperature(miner: Miner): Promise<any> {
  throw Error(`Invalid Miner API supplied. Params: ${prettyFormat(miner)}`);
}
