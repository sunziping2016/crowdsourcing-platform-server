/**
 * 包含了整个服务端类，供`app.js`启动或测试调用。
 * @module server
 */

const http = require('http');
const Koa = require('koa');
const mongoose = require('mongoose');
const Redis = require('redis');
const Sio = require('socket.io');
const SioRedis = require('socket.io-redis');
const mailer = require('nodemailer');
const qs = require('koa-qs');
const Router = require('koa-router');
const koaLogger = require('./koa-logger');
const Models = require('./models');
const Api = require('./api');

mongoose.Promise = Promise;

/**
 * 整个服务端类。这里初始化了整个项目传递各种对象的`global`对象。
 *
 * `global`对象包含以下几个字段：
 * 1. `config`：项目的配置
 * 2. `db`、`redis`：Mongoose链接和Redis链接
 * 3. `sio`：Socket.IO对象
 * 4. `email`：Nodemailer对象
 * 5. `users`...：各种models
 *
 * 对于Koa的中间件来讲，这个对象可通过`ctx.global`获得。
 */
class Server {
  /**
   * 启动服务端，初始化所有model和路由等等。
   *
   * @param config {object} 项目配置，参见`example.config.json`
   * @returns {Promise.<void>} 监听成功后resolve，否则reject
   */
  async start(config) {
    /* ==== 初始化上下文环境 ==== */
    config = Server.normalizeConfig(config || {});
    const app = this.app = new Koa();
    const db = await mongoose.createConnection(config.db,
      {useMongoClient: true});
    const redis = Redis.createClient(config.redis);
    const sioRedis = Redis.createClient(config.redis);
    const server = http.createServer(app.callback());
    const sio = Sio(server);
    sio.adapter(SioRedis({
      pubClient: redis,
      subClient: sioRedis
    }));
    const global = {
      config,              // 配置选项
      db,                  // MongoDB数据库的连接
      redis,               // Redis数据库的连接
      sioRedis,            // Redis数据库的连接，专门用于Socket.IO的监听事件
      server,              // HTTP server实例
      sio                  // Socket.IO服务端
    };
    if (config.email)
      global.email = mailer.createTransport(config.email); // E-mail邮件传输
    const models = await Models(global);
    Object.assign(global, models); // 各种Models
    app.context.global = global;
    /* ==== 设置路由 ==== */
    qs(app);
    app.use(koaLogger);
    const router = new Router();
    const api = Api();
    router.use('/api', api.routes(), api.allowedMethods());
    app.use(router.routes());
    app.use(router.allowedMethods());
    await new Promise((resolve, reject) =>
      server
        .listen(config.port, config.host, resolve)
        .once('error', reject)
    );
  }

  /**
   * 将默认的项目配置与config对象合并后返回。
   *
   * @param config {object} 项目配置
   * @return {object} 添加了默认配置的项目配置
   */
  static normalizeConfig(config) {
    const defaultConfig = {
      host: 'localhost',
      port: '8000',
      db: 'mongodb://localhost/crowdsource',
      redis: 'redis://localhost/',
      'upload-dir': 'uploads'
    };
    Object.assign(defaultConfig, config);
    if (defaultConfig.site === undefined)
      defaultConfig.site = `http://${defaultConfig.host}:${defaultConfig.port}`;
    return defaultConfig;
  }

  /**
   * 停止服务器，停止完毕后可以再调用调用`start()`
   *
   * @returns {Promise.<void>} 完成后resolve，否则reject
   */
  async stop() {
    const {db, redis, sioRedis, server, sio} = this.app.context.global;
    redis.quit();
    sioRedis.quit();
    await Promise.all([
      new Promise((resolve, reject) => server.close(resolve)),
      new Promise((resolve, reject) => sio.close(resolve)),
      db.close()
    ]);
  }
}

module.exports = Server;
