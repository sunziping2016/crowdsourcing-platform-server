const logger = require('winston');
const cluster = require('cluster');
const program = require('commander');

let port, host;
program
  .version('0.1.0')
  .arguments('[port] [host]')
  .action((p, h) => {
    port = parseInt(p);
    host = h;
  })
  .option('-c, --config <file>', 'config file to load',
    process.env.CROWDSOURCE_CONFIG_FILE || './config.json')
  .option('-j, --cluster [num]', 'whether to use cluster', parseInt)
  .option('-v, --verbose', 'show verbose information')
  .parse(process.argv);

const config = require(program.config);
if (port !== undefined)
  config.port = port;
if (host !== undefined)
  config.host = host;
if (program.cluster !== undefined && !isNaN(program.cluster))
  config.cluster = program.cluster;
if (program.verbose)
  config['log-level'] = 'verbose';

if (config.cluster === true)
  config.cluster = require('os').cpus().length;

const logLabel = (config.cluster ? (cluster.isMaster ? 'Master' : 'Worker')
  : 'Main') + ' ' + process.pid;
const logTransports = [
  new (logger.transports.Console)({
    level: config['log-level'] || 'info',
    colorize: true,
    label: logLabel
  })
];
if (config['log-file'])
  logTransports.push(new (logger.transports.File)({
    level: config['log-level'] || 'info',
    filename: config['log-file']
  }));
logger.configure({transports: logTransports});

if (config.cluster) {
  if (cluster.isMaster) {
    logger.info(`Master starts at http://${config.host}:${config.port}`);
    for (let i = 0; i < config.cluster; ++i)
      cluster.fork();

    let confirmed = false;
    cluster.on('exit', (worker, code) => {
      if (!worker.exitedAfterDisconnect)
        logger.error(`Worker ${worker.process.pid} exited accidentally with code ${code}`);
    });

    process.on('SIGINT', () => {
      if (confirmed) {
        logger.warn('Received SIGINT again. Force stop!');
        process.exit(1);
      } else {
        logger.info('Received SIGINT. Press CTRL-C again in 5s to force stop.');
        confirmed = true;
        setTimeout(() => confirmed = false, 5000).unref();
      }
    });
  } else if (cluster.isWorker) {
    const server = new (require('./src/server'))();
    server.start(config)
      .then(() => logger.info('Worker starts'))
      .catch(err => {
        logger.error('Error when starting worker');
        logger.error(err);
        server.stop();
      });

    process.on('SIGINT', () => {
      cluster.worker.disconnect();
      server.stop()
        .then(() => {
          logger.info('Worker stops');
          process.exit();
        })
        .catch(err => {
          logger.error('Error when stopping worker');
          logger.error(err);
        });
    });
  }
} else {
  const server = new (require('./src/server'))();
  server.start(config)
    .then(() => logger.info(`Server starts at http://${config.host}:${config.port}`))
    .catch(err => {
      logger.error('Error when starting server');
      logger.error(err);
      server.stop();
    });

  let confirmed = false;
  process.on('SIGINT', () => {
    if (confirmed) {
      logger.warn('Received SIGINT again. Force stop!');
      process.exit(1);
    } else {
      logger.info('Received SIGINT. Press CTRL-C again in 5s to force stop.');
      confirmed = true;
      setTimeout(() => confirmed = false, 5000).unref();
      server.stop()
        .then(() => logger.info('Server stops'))
        .catch(err => {
          logger.error('Error when stopping server');
          logger.error(err);
        });
    }
  });
}
