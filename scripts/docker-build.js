const execSync = require('child_process').execSync;

const lastCommitHash = String(execSync('git rev-parse --verify HEAD'));
const version = lastCommitHash.substring(0, 6);

const imageID = execSync(`docker images -q gandazgul/nest-mqtt-bridge:v${version}`).toString();

if (!imageID) {
    execSync(
        `docker build -t docker.io/gandazgul/nest-mqtt-bridge:latest -t docker.io/gandazgul/nest-mqtt-bridge:v${version} .`,
        {
            stdio: 'inherit'
        }
    );
    execSync('docker push docker.io/gandazgul/nest-mqtt-bridge:latest', { stdio: 'inherit' });
    execSync(`docker push docker.io/gandazgul/nest-mqtt-bridge:v${version}`, { stdio: 'inherit' });

    process.exit(0);
}

console.log(`The docker image: docker.io/gandazgul/nest-mqtt-bridge:v${version} already exists. Did you forget to commit?`);
