/**
 * 作业model，存储了作业的信息。
 *
 * @module models/assignments
 */
const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt, addDeleted} = require('./hooks');
const taskTypes = require('../core/task-types');

/**
 * 创建`assignments` model。
 *、
 * @param global {object} 全局对象，主要使用了以下字段：
 *   - db：Mongoose链接
 * @return {mongoose.model} `tasks` model
 */
module.exports = function (global) {
  const {db} = global;

  const statusEnum = {
    EDITING: 0,
    SUBMITTED: 1,
    ADMITTED: 2,
    REJECTED: 3
  };

  /**
   * `assignments` schema对象，包含以下字段：
   *   - `task`：ObjectId，任务的Id，必要
   *   - `publisher`：ObjectId，发布者的Id，同任务的发布者（为减少数据库访问），必要
   *   - `subscriber`：ObjectId，处理者Id，必要
   *   - `type`：字符串，作业的类型，同任务的类型（为减少数据库访问），必要
   *   - `status`：数字，状态，可通过静态成员`statusEnum`获得所有的状态
   *     - EDITING：待提交
   *     - SUBMITTED：待审核
   *     - ADMITTED：已通过
   *     - REJECTED：已拒绝
   *   - `data` 额外数据
   *   - `createdAt`：创建时间，自动字段
   *   - `updatedAt`：更新时间，自动字段
   *   - `deleted` 是否被删除
   * @class Assignment
   */
  const assignmentSchema = new mongoose.Schema({
    task: {type: mongoose.Schema.Types.ObjectId, required: true, index: true},
    publisher: {type: mongoose.Schema.Types.ObjectId, required: true},
    subscriber: {type: mongoose.Schema.Types.ObjectId, required: true, index: true},
    type: {type: String, required: true},
    status: {type: Number, required: true},
    data: {type: mongoose.Schema.Types.Mixed},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    deleted: {type: Boolean, index: true}
  });

  /**
   * 作业的状态到编号的映射
   * @name module:models/tasks~Task.statusEnum
   */
  assignmentSchema.statics.statusEnum = statusEnum;

  addCreatedAt(assignmentSchema);
  addUpdatedAt(assignmentSchema);
  addDeleted(assignmentSchema);

  /**
   * 按照请求者的权限，转换成对应的对象。
   * @param auth {object} 可选，权限信息，包含uid和role
   * 那就是权限。
   * @return {object} 对象
   * @function module:models/assignments~Assignment#toPlainObject
   */
  assignmentSchema.methods.toPlainObject = function (auth) {
    return taskTypes[this.type].assignmentToPlainObject(this, auth);
  };

  return db.model('assignments', assignmentSchema);
};
