/**
 * 该model主要负责JWT的颁发和吊销。传统的JWT是自签名无状态的，存在着无法吊销的问题，
 * 这里我们采用给所有颁发的jwt一个id，建立索引的方式，做到可撤销的JWT。
 *
 * @module models/jwt
 */
const cluster = require('cluster');
const crypto = require('crypto');
const logger = require('winston');
const jsonWebToken = require('jsonwebtoken');
const timespan = require('jsonwebtoken/lib/timespan');
const {randomAlnumString, promisify} = require('../utils');

const jwtIdLength = 40;
const cacheDuration = 3600 * 1000; // 1h

// Promisify JSON web token
['verify', 'sign'].forEach(key =>
  jsonWebToken[key] = promisify(jsonWebToken[key])
);

class RevokedError extends jsonWebToken.JsonWebTokenError {
  constructor(...args) {
    super(...args);
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, this.constructor);
    this.name = 'RevokedError';
  }
}

/**
 * JWT model，还包含以下额外的属性：
 * - JsonWebTokenError: 所有JWT错误的基类，可能会在`verify()`的时候发生（比如签名错误）
 * - NotBeforeError: 本项目不会用到
 * - TokenExpiredError: JWT过期，可能会在`verify()`的时候发生
 * - RevokedError: JWT被撤回，可能会在`verify()`的时候发生
 */
class Jwt {
  /**
   * JWT model的构造函数
   * @param client {redis.RedisClient} redis 客户端
   */
  constructor(client) {
    this.client = client;
    this.secretKey = null;
    this.secretKeyExpiresAt = null;

    Object.assign(this, {
      JsonWebTokenError: jsonWebToken.JsonWebTokenError,
      NotBeforeError: jsonWebToken.NotBeforeError,
      TokenExpiredError: jsonWebToken.TokenExpiredError,
      RevokedError
    });
  }

  /**
   * 从Redis中获取全局的SecretKey，程序启动时会检查是否存在全局的SecretKey，如果不存在
   * 创建随机的SecretKey并存与Redis。
   *
   * @return {Promise.<Buffer>} SecretKey
   */
  async getSecretKey() {
    if (this.secretKey && Date.now() < this.secretKeyExpiresAt)
      return this.secretKey;
    const result = await this.client.getAsync('jwt:secretKey');
    if (result) {
      this.secretKey = Buffer.from(result);
      this.secretKeyExpiresAt = Date.now() + cacheDuration;
    } else
      this.secretKey = null;
    return this.secretKey;
  }

  /**
   * 保存`secretKey`Redis数据库中
   * @param secretKey {Buffer} 应当是256字节的随机字符串
   * @return {Promise.<void>}
   */
  setSecretKey(secretKey) {
    return this.client.setAsync('jwt:secretKey', secretKey);
  }

  /**
   * 签名，其中payload应当包含`uid`表示用户的ID，而`options`中应该包含`expiresIn`
   * 表示签名的有效期。
   *
   * @param payload {object} JWT的内容，可以包含uid和role
   * @param options {object} 见[node-jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
   * @return {Promise.<string>} 生成的jwt
   */
  async sign(payload, options) {
    const timestamp = payload.iat = Math.floor(Date.now() / 1000);
    if (options.expiresIn !== undefined) {
      payload.exp = timespan(options.expiresIn, timestamp);
      delete options.expiresIn;
    }
    payload.jti = randomAlnumString(jwtIdLength);
    const secretKey = await this.getSecretKey();
    const jwt = jsonWebToken.sign(payload, secretKey, options);
    if (payload.uid) {
      const userSet = 'jwt:uid:' + payload.uid;
      this.client.zremrangebyscore(userSet, '-inf', timestamp, (err, res) => {
        if (err) {
          logger.error('Error when clearing expired jwt');
          logger.error(err);
        }
      });
      await this.client.zaddAsync(userSet, 'NX',
        payload.exp || '+inf', payload.jti);
    }
    return jwt;
  }

  /**
   * 验证JWT，正确返回payload，否则抛出对应的异常
   * @param token {string} JWT
   * @return {Promise.<object>} 返回JWT的payload
   */
  async verify(token) {
    const secretKey = await this.getSecretKey();
    const payload = await jsonWebToken.verify(token, secretKey);
    if (payload.uid) {
      const expire = await this.client.zscoreAsync('jwt:uid:' + payload.uid,
        payload.jti);
      if (expire === null)
        throw new RevokedError('jwt revoked');
    }
    return payload;
  }

  /**
   * 撤回用户的某个或所有的JWT
   * @param uid {string} 用户的id
   * @param jti {string} optional，JWT的id，如果缺省，撤回所有改用户的JWT
   * @return {Promise.<void>}
   */
  async revoke(uid, jti) {
    if (jti !== undefined)
      await this.client.zremAsync('jwt:uid:' + uid, jti);
    else
      await this.client.delAsync('jwt:uid:' + uid);
  }
}

/**
 * 创建Jwt model，同时主进程会初始化全局的SecretKey
 *
 * @param global {object} 全局对象，主要使用了以下字段：
 *   - redis: Redis客户端
 * @return {Promise.<Jwt>} 创建的Jwt Model
 */
module.exports = async function (global) {
  const {redis} = global;
  const model = new Jwt(redis);
  if (cluster.isMaster || cluster.worker.id === 1) {
    let secretKey = await model.getSecretKey();
    if (!secretKey) {
      secretKey = await new Promise((resolve, reject) => {
        crypto.randomBytes(256, (err, buf) => {
          if (err)
            reject(err);
          else
            resolve(buf);
        });
      });
      await model.setSecretKey(secretKey);
    }
  }
  return model;
};
