import { logger } from "@logger/logger";
import PoolSwitchScheduler from "./scheduler/pool-switch-scheduler";
import { dbConnection } from "./databases";

logger.info("Starting Auto Farm Configuration Jobs!!!");

async function executeFarmConfigurations() {
  logger.info("Connect to Database!!!");
  await dbConnection.connect();

  logger.info("Start Pool Switch Scheduler!!!");
  await PoolSwitchScheduler.get().startScheduler();
}

executeFarmConfigurations();
