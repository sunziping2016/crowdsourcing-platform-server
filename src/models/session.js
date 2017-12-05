/**
 * 用于在Redis中存储一次性的临时的回话信息，比如说验证邮件用的临时信息、微信登录的临时字符串、
 * 验证码等等。这里封装一个具有一定复用性的类，并支持对临时信息的某些字段进行索引，方便删除。
 *
 * @module model/session
 */
const logger = require('winston');
const {randomAlnumString} = require('../utils');

/**
 * 临时回话类。示例对象包括
 *   - emailSession `expire`1天
 */
class RedisSession {
  /**
   * 构造函数
   * @param client {redis.RedisClient} redis客户端
   * @param options {object} 选项，可以有以下字段
   *   - prefix {string} 数据库的前缀，默认为`sess`
   *   - expire {number} 默认过期时长，单位s，默认为null，表示不过期
   *   - indices {Array.<string|Array.<string>>} 需要索引的字段
   *   - idLength {number} 随机的ID长度，默认为40。
   *   - convertTo {function} 保存数据时的转换函数，默认为原封不动（这会导致所有字段变为对应的
   *     `toString`版本）
   *   - convertFrom {function} 获取字符串的转换函数，默认原封不动（这会导致所有字段变为对应的
   *     `toString`版本）
   */
  constructor(client, options) {
    options = options || {};
    this.client = client;
    this.prefix = options.prefix || 'sess';
    this.expire = options.expire || null;
    this.indices = options.indices.map(x => Array.isArray(x) ? x : [x]) || [];
    this.idLength = options.idLength || 40;
    this.convertTo = options.convertTo || null;
    this.convertFrom = options.convertFrom || null;
  }
  /**
   * 保存数据
   * @param sid {string} optional，回话id，如果没有提供则随机生成
   * @param data {object} 数据
   * @return {Promise.<string>} sid
   */
  async save(sid, data) {
    if (data === undefined) {
      data = sid;
      sid = this.genId();
    }
    const key = this.prefix + ':' + sid;
    const command = this.client.multi();
    if (this.convertTo)
      data = this.convertTo(data);
    command.hmset(key, data);
    const timestamp = Math.floor(Date.now() / 1000);
    let expire;
    if (typeof this.expire === 'number') {
      expire = timestamp + this.expire;
      command.expireat(key, expire);
    } else
      expire = '+inf';
    this.indices
      .filter(indicies => indicies.every(index => data[index] !== undefined))
      .forEach(indicies => {
        const setName = this.prefix + ':' +
          indicies.map(index => index + ':' + data[index]).join(':');
        this.client.zremrangebyscore(setName, '-inf', timestamp, err => {
          if (err) {
            logger.error('Error when clearing expired session');
            logger.error(err);
          }
        });
        command.zadd(setName, 'NX', expire, sid);
        if (typeof this.expire === 'number')
          command.expire(setName, this.expire);
      });
    await command.execAsync();
    return sid;
  }
  /**
   * 生成随机的Id
   * @return {*}
   */
  genId() {
    return randomAlnumString(this.idLength);
  }
  /**
   * 载入回话
   * @param sid {string} Id
   * @return {Promise.<object>} 保存的回话
   */
  async load(sid) {
    const result = await this.client.hgetallAsync(this.prefix + ':' + sid);
    if (result && this.convertFrom)
      return this.convertFrom(result);
    return result;
  }
  /**
   * 删除回话
   * @param sid {string} Id
   * @return {Promise.<void>}
   */
  async remove(sid) {
    return this.client.delAsync(this.prefix + ':' + sid);
  }
  /**
   * 删除与索引一致的所有回话
   * @param data {object} 索引
   * @return {Promise.<Array.<string>>} 删除了的Id
   */
  async removeByIndex(data) {
    const setName = this.prefix + ':' + Object.keys(data)
      .map(index => index + ':' + data[index]).join(':');
    const timestamp = Math.floor(Date.now() / 1000);
    const items = (await this.client.multi()
      .zrangebyscore(setName, timestamp, '+inf')
      .del(setName)
      .execAsync())[0];
    if (items.length)
      await this.client.delAsync(items.map(x => this.prefix + ':' + x));
    return items;
  }
  /**
   * 载入并删除回话
   * @param sid {string} Id
   * @return {Promise.<object>} 保存的会话
   */
  async loadAndRemove(sid) {
    const key = this.prefix + ':' + sid;
    const result = await this.client.multi()
      .hgetall(key)
      .del(key)
      .execAsync();
    if (result[0] && this.convertFrom)
      return this.convertFrom(result[0]);
    return result[0];
  }
}

const sessionOptions = {
  createUserSession: {
    prefix: 'create-user',
    expire: 86400, // 1d
    indices: ['email']
  },
  resetPasswordSession: {
    prefix: 'reset-pwd',
    expire: 86400, // 1d
    indices: ['email']
  }
};

/**
 * 创建回话
 * @param global {object}
 *   - redis {redis.RedisClient} redis客户端
 * @return {object}
 */
module.exports = function (global) {
  const {redis} = global;
  const sessions = {};
  for (let name in sessionOptions)
    sessions[name] = new RedisSession(redis, sessionOptions[name]);
  return sessions;
};
