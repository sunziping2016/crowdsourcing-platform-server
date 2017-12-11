const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt, addDeleted} = require('./hooks');
const taskTypes = require('../core/task-types');

module.exports = function (global) {
  const {db} = global;

  const statusEnum = {
    EDITING: 0,
    SUBMITTED: 1,
    ADMITTED: 2,
    REJECTED: 3
  };

  const assignmentSchema = new mongoose.Schema({
    task: {type: mongoose.Schema.Types.ObjectId, required: true},
    publisher: {type: mongoose.Schema.Types.ObjectId, required: true},
    subscriber: {type: mongoose.Schema.Types.ObjectId, required: true},
    type: {type: String, required: true},
    status: {type: Number, required: true},
    data: {type: mongoose.Schema.Types.Mixed},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    deleted: {type: Boolean, index: true}
  });

  assignmentSchema.statics.statusEnum = statusEnum;

  addCreatedAt(assignmentSchema);
  addUpdatedAt(assignmentSchema);
  addDeleted(assignmentSchema);

  assignmentSchema.methods.toPlainObject = function (auth) {
    return taskTypes[this.type].assignmentToPlainObject(this, auth);
  };

  return db.model('assignments', assignmentSchema);
};
