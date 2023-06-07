import { createLogger } from "wemine-common-utils";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { LOG_DIR, NODE_ENV } from "@/config";

const logDir: string = join(__dirname, LOG_DIR || "");

if (!existsSync(logDir)) {
  mkdirSync(logDir);
}

const logger = createLogger({ logDir, envName: NODE_ENV || "dev" });

export { logger };
