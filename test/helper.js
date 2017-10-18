const path = require('path');
const server = new (require('../src/server'))();

async function startServer() {
  if (process.env.CROWDSOURCE_CONFIG_FILE)
    await server.start(require(path.join(__dirname, '..',
      process.env.CROWDSOURCE_CONFIG_FILE)));
  else
    await server.start(require('../config.test.json'));
  return [require('supertest')(server.app.context.global.server), server];
}

function stopServer() {
  server.stop();
}

module.exports = {
  startServer,
  stopServer
};
