const Users = require('./users');
const Tasks = require('./tasks');
const Assignments = require('./assignments');
const Jwt = require('./jwt');
const Session = require('./session');

module.exports = async function (global) {
  return Object.assign({
    users: Users(global),
    assignments: Assignments(global),
    tasks: Tasks(global),
    jwt: await Jwt(global)
  }, Session(global));
};
