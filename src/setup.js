const dotenv = require('dotenv');
const inquirer = require('inquirer');
const rootDir = path.resolve('.');
const dotEnvFile = path.join(rootDir, '.env');

if (!fs.existsSync(dotEnvFile)) {
    fs.copyFileSync(path.join(rootDir, '.env.example'), dotEnvFile);
}

dotenv.config();

module.exports = {};

module.exports.run = function() {
    let configFile = [];

    inquirer
        .prompt([
            {
                type: 'confirm',
                name: 'setupStart',
                message: "No config found. Do you want to run the setup wizard?",
                default: true,
            }
        ])
        .then((answer) => {
            if (answer.setupStart) {
                inquirer
                    .prompt([
                        {
                            type: 'input',
                            name: 'MQTT_IP_ADDRESS',
                            message: "What is the host or ip address of your MQTT broker?",
                            default: process.env.MQTT_IP_ADDRESS,
                        },
                        {
                            type: 'input',
                            name: 'MQTT_PORT',
                            message: "What is the port of your MQTT broker?",
                            default: process.env.MQTT_PORT || 1883,
                        },
                        {
                            type: 'input',
                            name: 'NEST_CLIENT_ID',
                            message: "What is the Nest Client ID? (Get a client ID by registering a new app at: https://developers.nest.com)",
                            default: process.env.NEST_CLIENT_ID,
                        },
                        {
                            type: 'input',
                            name: 'NEST_CLIENT_SECRET',
                            message: "What is the Nest Client Secret?",
                            default: process.env.NEST_CLIENT_SECRET,
                        }
                    ])
                    .then((firstAnswers) => {
                        // write config file
                        configFile = configFile.concat([
                            `MQTT_IP_ADDRESS=${firstAnswers.MQTT_IP_ADDRESS}`,
                            `MQTT_PORT=${firstAnswers.MQTT_PORT}`,
                            `NEST_CLIENT_ID=${firstAnswers.NEST_CLIENT_ID}`,
                            `NEST_CLIENT_SECRET=${firstAnswers.NEST_CLIENT_SECRET}`,
                        ]);

                        fs.writeFileSync(dotEnvFile, configFile.join('\n'));

                        const pincodeURL = `https://home.nest.com/login/oauth2?client_id=${firstAnswers.NEST_CLIENT_ID}&state=STATE`;

                        inquirer
                            .prompt([
                                {
                                    type: 'input',
                                    name: 'NEST_PIN_CODE',
                                    message: `Please visit ${pincodeURL} and enter here the PIN Code you receive: `,
                                    default: process.env.NEST_PIN_CODE,
                                }
                            ])
                            .then((nestPin) => {
                                // write config file
                                configFile = configFile.concat([
                                    `NEST_PIN_CODE=${nestPin.NEST_PIN_CODE}`,
                                ]);

                                fs.writeFileSync(dotEnvFile, configFile.join('\n'));

                                const body = new URLSearchParams();
                                body.append('client_id', firstAnswers.NEST_CLIENT_ID);
                                body.append('client_secret', firstAnswers.NEST_CLIENT_SECRET);
                                body.append('code', nestPin.NEST_PIN_CODE);
                                body.append('grant_type', 'authorization_code');

                                console.log(
                                    'Fetching access code by POSTing to https://api.home.nest.com/oauth2/access_token');
                                return fetch('https://api.home.nest.com/oauth2/access_token', {
                                    method: 'POST',
                                    body,
                                })
                                    .then((response) => response.json())
                            })
                            .then((accessTokenResp) => {
                                if (accessTokenResp.access_token) {
                                    console.log('Access code received and saved: ', accessTokenResp.access_token);
                                    // write config file
                                    configFile = configFile.concat([
                                        `NEST_ACCESS_TOKEN=${accessTokenResp.access_token}`,
                                    ]);

                                    fs.writeFileSync(dotEnvFile, configFile.join('\n'));

                                    console.log('Configuration is now complete. You can run yarn start now.');
                                }
                                else {
                                    console.error('Unexpected response: ', accessTokenResp);
                                    process.exit(1);
                                }
                            });
                    });
            }
        });
};
