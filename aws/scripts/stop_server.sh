#!/bin/bash

# Note: This script is run for the server being deployed, as a cleanup. So instead of this being
# used immediately to stop the server currently in production, it will be executed when another
# deployment starts and this deployment needs to be stopped.

LAUNCH_ENV=prod
PM2_APP_NAME=auto_farm_configurations # Defined within ecosystem.config.js

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Verify npm is installed.
npm -v
if [ $? -ne 0 ]; then
    echo "npm is not installed."
    exit 1;
fi

# Delete the job named $PM2_APP_NAME.
npm list -g | grep pm2
if [ $? -eq 0 ]; then
    pm2 delete $PM2_APP_NAME
else
    echo "PM2 does not exist."
    exit 1;
fi


