const http = require('http');
const Koa = require('koa');
const mongoose = require('mongoose');
const Redis = require('redis');
const Sio = require('socket.io');
const SioRedis = require('socket.io-redis');
const mailer = require('nodemailer');
const qs = require('koa-qs');
const Models = require('./models');

mongoose.Promise = Promise;

class Server {
  async start(config) {
    /* ==== 初始化上下文环境 ==== */
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
    const email = mailer.createTransport(config.email);
    app.context.global = {
      config,              // 配置选项
      db,                  // MongoDB数据库的连接
      redis,               // Redis数据库的连接
      sioRedis,            // Redis数据库的连接，专门用于Socket.IO的监听事件
      server,              // HTTP server实例
      sio,                 // Socket.IO服务端
      email                // E-mail邮件传输
    };
    const models = Models(app);
    Object.assign(app.context.global, models); // 各种Models
    /* ==== 设置路由 ==== */
    qs(app);

    app.use(async ctx => ctx.body = 'hello, world!');

    await new Promise((resolve, reject) =>
      server
        .listen(config.port, config.host, resolve)
        .once('error', reject)
    );
    app.emit('started');
  }
  async stop() {
    this.app.emit('stopping');
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
