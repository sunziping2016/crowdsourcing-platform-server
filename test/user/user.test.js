const {startServer, stopServer} = require('../helper');

describe('User API test', () => {
  let request;

  before(async () => {
    request = await startServer();
  });
  before(async () => {
    await stopServer();
  });

  describe('Create user test', () => {

  });
});
