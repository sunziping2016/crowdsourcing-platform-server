const Users = require('./users');
const Tasks = require('./tasks');
const Jwt = require('./jwt');
const Session = require('./session');

module.exports = async function (global) {
  return {
    users: Users(global),
    tasks: Tasks(global),
    jwt: await Jwt(global),
    session: Session.createSessions(global)
  };
};
