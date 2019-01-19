const fetch = require('node-fetch');
const Cylon = require('cylon');
require('dotenv').config({ path: process.env.ENV_CONFIG });

if (!process.env.NEST_ACCESS_TOKEN) {
    require('./setup').run();
}
else {
    if (!process.env.MQTT_IP_ADDRESS) {
        console.error('No mqtt server configured, please run yarn setup first.');
        process.exit(1);
    }

    const connections = {
        nest: { adaptor: 'nest', accessToken: process.env.NEST_ACCESS_TOKEN },
        mqtt: { adaptor: 'mqtt', host: `mqtt://${process.env.MQTT_IP_ADDRESS}:${process.env.MQTT_PORT}` }
    };

    fetch('https://developer-api.nest.com', {
        headers: {
            'Cntent-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEST_ACCESS_TOKEN}`,
        }
    }).then((r) => r.json()).then((response) => {
        // console.log(response);

        Cylon.robot({
            name: 'Nest-MQTT Bridge',

            connections,

            devices: getDevicesConfig(response),

            work: function (my) {
                my.home.on('status', (data) => {
                    // console.log('The Nest Home at a glance:', data);
                });

                for (const deviceName of Object.keys(my.devices)) {
                    const device = my.devices[deviceName];

                    if (readHandlers[device.type]) {
                        readHandlers[device.type].call(my, device);
                    }

                    if (writeHandlers[device.type]) {
                        for (const capability of Object.keys(capabilityMap)) {
                            my.mqtt.subscribe(`smartthings/${deviceName}/${capability}/state`);
                        }
                    }
                }

                my.mqtt.on('message', function (topic, data) {
                    // console.log(topic + ": " + data);

                    // 0 - prefix (smartthings)
                    // 1 - Device Name
                    // 2 - Device Capability
                    // 3 - state - suffix
                    const topicParts = topic.split('/');
                    const device = my.devices[topicParts[1]];

                    if (device) {
                        if (writeHandlers[device.type]) {
                            writeHandlers[device.type].call(my, device, topicParts[2], String(data));
                        }
                        else {
                            console.warn(`Write handler not found for device type ${device.type}.`);
                        }
                    }
                    else {
                        console.warn(`Device ${topicParts[1]} was not found.`);
                    }
                });
            }
        }).start();
    });
}

function getDevicesConfig(nestResponse) {
    if (nestResponse.devices) {
        const devices = {};

        if (nestResponse.devices.thermostats) {
            for (const deviceID of Object.keys(nestResponse.devices.thermostats)) {
                const device = nestResponse.devices.thermostats[deviceID];

                devices[device.name] = {
                    driver: 'nest-thermostat',
                    connection: 'nest',
                    deviceId: deviceID,
                };
            }
        }

        if (nestResponse.devices.smoke_co_alarms) {
            for (const deviceID of Object.keys(nestResponse.devices.smoke_co_alarms)) {
                const device = nestResponse.devices.smoke_co_alarms[deviceID];

                devices[device.name] = {
                    driver: 'nest-protect',
                    connection: 'nest',
                    deviceId: deviceID,
                };
            }
        }

        devices.home = {
            driver: 'nest-home',
            connection: 'nest',
            structureId: nestResponse.structures[Object.keys(nestResponse.structures)[0]].structure_id,
        };

        return devices;
    }
    else {
        console.error('No devices returned by Nest API: ', nestResponse);
        process.exit(1);
    }
}

const readHandlers = {
    'Thermostat': function (device) {
        let previousStatus = {};

        const processStatus = (status) => {
            // console.log(status);

            // The keys are Nest props and the values are Smartthings props
            const properties = {
                ambient_temperature_f: {
                    smartThingsProp: 'temperature',
                    message: `Ambient Temperature for ${device.name}: `,
                    units: 'F'
                },
                target_temperature_f: {
                    smartThingsProp: 'heatingSetpoint',
                    message: `Target Heating Temperature for ${device.name}: `,
                    units: 'F'
                },
                humidity: {
                    smartThingsProp: 'humidity',
                    message: `Humidity level for ${device.name}: `,
                    units: '%'
                },
                hvac_mode: {
                    smartThingsProp: 'thermostatMode',
                    message: `HVAC Mode Setting for ${device.name}: `,
                    units: ''
                },
            };
            const nestProps = Object.keys(properties);

            for (const prop of nestProps) {
                if (previousStatus[prop] !== status[prop]) {
                    console.log(`${properties[prop].message}: ${status[prop]}${properties[prop].units}`);
                    this.mqtt.publish(`smartthings/${device.name}/${properties[prop].smartThingsProp}/set_state`, String(status[prop]));

                    previousStatus[prop] = status[prop];
                }
            }

            if (previousStatus.is_online !== status.is_online || previousStatus.hvac_state !== status.hvac_state) {
                const isOnline = status.is_online;
                const hvacState = status.hvac_state;
                if (isOnline) {
                    console.log(`HVAC State for ${device.name}: ${hvacState}`);
                }
                else {
                    console.log(`${device.name} is Offline`);
                }

                this.mqtt.publish(
                    `smartthings/${device.name}/thermostatOperatingState/set_state`,
                    isOnline ? String(hvacState) : 'offline'
                );

                previousStatus.is_online = status.is_online;
                previousStatus.hvac_state = status.hvac_state;
            }
        };

        device.on('status', processStatus);

        every((1).minute(), () => processStatus(device.thermostat));
    },
    'Protect': function (device) {
        device.on('status', function (status) {
            // console.log(`Protect status for ${device.name}`, status);
        });
    }
};

function writeErrorHandler(device, command, value, err) {
    if (err) {
        console.warn(`Error: ${device.type} ${device.name} doesn't know how to handle: ${command} = ${value}`, err);
    }
    else {
        console.log(`${device.type} ${device.name} executed ${command} = ${value} successfully`);
    }
}

const capabilityMap = {
    thermostatMode: {
        nestCommand: 'hvac_mode',
        getValue: (v) => v,
    },
    heatingSetpoint: {
        nestCommand: 'target_temperature_f',
        getValue: (value) => Number(value),
    },
};

const writeHandlers = {
    'Thermostat': function (device, command, value) {
        const cb = (err) => writeErrorHandler(device, command, value, err);

        if (Object.keys(capabilityMap).indexOf(command) !== -1) {
            device.write(capabilityMap[command].nestCommand, capabilityMap[command].getValue(value), cb);
        }
        else {
            console.error(`Unknown command sent to Thermostat ${device.name}: `, command, value);
        }
    },
    'Protect': function (device) {
        device.on('status', function (status) {
            console.log(`Protect status for ${device.name}`, status);
        });
    }
};
