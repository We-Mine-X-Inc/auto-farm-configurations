import axios from "axios";
import { Miner } from "wemine-apis";
import { SwitchPoolParams, VerifyOperationsParams } from "./common-types";
import {
  isFanSpeedWithinBounds,
  isHashRateWithinBounds,
  isOutletTempWithinBounds,
} from "./common-funcs";
import {
  MINER_FAN_SPEED_FAILURE_PREFIX,
  MINER_HASHRATE_FAILURE_PREFIX,
  MINER_TEMPERATURE_FAILURE_PREFIX,
  POOL_SWITCHING_FAILURE_PREFIX,
  POOL_VERIFICATION_FAILURE_PREFIX,
} from "./constants";
import { format as prettyFormat } from "pretty-format";
import { constructPoolUser } from "./pool-user";
const { exec } = require("child_process");

export async function verifyBraiinsHashRate(miner: Miner) {
  const minerIP = miner.ipAddress;
  const getSummaryCommand = `echo '{"command":"summary"}' | nc ${minerIP} 4028 | jq .`;
  exec(getSummaryCommand, (error: any, stdout: any, stderr: any) => {
    const minerStats = JSON.parse(stdout);
    const hashRate5Secs = minerStats["MHS 5s"];
    const hashRate15Mins = minerStats["MHS 15m"];
    const hashRateAvg = minerStats["MHS avg"];
    if (
      !(
        isHashRateWithinBounds({
          miner,
          actualHashRate: hashRate5Secs,
        }) &&
        isHashRateWithinBounds({
          miner,
          actualHashRate: hashRate15Mins,
        }) &&
        isHashRateWithinBounds({
          miner,
          actualHashRate: hashRateAvg,
        })
      )
    ) {
      throw Error(`${MINER_HASHRATE_FAILURE_PREFIX}
        HashRate not within the expected bounds: 
          expectedHashRate within miner - ${miner}
          MHS 5s actualHashRate - ${hashRate5Secs}
          MHS 15m actualHashRate - ${hashRate15Mins}
          MHS avg actualHashRate - ${hashRateAvg}.
          Please check miner: ${prettyFormat(miner.ipAddress)}`);
    }
  });
}

export async function verifyBraiinsFanSpeed(miner: Miner) {
  const minerIP = miner.ipAddress;
  const getFanStatsCommand = `echo '{"command":"fans"}' | nc ${minerIP} 4028 | jq .`;
  exec(getFanStatsCommand, (error: any, stdout: any, stderr: any) => {
    const minerFanStats = JSON.parse(stdout)["FANS"];
    const malfunctioningFans = minerFanStats.filter((fanStats: any) => {
      return isFanSpeedWithinBounds({ miner, actualFanSpeed: fanStats["RPM"] });
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

export async function verifyBraiinsTemperature(miner: Miner) {
  const minerIP = miner.ipAddress;
  const getTempStatsCommand = `echo '{"command":"temps"}' | nc ${minerIP} 4028 | jq .`;
  exec(getTempStatsCommand, (error: any, stdout: any, stderr: any) => {
    const minerTempStats = JSON.parse(stdout)["TEMPS"];
    const tempMalfunctioningChips = minerTempStats.filter((tempStats: any) => {
      return isOutletTempWithinBounds({
        miner,
        actualTemperature: tempStats["Chip"],
      });
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

export async function verifyBraiinsPool(params: VerifyOperationsParams) {
  const minerIP = params.miner.ipAddress;
  const getPoolsCommand = `echo '{"command":"pools"}' | nc ${minerIP} 4028 | jq .`;
  exec(getPoolsCommand, (error: any, stdout: any, stderr: any) => {
    if (error) {
      throw Error(`${POOL_VERIFICATION_FAILURE_PREFIX}
      Failed to verify the mining pool for Braiins.
      
      Error msg: ${error}.
      Will reboot the miner and try again.`);
    }

    const poolConfiguration = JSON.parse(stdout)["POOLS"][0];
    const currPoolUser = poolConfiguration["User"];
    const currPoolStatus = poolConfiguration["Status"];
    if (currPoolUser == params.pool.username && currPoolStatus == "Alive") {
      return "Valid Pool Configuration";
    }

    throw Error(`${POOL_VERIFICATION_FAILURE_PREFIX} 
    Failed to verify the mining pool for Braiins.
    Expected: ${{ username: params.pool.username, status: "Alive" }}.
    Active Config: ${{ username: currPoolUser, status: currPoolStatus }}
    Will reboot the miner and try again.`);
  });
}

export async function switchBraiinsPool(
  params: SwitchPoolParams
): Promise<any> {
  return await removePool(params)
    .then(() => verifyNoSetPool(params))
    .then(() => addPool(params))
    .catch((e) => {
      const error = `${POOL_SWITCHING_FAILURE_PREFIX} 
        Failed trying to switch Braiins's Pool: ${prettyFormat(params)}.
        Error msg: ${e}.`;

      return Promise.reject(error);
    });
}

async function verifyNoSetPool(params: SwitchPoolParams) {
  const minerIP = params.miner.ipAddress;
  const getPoolsCommand = `echo '{"command":"pools"}' | nc ${minerIP} 4028 | jq .`;

  exec(getPoolsCommand, (error: any, stdout: any, stderr: any) => {
    const poolConfiguration = JSON.parse(stdout)["POOLS"];
    if (poolConfiguration.length == 0) {
      return "No Pool Is Set";
    }
    throw Error(`A pool configuration is set: 
      ${prettyFormat(poolConfiguration)}`);
  });
}

async function removePool(params: SwitchPoolParams) {
  const minerIP = params.miner.ipAddress;
  const removePoolCommand = `echo '{"command":"removepool","parameter":0}' | nc ${minerIP} 4028 | jq .`;

  exec(removePoolCommand, (error: any, stdout: any, stderr: any) => {
    if (stdout) {
      return stdout;
    }
    if (error || stderr) {
      throw Error(`Failed to remove pool. 
        Error: ${error}.
        Stderr: ${stderr}.`);
    }
  });
}

async function addPool(params: SwitchPoolParams) {
  const minerIP = params.miner.ipAddress;
  const poolUrl = `${params.pool.protocol}://${params.pool.domain}`;
  const poolUsr = constructPoolUser(params);
  const addPoolCommand = `echo '{"command":"addpool","parameter":"${poolUrl},${poolUsr},"}' | nc ${minerIP} 4028 | jq .`;

  exec(addPoolCommand, (error: any, stdout: any, stderr: any) => {
    if (stdout) {
      return stdout;
    }
    if (error || stderr) {
      throw Error(`Failed to remove pool. 
        Error: ${error}.
        Stderr: ${stderr}.`);
    }
  });
}

export async function rebootBraiinsMiner(params: SwitchPoolParams) {
  const minerIP = params.miner.ipAddress;
  const restartGraphQLQuery = {
    query:
      "mutation {\n  bosminer {\n    restart {\n      ... on BosminerError {\n        message\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
    variables: {},
  };
  return await axios(`http://${minerIP}/graphql`, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: restartGraphQLQuery,
  });
}
