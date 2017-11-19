const {redisify, randomAlnumString} = require('../utils');

const prefix = 'sess:';

class RedisSession {
  constructor(client) {
    this.client = client;
  }
  save(sid, data, exp) {
    sid = prefix + sid;
    return new Promise((resolve, reject) => {
      this.client.hmset(sid, redisify(data), (err, res) => {
        if (err)
          reject(err);
        else if (exp)
          this.client.expire(sid, exp, (err, res) => {
            if (err)
              reject(err);
            else
              resolve(res);
          });
        else
          resolve(res);
      });
    });
  }
  static genToken() {
    return randomAlnumString(40);
  }
  genToken() {
    return this.constructor.genToken();
  }
  load(sid) {
    return new Promise((resolve, reject) => {
      this.client.hgetall(prefix + sid, (err, res) => {
        if (err)
          reject(err);
        else
          resolve(res);
      });
    });
  }
  remove(sid) {
    return new Promise((resolve, reject) => {
      this.client.del(prefix + sid, (err, res) => {
        if (err)
          reject(err);
        else
          resolve(res);
      });
    });
  }
  async loadAndRemove(sid) {
    const sess = await this.load(sid);
    if (sess)
      await this.remove(sid);
    return sess;
  }
}

module.exports = function (client) {
  return new RedisSession(client);
};
