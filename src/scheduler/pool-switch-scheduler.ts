import { Agenda } from "@hokify/agenda";
import { dbConnection } from "@databases";
import {
  AGENDA_MAX_OVERALL_CONCURRENCY,
  AGENDA_MAX_SINGLE_JOB_CONCURRENCY,
} from "@config";
import { Types } from "mongoose";
import { PoolPurposeType } from "wemine-apis";
import { ContractService, MinerService, PoolService } from "wemine-farm-be";
import { agendaSchedulerManager } from "wemine-common-utils";
import {
  POOL_SWITCH_FUNCTION,
  POOL_VERIFICATION_FUNCTION,
  REBOOT_MINER_FUNCTION,
} from "@/poolswitch/maps-of-miner-commands";
import {
  sendFailureSwitchEmail,
  sendSuccessfulSwitchEmail,
} from "@alerts/notifications";
import { ONE_HOUR_IN_MILLIS, TEN_MINS_IN_MILLIS } from "@constants/time";
import { logger } from "@logger/logger";

const JOB_NAMES = {
  SWITCH_POOL: "Switch Pool",
  VERIFY_POOL_SWITCH: "Verify Pool Switch",
};

type PoolSwitchingOptions = {
  activePoolStateIndex: number;
};

type PoolSwitchJobData = PoolSwitchingOptions & {
  contractId: Types.ObjectId;
  minerId: Types.ObjectId;
  previousJobId?: Types.ObjectId;
  isCompanyPool: boolean;
  isContractCompleted: boolean;
  successfulSwitches: number;
  failedSwitches: number;
  currentSwitchCount: number;
  attemptCount?: number;
};

type VerifyPoolSwitchJobData = PoolSwitchJobData & {
  attemptCount: number;
};

let poolSwitchScheduler: PoolSwitchScheduler;

class PoolSwitchScheduler {
  private contractService: ContractService = new ContractService();
  private minerService: MinerService = new MinerService();
  private poolService: PoolService = new PoolService();
  private scheduler: Agenda = agendaSchedulerManager.create({
    maxConcurrency: AGENDA_MAX_OVERALL_CONCURRENCY,
    defaultConcurrency: AGENDA_MAX_SINGLE_JOB_CONCURRENCY,
    db: { address: dbConnection.url, collection: "poolSwitchJobs" },
  });
  private isSchedulerStarted: boolean = false;

  static get(): PoolSwitchScheduler {
    if (poolSwitchScheduler) {
      return poolSwitchScheduler;
    }
    poolSwitchScheduler = new PoolSwitchScheduler();
    return poolSwitchScheduler;
  }

  private constructor() {
    this.loadTasksDefinitions();
  }

  /**
   * Loads all of the task definitions needed for pool switching operations.
   */
  private loadTasksDefinitions() {
    this.loadSwitchPoolTask();
    this.loadVerifyPoolSwitchTask();
  }

  private loadSwitchPoolTask() {
    this.scheduler.define(JOB_NAMES.SWITCH_POOL, async (job) => {
      const jobData: PoolSwitchJobData = job.attrs.data;

      const miner = await this.minerService.findMinerById(jobData.minerId);
      await this.minerService.updateMiner({
        minerId: miner._id,
        status: { ...miner.status, poolIsBeingSwitched: true },
      });

      const contract = await this.contractService.findContractById(
        jobData.contractId
      );
      const hostingContract = contract.hostingContract;
      if (!hostingContract) {
        return Promise.reject("There's no contract to use for switching.");
      }

      // Switch to company revenue pool if contract completed.
      const isContractCompleted =
        hostingContract.contractDuration.endDateInMillis <= Date.now();
      const pool = await this.poolService.findPoolById(
        isContractCompleted
          ? hostingContract.finalCompanyPool._id
          : hostingContract.poolMiningOptions[jobData.activePoolStateIndex].pool
              ._id
      );

      const poolSwitchFunction = POOL_SWITCH_FUNCTION[miner.API];
      const switchPoolParams = { miner, pool };
      await poolSwitchFunction(switchPoolParams)
        .catch((error) => {
          logger.error(error);
          sendFailureSwitchEmail({ verifyPoolParams: switchPoolParams, error });
        })
        .finally(async () => {
          await this.minerService.updateMiner({
            minerId: miner._id,
            status: { ...miner.status, poolIsBeingSwitched: false },
          });

          const newlyExpectedPoolIndex =
            (jobData.attemptCount
              ? jobData.activePoolStateIndex
              : jobData.activePoolStateIndex + 1) %
            hostingContract.poolMiningOptions.length;
          await this.contractService.updateContract({
            contractId: contract._id,
            poolActivity: {
              expectedActivePoolIndex: newlyExpectedPoolIndex,
            },
          });
          const attemptCount = jobData.attemptCount ?? 1;
          const elapsedTimeBeforeVerifying = new Date(
            Date.now() + this.getTimeToWaitBeforeVerifyPoolSwitch(attemptCount)
          );
          const updatedJobData = {
            ...jobData,
            attemptCount,
            isContractCompleted,
            previousJobId: job.attrs._id,
            isCompanyPool:
              pool.purpose == PoolPurposeType.MINING_FEE ||
              pool.purpose == PoolPurposeType.PURE_COMPANY_REVENUE,
          };
          return this.scheduler.schedule(
            elapsedTimeBeforeVerifying,
            JOB_NAMES.VERIFY_POOL_SWITCH,
            updatedJobData
          );
        });
    });
  }

  private loadVerifyPoolSwitchTask() {
    this.scheduler.define(JOB_NAMES.VERIFY_POOL_SWITCH, async (job) => {
      const jobData: VerifyPoolSwitchJobData = job.attrs.data;
      const miner = await this.minerService.findMinerById(jobData.minerId);
      const contract = await this.contractService.findContractById(
        jobData.contractId
      );
      const hostingContract = contract.hostingContract;
      if (!hostingContract) {
        return Promise.reject("There's no contract to use for switching.");
      }
      const pool = await this.poolService.findPoolById(
        hostingContract.poolMiningOptions[jobData.activePoolStateIndex].pool._id
      );

      const poolVerificationFunction = POOL_VERIFICATION_FUNCTION[miner.API];
      const rebootMinerFunction = REBOOT_MINER_FUNCTION[miner.API];
      const verifyPoolParams = { miner, pool };

      await poolVerificationFunction(verifyPoolParams)
        .then(async () => {
          sendSuccessfulSwitchEmail(verifyPoolParams);

          if (jobData.isContractCompleted) {
            return Promise.resolve();
          }

          const elapsedTimeBeforeSwitching = new Date(
            Date.now() +
              hostingContract.poolMiningOptions[jobData.activePoolStateIndex]
                .miningDurationInMillis
          );
          const updatedJobData = {
            ...jobData,
            activePoolStateIndex:
              (jobData.activePoolStateIndex + 1) %
              hostingContract.poolMiningOptions.length,
            previousJobId: job.attrs._id,
            successfulSwitches: jobData.successfulSwitches + 1,
            currentSwitchCount: jobData.currentSwitchCount + 1,
            attemptCount: undefined,
          };
          return this.scheduler.schedule(
            elapsedTimeBeforeSwitching,
            JOB_NAMES.SWITCH_POOL,
            updatedJobData
          );
        })
        .catch((error) => {
          logger.error(error);
          sendFailureSwitchEmail({ verifyPoolParams, error });

          const attemptCount = jobData.attemptCount;
          const elapsedTimeBeforeVerifying = new Date(
            Date.now() + this.getTimeToWaitBeforeVerifyPoolSwitch(attemptCount)
          );
          const updatedJobData = {
            ...jobData,
            attemptCount,
            previousJobId: job.attrs._id,
            failedSwitches: jobData.failedSwitches + 1,
          };

          return rebootMinerFunction({ miner, pool }).finally(() => {
            this.scheduler.schedule(
              elapsedTimeBeforeVerifying,
              JOB_NAMES.SWITCH_POOL,
              updatedJobData
            );
          });
        });
    });
  }

  private getTimeToWaitBeforeVerifyPoolSwitch(attemptCount: number) {
    return Math.min(attemptCount * TEN_MINS_IN_MILLIS, ONE_HOUR_IN_MILLIS);
  }

  public async startScheduler() {
    if (this.isSchedulerStarted) {
      return;
    }

    await this.scheduler.start();
    this.isSchedulerStarted = true;
  }
}

export default PoolSwitchScheduler;
