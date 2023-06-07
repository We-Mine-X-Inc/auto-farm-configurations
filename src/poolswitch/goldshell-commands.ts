import axios from "axios";
import { logger } from "@logger/logger";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";
import { format as prettyFormat } from "pretty-format";
import { Miner, Pool } from "wemine-apis";
import {
  isFanSpeedWithinBounds,
  isHashRateWithinBounds,
  isOutletTempWithinBounds,
} from "./common-funcs";
import { assertInventoryItem } from "wemine-apis";
import {
  MINER_FAN_SPEED_FAILURE_PREFIX,
  MINER_HASHRATE_FAILURE_PREFIX,
  MINER_TEMPERATURE_FAILURE_PREFIX,
  POOL_SWITCHING_FAILURE_PREFIX,
  POOL_VERIFICATION_FAILURE_PREFIX,
} from "./constants";
import { constructPoolUser } from "./pool-user";

const NUMBERS_ONLY_REGEX = /\d+/g;

const GOLDSHELL_DEFAULTS = {
  POOL_PWD: "123",
  MINER_USERNAME: "admin",
  MINER_PWD: "123456789",
};

type SessionInfo = {
  ipAddress: string;
  authToken: string;
};

type GoldshellMinerPoolInfo = {
  url: string;
  active: boolean;
  dragid: number;
  user: string;
  "pool-priority": number;
  pass: string;
  legal: boolean;
};

type PoolValidationInfo = {
  sessionInfo: SessionInfo;
  macAddress: string;
};

type MinerValidator = (param: PoolValidationInfo) => SessionInfo;

type ApplyPoolSwitchInfo = {
  sessionInfo: SessionInfo;
  pools: GoldshellMinerPoolInfo[];
};

async function loginToMiner(ipAddress: string): Promise<SessionInfo> {
  return await axios({
    method: "get",
    url: `http://${ipAddress}/user/login?username=${GOLDSHELL_DEFAULTS.MINER_USERNAME}&password=${GOLDSHELL_DEFAULTS.MINER_PWD}`,
  }).then((res: any) => {
    return { ipAddress: ipAddress, authToken: res.data["JWT Token"] };
  });
}

async function getSettings(
  sessionInfo: SessionInfo
): Promise<PoolValidationInfo> {
  return await axios({
    method: "get",
    url: `http://${sessionInfo.ipAddress}/mcb/setting`,
    headers: getRequestHeaders(sessionInfo.authToken),
  }).then((res) => {
    return {
      sessionInfo: sessionInfo,
      macAddress: res.data.name,
    };
  });
}

function verifyMinerIsForClient<
  T extends SwitchPoolParams | VerifyOperationsParams
>(params: T): MinerValidator {
  return (validationInfo: PoolValidationInfo) => {
    if (validationInfo.macAddress != params.miner.macAddress) {
      throw Error("Miner mismatch. The MAC does not match the expected IP.");
    }
    return validationInfo.sessionInfo;
  };
}

async function getPools(
  sessionInfo: SessionInfo
): Promise<ApplyPoolSwitchInfo> {
  return await axios({
    method: "get",
    url: `http://${sessionInfo.ipAddress}/mcb/pools`,
    headers: getRequestHeaders(sessionInfo.authToken),
  }).then((res) => {
    return {
      sessionInfo: sessionInfo,
      pools: res.data,
    };
  });
}

async function deletePools(
  poolSwitchInfo: ApplyPoolSwitchInfo
): Promise<SessionInfo> {
  const sessionInfo = poolSwitchInfo.sessionInfo;
  if (poolSwitchInfo.pools.length <= 0) {
    return new Promise((resolve) => {
      resolve(sessionInfo);
    });
  }
  return Promise.all(
    poolSwitchInfo.pools.map((pool) => {
      return axios({
        method: "put",
        url: `http://${sessionInfo.ipAddress}/mcb/delpool`,
        headers: getRequestHeaders(sessionInfo.authToken),
        data: pool,
      });
    })
  ).then(() => {
    return sessionInfo;
  });
}

function addPool(switchPoolParams: SwitchPoolParams) {
  return async (sessionInfo: SessionInfo): Promise<SessionInfo> => {
    const data = buildNewPool(switchPoolParams);
    logger.info(`Data passed for Goldshell add req: \n${prettyFormat(data)}`);
    return await axios({
      method: "put",
      url: `http://${sessionInfo.ipAddress}/mcb/newpool`,
      headers: getRequestHeaders(sessionInfo.authToken),
      data: buildNewPool(switchPoolParams),
    }).then(() => {
      return sessionInfo;
    });
  };
}

export async function rebootGoldshellMiner(params: SwitchPoolParams) {
  const sessionInfo = await loginToMiner(params.miner.ipAddress);
  return await axios({
    method: "get",
    url: `http://${sessionInfo.ipAddress}/mcb/restart`,
    headers: getRequestHeaders(sessionInfo.authToken),
  });
}

function buildNewPool(
  switchPoolParams: SwitchPoolParams
): GoldshellMinerPoolInfo {
  return {
    legal: true,
    url: constructPoolUrl(switchPoolParams.pool),
    user: constructPoolUser(switchPoolParams),
    pass: GOLDSHELL_DEFAULTS.POOL_PWD,
    dragid: 0,
    active: false,
    "pool-priority": 0,
  };
}

function constructPoolUrl(pool: Pool) {
  return `${pool.protocol}://${pool.domain}`;
}

export async function switchGoldshellPool(
  params: SwitchPoolParams
): Promise<any> {
  return await loginToMiner(params.miner.ipAddress)
    .then(getSettings)
    .then(verifyMinerIsForClient(params))
    .then(getPools)
    .then(deletePools)
    .then(addPool(params))
    .catch((e) => {
      const error = `${POOL_SWITCHING_FAILURE_PREFIX} 
        Failed trying to switch Goldshell's Pool: ${prettyFormat(params)}.
        Error msg: ${e}.`;

      return Promise.reject(error);
    });
}

export async function verifyGoldshellPool(
  params: VerifyOperationsParams
): Promise<any> {
  return await loginToMiner(params.miner.ipAddress)
    .then(getSettings)
    .then(verifyMinerIsForClient(params))
    .then(verifyLivePoolStatus(params))
    .then(() => verifyGoldshellHashRate(params.miner))
    .catch((e) => {
      const error = `${POOL_VERIFICATION_FAILURE_PREFIX} 
        Failed to verify the mining pool for an Goldshell: ${prettyFormat(
          params
        )}.
        Error msg: ${e}.
        Will reboot the miner and try again.`;

      return Promise.reject(error);
    });
}

function verifyLivePoolStatus(verifyPoolParams: VerifyOperationsParams) {
  return async (sessionInfo: SessionInfo) => {
    return await axios({
      method: "get",
      url: `http://${sessionInfo.ipAddress}/mcb/pools`,
      headers: getRequestHeaders(sessionInfo.authToken),
    }).then((res) => {
      const currentPoolInfo = res.data[0];
      if (
        !(
          currentPoolInfo.url == constructPoolUrl(verifyPoolParams.pool) &&
          currentPoolInfo.user == constructPoolUser(verifyPoolParams) &&
          currentPoolInfo.active &&
          currentPoolInfo["pool-priority"] == 0
        )
      ) {
        throw Error(`Goldshell miner pool update has not taken effect.
        Please check miner: ${prettyFormat(verifyPoolParams)}`);
      }
    });
  };
}

export async function verifyGoldshellHashRate(miner: Miner) {
  const { ipAddress, authToken } = await loginToMiner(miner.ipAddress);

  return await axios({
    method: "get",
    url: `http://${ipAddress}/mcb/cgminer?cgminercmd=devs`,
    headers: getRequestHeaders(authToken),
  }).then((res) => {
    const chipStats = res.data["data"];
    const chipHashRates = chipStats.map(
      (chipStat: any) => chipStat["hashrate"]
    );
    const actualHashRate = chipHashRates.reduce(
      (partialSum: number, a: number) => partialSum + a,
      0
    );
    if (
      !isHashRateWithinBounds({
        miner,
        actualHashRate,
      })
    ) {
      const inventoryItem = miner.inventoryItem;
      assertInventoryItem(inventoryItem);

      const expectedHashRateRange =
        inventoryItem.operationalMetadata?.minerMetadata?.expectedHashRateRange;

      throw Error(`${MINER_HASHRATE_FAILURE_PREFIX} 
      HashRate not within the expected bounds: 
        miner --> ${miner}
        expectedHashRate --> ${expectedHashRateRange}
        actualHashRate -> ${actualHashRate}.
        Please check miner: ${prettyFormat(ipAddress)}`);
    }
  });
}

export async function verifyGoldshellFanSpeed(miner: Miner) {
  const { ipAddress, authToken } = await loginToMiner(miner.ipAddress);

  return await axios({
    method: "get",
    url: `http://${ipAddress}/mcb/cgminer?cgminercmd=devs`,
    headers: getRequestHeaders(authToken),
  }).then((res) => {
    const chipStats = res.data["data"];
    const minerFanSpeeds = chipStats.flatMap((chipStat: any) =>
      chipStat["fanspeed"].match(NUMBERS_ONLY_REGEX)
    );
    const malfunctioningFans = minerFanSpeeds.filter((fanSpeed: number) => {
      return !isFanSpeedWithinBounds({ miner, actualFanSpeed: fanSpeed });
    });

    if (malfunctioningFans.length > 0) {
      throw Error(`${MINER_FAN_SPEED_FAILURE_PREFIX}
      Fan speeds are concerning and not within the expected bounds: 
        expectedTemperature within miner - ${miner}
        malfunctioning fan speeds: ${malfunctioningFans}. 
        Please check miner: ${prettyFormat(miner.ipAddress)}`);
    }
  });
}

export async function verifyGoldshellTemperature(miner: Miner) {
  const { ipAddress, authToken } = await loginToMiner(miner.ipAddress);

  return await axios({
    method: "get",
    url: `http://${ipAddress}/mcb/cgminer?cgminercmd=devs`,
    headers: getRequestHeaders(authToken),
  }).then((res) => {
    const chipStats = res.data["data"];
    const chipTemps = chipStats.map((chipStats: any) =>
      chipStats["temp"].match(NUMBERS_ONLY_REGEX)
    );
    const tempMalfunctioningChips = chipTemps.filter((chipTemp: number) => {
      return !isOutletTempWithinBounds({ miner, actualTemperature: chipTemp });
    });
    if (tempMalfunctioningChips.length > 0) {
      throw Error(`${MINER_TEMPERATURE_FAILURE_PREFIX}
      Temperatures are concerning and not within the expected bounds: 
        expectedTemperature within miner - ${miner}
        malfunctioning chip temperatures: ${tempMalfunctioningChips}. 
        Please check miner: ${prettyFormat(miner.ipAddress)}`);
    }
  });
}

function getRequestHeaders(authToken: string) {
  return {
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Connection: "keep-alive",
  };
}
