const Users = require('./users');
const Jwt = require('./jwt');
const Session = require('./session');

module.exports = async function (global) {
  return {
    users: Users(global),
    jwt: await Jwt(global),
    session: Session.createSessions(global)
  };
};
