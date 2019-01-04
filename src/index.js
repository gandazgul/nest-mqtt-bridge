const fetch = require('node-fetch');
const Cylon = require('cylon');
require('dotenv').config();

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
                        readHandlers[device.type](device);
                    }

                    if (writeHandlers[device.type]) {
                        my.mqtt.subscribe(`smartthings/${deviceName}/#/state`);
                    }
                }

                my.mqtt.on('message', function (topic, data) {
                    console.log(topic + ": " + data);

                    // 0 - prefix (smartthings)
                    // 1 - Device Name
                    // 2 - Device Capability
                    // 3 - state - suffix
                    const topicParts = topic.split('/');
                    const device = my.devices[topicParts[1]];

                    if (device) {
                        if (writeHandlers[device.type]) {
                            writeHandlers[device.type](device, topicParts[2], String(data));
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
        device.on('status', function (status) {
            // console.log(`Thermostat status for ${device.name}`, status);
        });

        every((1).minute(), function(){
            const tempC = device.ambientTemperatureC();
            const tempF = device.ambientTemperatureF();

            console.log(`Ambient Temperature for ${device.name}: ${tempF}F/${tempC}C`);
        });
    },
    'Protect': function (device) {
        device.on('status', function (status) {
            // console.log(`Protect status for ${device.name}`, status);
        });
    }
};

const writeHandlers = {
    'Thermostat': function (device, command, value) {
        switch (command) {
            case 'thermostatMode':
                device.write('hvac_mode', value, (err, a) => {
                    console.log('hvac_mode', err, a);
                });
                break;
            default:
                console.error(`Unknown command sent to Thermostat ${device.name}: `, command, value);
        }
    },
    'Protect': function (device) {
        device.on('status', function (status) {
            console.log(`Protect status for ${device.name}`, status);
        });
    }
};
