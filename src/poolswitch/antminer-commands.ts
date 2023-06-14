import { logger } from "@logger/logger";
import AxiosDigestAuth from "@mhoc/axios-digest-auth";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";
import { format as prettyFormat } from "pretty-format";
import { Miner, Pool } from "wemine-apis";

import {
  isFanSpeedWithinBounds,
  isHashRateWithinBounds,
  isInletTempWithinBounds,
  isOutletTempWithinBounds,
} from "./common-funcs";
import {
  MINER_FAN_SPEED_FAILURE_PREFIX,
  MINER_HASHRATE_FAILURE_PREFIX,
  MINER_TEMPERATURE_FAILURE_PREFIX,
  POOL_SWITCHING_FAILURE_PREFIX,
  POOL_VERIFICATION_FAILURE_PREFIX,
} from "./constants";
import { constructPoolUser } from "./pool-user";

const ANTMINER_DEFAULTS = {
  MINER_USERNAME: "root",
  MINER_PWD: "root",
};
const ANTMINER_DIGESTAUTH = new AxiosDigestAuth({
  username: ANTMINER_DEFAULTS.MINER_USERNAME,
  password: ANTMINER_DEFAULTS.MINER_PWD,
});

const EMPTY_POOL_CONFIG = {
  url: "",
  user: "",
  pass: "",
};

type AntminerMinerPoolInfo = {
  url: string;
  user: string;
  pass: string;
};

type PoolValidationInfo = {
  macAddress: string;
};

type MinerValidator = (param: PoolValidationInfo) => SwitchPoolParams;

type PoolConfigInfo = {
  "bitmain-fan-ctrl": boolean;
  "bitmain-fan-pwm": string;
  "freq-level": string;
  "miner-mode": number;
  pools: AntminerMinerPoolInfo[];
};

type AntminerChainInfo = {
  temp_chip: Array<number>;
};

type AntminerFanInfo = {
  fan: Array<number>;
};

async function getSytemInfo(ipAddress: string): Promise<PoolValidationInfo> {
  return await ANTMINER_DIGESTAUTH.request({
    headers: { Accept: "application/json" },
    method: "GET",
    url: `http://${ipAddress}/cgi-bin/get_system_info.cgi`,
  }).then((res) => {
    return { macAddress: res.data["macaddr"] };
  });
}

function verifyMinerIsForClient<
  T extends SwitchPoolParams | VerifyOperationsParams
>(params: T): MinerValidator {
  return (validationInfo: PoolValidationInfo) => {
    if (validationInfo.macAddress != params.miner.macAddress) {
      throw Error("Miner mismatch. The MAC does not match the expected IP.");
    }
    return params;
  };
}

function getMinerConfig(
  params: SwitchPoolParams | VerifyOperationsParams
): () => Promise<PoolConfigInfo> {
  return async () => {
    return await ANTMINER_DIGESTAUTH.request({
      headers: { Accept: "application/json" },
      method: "GET",
      url: `http://${params.miner.ipAddress}/cgi-bin/stats.cgi`,
    }).then((res) => {
      const minerConfig = res.data;
      const pools: AntminerMinerPoolInfo[] = minerConfig["pools"];
      return {
        "bitmain-fan-ctrl": minerConfig["bitmain-fan-ctrl"],
        "bitmain-fan-pwm": minerConfig["bitmain-fan-pwm"],
        "freq-level": minerConfig["bitmain-freq-level"],
        "miner-mode": parseInt(minerConfig["bitmain-work-mode"]),
        pools: pools,
      };
    });
  };
}

function updateMinerConfig(
  switchPoolParams: SwitchPoolParams
): (poolConfig: PoolConfigInfo) => Promise<any> {
  return async (poolConfig: PoolConfigInfo) => {
    const data = buildNewMinerConfig(switchPoolParams, poolConfig);
    logger.info(`Data passed for Bitmain update req: \n${prettyFormat(data)}`);
    return await ANTMINER_DIGESTAUTH.request({
      headers: { Accept: "application/json" },
      method: "POST",
      url: `http://${switchPoolParams.miner.ipAddress}/cgi-bin/set_miner_conf.cgi`,
      data: data,
    });
  };
}

function verifyLivePoolStatus(
  verifyPoolParams: VerifyOperationsParams
): () => Promise<any> {
  return async () => {
    return await ANTMINER_DIGESTAUTH.request({
      headers: { Accept: "application/json" },
      method: "GET",
      url: `http://${verifyPoolParams.miner.ipAddress}/cgi-bin/pools.cgi`,
    }).then((resp: any) => {
      const currentPoolInfo = resp.data["POOLS"][0];
      if (
        !(
          currentPoolInfo.url == constructPoolUrl(verifyPoolParams.pool) &&
          currentPoolInfo.user == constructPoolUser(verifyPoolParams) &&
          currentPoolInfo.status == "Alive" &&
          currentPoolInfo.priority == 0
        )
      ) {
        throw Error(`Bitmain miner pool update has not taken effect.
        Please check miner: ${prettyFormat(verifyPoolParams)}`);
      }
    });
  };
}

export async function rebootAntminerMiner(params: SwitchPoolParams) {
  await ANTMINER_DIGESTAUTH.request({
    headers: { Accept: "application/json" },
    method: "GET",
    url: `http://${params.miner.ipAddress}/cgi-bin/reboot.cgi`,
  });
}

function buildNewMinerConfig(
  switchPoolInfo: SwitchPoolParams,
  poolConfig: PoolConfigInfo
): PoolConfigInfo {
  const newPoolConfig = { ...poolConfig };
  newPoolConfig.pools = [
    {
      url: constructPoolUrl(switchPoolInfo.pool),
      user: constructPoolUser(switchPoolInfo),
      pass: "",
    },
    EMPTY_POOL_CONFIG,
    EMPTY_POOL_CONFIG,
  ];
  return newPoolConfig;
}

function constructPoolUrl(pool: Pool) {
  return `${pool.protocol}://${pool.domain}`;
}

export async function switchAntminerPool(
  params: SwitchPoolParams
): Promise<any> {
  return await getSytemInfo(params.miner.ipAddress)
    .then(verifyMinerIsForClient(params))
    .then(getMinerConfig(params))
    .then(updateMinerConfig(params))
    .catch((e) => {
      const error = `${POOL_SWITCHING_FAILURE_PREFIX}
        Failed trying to switch Antminer's Pool: ${prettyFormat(params)}.
        Error msg: ${e}.`;

      return Promise.reject(error);
    });
}

export async function verifyAntminerPool(
  params: VerifyOperationsParams
): Promise<any> {
  return await getSytemInfo(params.miner.ipAddress)
    .then(verifyMinerIsForClient(params))
    .then(getMinerConfig(params))
    .then(verifyLivePoolStatus(params))
    .then(() => verifyAntminerHashRate(params.miner))
    .catch((e) => {
      const error = `${POOL_VERIFICATION_FAILURE_PREFIX} 
        Failed to verify the mining pool for an Antminer: ${prettyFormat(
          params
        )}.
        Error msg: ${e}.
        Will reboot the miner and try again.`;

      return Promise.reject(error);
    });
}

export async function verifyAntminerHashRate(miner: Miner) {
  return await ANTMINER_DIGESTAUTH.request({
    headers: { Accept: "application/json" },
    method: "GET",
    url: `http://${miner.ipAddress}/cgi-bin/stats.cgi`,
  }).then((res) => {
    const minerStats = res.data["STATS"][0];
    if (
      !(
        isHashRateWithinBounds({
          miner,
          actualHashRate: minerStats["rate_5s"],
        }) &&
        isHashRateWithinBounds({
          miner,
          actualHashRate: minerStats["rate_30m"],
        }) &&
        isHashRateWithinBounds({
          miner,
          actualHashRate: minerStats["rate_avg"],
        })
      )
    ) {
      throw Error(`${MINER_HASHRATE_FAILURE_PREFIX}
      HashRate not within the expected bounds: 
        expectedHashRate within miner - ${miner}
        rate_5s actualHashRate - ${minerStats["rate_5s"]}
        rate_30m actualHashRate - ${minerStats["rate_30m"]}
        rate_avg actualHashRate - ${minerStats["rate_avg"]}.
        Please check miner: ${prettyFormat(miner.ipAddress)}`);
    }
  });
}

export async function verifyAntminerFanSpeed(miner: Miner) {
  return await ANTMINER_DIGESTAUTH.request({
    headers: { Accept: "application/json" },
    method: "GET",
    url: `http://${miner.ipAddress}/cgi-bin/stats.cgi`,
  }).then((res) => {
    const minerFanSpeeds: AntminerFanInfo = res.data["STATS"][0];
    const malfunctioningFans = minerFanSpeeds.fan.filter((fanSpeed) => {
      return isFanSpeedWithinBounds({ miner, actualFanSpeed: fanSpeed });
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

export async function verifyAntminerTemperature(miner: Miner) {
  return await ANTMINER_DIGESTAUTH.request({
    headers: { Accept: "application/json" },
    method: "GET",
    url: `http://${miner.ipAddress}/cgi-bin/stats.cgi`,
  }).then((res) => {
    const minerChains: Array<AntminerChainInfo> = res.data["STATS"][0]["chain"];
    const tempMalfunctioningChips = minerChains.filter((chainStats) => {
      const [inlet1, inlet2, outlet1, outlet2] = chainStats.temp_chip;
      return !(
        isInletTempWithinBounds({ miner, actualTemperature: inlet1 }) &&
        isInletTempWithinBounds({ miner, actualTemperature: inlet2 }) &&
        isOutletTempWithinBounds({ miner, actualTemperature: outlet1 }) &&
        isOutletTempWithinBounds({ miner, actualTemperature: outlet2 })
      );
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
