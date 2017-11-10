const path = require('path');
const logger = require('winston');
const server = new (require('../src/server'))();

logger.level = 'error';

async function startServer() {
  if (process.env.CROWDSOURCE_CONFIG_FILE)
    await server.start(require(path.join(__dirname, '..',
      process.env.CROWDSOURCE_CONFIG_FILE)));
  else
    await server.start(require('../config.test.json'));
  return require('supertest')(server.app.context.global.server);
}

function stopServer() {
  server.stop();
}

module.exports = {
  startServer,
  stopServer
};
