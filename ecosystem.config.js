/**
 * @description pm2 configuration file.
 * @example
 *  pm2 start ecosystem.config.js --only auto_farm_configurations
 */
module.exports = {
  apps: [
    {
      name: "auto_farm_configurations", // pm2 start App name
      script: "./dist/app.js", // node
      exec_mode: "cluster", // 'cluster' or 'fork'
      instance_var: "INSTANCE_ID", // instance variable
      instances: 1, // pm2 instance count
      autorestart: true, // auto restart if process crash
      watch: false, // files change automatic restart
      ignore_watch: ["node_modules", "logs"], // ignore files change
      max_memory_restart: "5G", // restart if process use more than 5G memory
      merge_logs: true, // if true, stdout and stderr will be merged and sent to pm2 log
      output: "./logs/pm2/access.log", // pm2 log file
      error: "./logs/pm2/error.log", // pm2 error log file
      env: {
        // environment variable that must be loaded before .env.* file ingestion.
        NODE_ENV: "prod",
      },
    },
  ],
};
