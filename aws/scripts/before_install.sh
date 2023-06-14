#!/bin/bash

# Path is defined in appspec.yml
APP_DIR=auto_farm_configurations
INITIAL_PUSH_LOCATION=/home/$USER/applications/$APP_DIR

# Delete the old temp directory.
if [ -d $INITIAL_PUSH_LOCATION ]; then
    rm -rf $INITIAL_PUSH_LOCATION
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Verify npm is installed.
npm -v
if [ $? -ne 0 ]; then
    echo "npm is not installed."
    exit 1;
fi

# Verify node is installed.
node -v
if [ $? -ne 0 ]; then
    echo "node is not installed."
    exit 1;
fi

# Verify pm2 is installed.
npm list -g | grep pm2
if [ $? -ne 0 ]; then
    echo "PM2 does not exist."
    exit 1;
fi