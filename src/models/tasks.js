/**
 * 任务models，存储了任务的信息。
 *
 * @module models/tasks
 */
const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt} = require('./hooks');

/**
 * 创建`tasks` model。
 *
 * @param global {object} 全局对象，主要使用了以下字段：
 *   - config：读取上传目录
 *   - db：Mongoose链接
 * @return {mongoose.model} `tasks` model
 */
module.exports = function (global) {
  const {db} = global;

  const statusEnum = {
    TO_BE_SUBMITTED: 0,
    TO_BE_ADMITTED: 1,
    TO_BE_PUBLISHED: 2,
    PUBLISHED: 3,
    COMPLETED: 4,
    DELETED: 5
  };

  const taskTypeEnum = {
    IMAGE_COLLECTING: 0,
    IMAGE_TAGGING: 1,
    IMAGE_RECOGNIZING: 2
  };

  const taskSettingsSchema = new mongoose.Schema({
  });

  /**
   * `tasks` schema对象，包含以下字段：
   *  - `taskName`：字符串，必要
   *  - `publisher`：字符串，为某user的username
   *  - `description`：字符串，必要，任务介绍
   *  - `tags`：字符串数组，可选
   *  - `leftMoney`：数字，必要，剩余资金
   *  - `spentMoney`：数字，必要，已消费的资金
   *  - `deadline`：截止时间，可选
   *  - `createdAt`：创建时间，自动字段
   *  - `updatedAt`：更新时间，自动字段
   *  - `submittedAt`：提交时间，(自动字段?)
   *  - `publishedAt`：发布时间，(自动字段?)
   *  - `completedAt`：完成时间，(自动字段?)
   *  - `status`：数字，必要，状态，可通过静态成员`statusEnum`获得所有的状态
   *    - TO_BE_SUBMITTED：待提交
   *    - TO_BE_ADMITTED：待审核
   *    - TO_BE_PUBLISHED：待发布
   *    - PUBLISHED：已发布
   *    - COMPLETED：已完成
   *    - DELETED：用户被删除（用户名和邮箱将被开放给新用户注册）
   *  @class Task
   */
  const taskSchema = new mongoose.Schema({
    name: {type: String, required: true},
    publisher: {type: String, required: true},
    description: {type: String, required: true},
    tags: {type: [String]},
    moneyLeft: {type: Number, required: true},
    moneySpent: {type: Number, required: true},
    expiredAt: {type: Date},
    submittedAt: {type: Date},
    publishedAt: {type: Date},
    completedAt: {type: Date},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    status: {type: Number, required: true},
    taskType: {type: Number, required: true},
    settings: {type: taskSettingsSchema}
  });

  /**
   * 任务的状态到编号的映射
   * @name module:models/tasks~Task.statusEnum
   */
  taskSchema.statics.statusEnum = statusEnum;
  /**
   * 任务的类型到编号的映射
   * @name module:models/tasks~Task.statusEnum
   */
  taskSchema.statics.taskTypeEnum = taskTypeEnum;
  addCreatedAt(taskSchema);
  addUpdatedAt(taskSchema);

};
