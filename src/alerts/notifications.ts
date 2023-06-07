import { format as prettyFormat } from "pretty-format";
import {
  SLACK_POOL_SWITCHING_INFO_URL,
  SLACK_POOL_SWITCHING_ERROR_URL,
} from "@/config";
import { VerifyOperationsParams } from "@/poolswitch/common-types";
import { sendNotification } from "wemine-common-utils";

export async function sendSuccessfulSwitchEmail(
  verifyPoolParams: VerifyOperationsParams
) {
  const text = `
    Successfully Switched to Pool
    
    Miner IP: ${verifyPoolParams.miner.ipAddress}.
    Pool Username: ${verifyPoolParams.pool.username}.
    
    Params: ${prettyFormat(verifyPoolParams)}.`;

  await sendInfo(text);
}

export async function sendFailureSwitchEmail({
  verifyPoolParams,
  error,
}: {
  verifyPoolParams: VerifyOperationsParams;
  error: string;
}) {
  const text = `
    Failed to Switch to Pool

    Miner IP: ${verifyPoolParams.miner.ipAddress}.
    Pool Username: ${verifyPoolParams.pool.username}.
    
    Params: ${prettyFormat(verifyPoolParams)}.
      
    ${error}`;

  await sendError(text);
}

async function sendInfo(text: string) {
  if (SLACK_POOL_SWITCHING_INFO_URL) {
    await sendNotification({ url: SLACK_POOL_SWITCHING_INFO_URL, text });
  }
  throw Error("SLACK_POOL_SWITCHING_INFO_URL is not set.");
}

async function sendError(text: string) {
  if (SLACK_POOL_SWITCHING_ERROR_URL) {
    await sendNotification({ url: SLACK_POOL_SWITCHING_ERROR_URL, text });
  }
  throw Error("SLACK_POOL_SWITCHING_ERROR_URL is not set.");
}
