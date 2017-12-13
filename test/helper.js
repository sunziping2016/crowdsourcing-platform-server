const path = require('path');
const assert = require('assert');
const logger = require('winston');
const bcrypt = require('bcrypt');
const server = new (require('../src/server'))();
const Redis = require('redis');
const mongoose = require('mongoose');

const config = require(process.env.CROWDSOURCE_CONFIG_FILE
  ? path.join(__dirname, '..', process.env.CROWDSOURCE_CONFIG_FILE)
  : '../config.test.json');

mongoose.Promise = Promise;
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
  await redis.flushdbAsync();
  redis.quit();
}

async function clearDBs() {
  const db = await mongoose.createConnection(config.db, {useMongoClient: true});
  await Promise.all(
    (await db.db.listCollections().toArray())
      .map(x => db.db.dropCollection(x.name))
  );
  await db.close();
}

async function createJwts(jwts) {
  return Promise.all(jwts.map(x =>
    server.app.context.global.jwt.sign(x.payload, x.options)
  ));
}

async function createUsers(users) {
  return Promise.all(users.map(x =>
    bcrypt.hash(x.password, 10).then(password =>
      (new server.app.context.global.users(Object.assign({}, x, {password}))).save()
    )
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

function filterObjectField(data, fields) {
  const result = {};
  fields.forEach(x => result[x] = data[x]);
  return result;
}

module.exports = {
  server,
  startServer,
  stopServer,
  clearRedis,
  clearDBs,
  createJwts,
  createUsers,
  // async helpers
  setTimeoutAsync,
  assertThrowsAsync,
  // other helpers
  filterObjectField
};
