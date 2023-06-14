#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Parameters to be set before pushing to Github.
USER=ubuntu
VERSION_SUFFIX=1
LAUNCH_ENV=prod
APP_DIR=auto_farm_configurations
SHOULD_START_SERVER=true

# Path is defined in appspec.yml
INITIAL_PUSH_LOCATION=/home/$USER/applications/$APP_DIR
COMPOSITES_DIR=all-composites
COMPOSITES_ENV_DIR=/home/$USER/applications/$COMPOSITES_DIR/$APP_DIR/$VERSION_SUFFIX
CONFIG_LOCATION=/home/$USER/applications/configs/.env.$LAUNCH_ENV.local

# Move initially uploaded content to destination folder.
mkdir -p $COMPOSITES_ENV_DIR
cp -r $INITIAL_PUSH_LOCATION/. $COMPOSITES_ENV_DIR/.

# Copy environment specific config into directory.
cp $CONFIG_LOCATION $COMPOSITES_ENV_DIR


# Move to the composite's directory and run the composite.
if [ "$SHOULD_START_SERVER" = true ] ; then
    cd $COMPOSITES_ENV_DIR
    npm install
    npm run deploy:$LAUNCH_ENV
fi
