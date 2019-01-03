# Nest MQTT bridge

Publishes events from the Nest Thermostat and Protect alarms to MQTT and sets temperature, modes and other inputs based on MQTT topic.

Uses Node.js and Cylon.js, you need to get an Authentication Key and DeviceID from Nest (see CylonJS docs)

## Setup

Clone this repo then run `yarn && yarn setup`. This will guide you though authentication with Nest and getting an auth code.

## Running

Once you have all the configuration in the .env file you can run `yarn start` to start the bridge in daemon mode.
