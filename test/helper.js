const path = require('path');
const assert = require('assert');
const logger = require('winston');
const server = new (require('../src/server'))();
const Redis = require('redis');

const config = require(process.env.CROWDSOURCE_CONFIG_FILE
  ? path.join(__dirname, '..', process.env.CROWDSOURCE_CONFIG_FILE)
  : '../config.test.json');

logger.level = 'error';

async function startServer() {
  await server.start(config);
  return require('supertest')(server.app.context.global.server);
}

function stopServer() {
  server.stop();
}

async function clearRedis() {
  const redis = Redis.createClient(config.redis);
  await new Promise((resolve, reject) => {
    redis.del('*', (err, res) => {
      if (err)
        reject(err);
      else
        resolve(res);
    });
  });
  redis.quit();
}

async function createJwts(jwts) {
  return Promise.all(jwts.map(x =>
    server.app.context.global.jwt.sign(x.payload, x.options)
  ));
}

async function setTimeoutAsync(delay) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, delay);
  });
}

async function assertThrowsAsync(promise, error, message) {
  let f = () => {};
  try {
    await promise;
  } catch (e) {
    f = () => {
      throw e;
    };
  } finally {
    assert.throws(f, error, message);
  }
}

module.exports = {
  server,
  startServer,
  stopServer,
  clearRedis,
  createJwts,
  // async helpers
  setTimeoutAsync,
  assertThrowsAsync
};
