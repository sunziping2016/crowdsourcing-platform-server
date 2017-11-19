const {startServer, stopServer} = require('../helper');

describe('User API test', () => {
// eslint-disable-next-line no-unused-vars
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
