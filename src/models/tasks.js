/**
 * 任务models，存储了任务的信息。
 *
 * @module models/tasks
 */
const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt, addDeleted, addFileFields} = require('./hooks');
const taskTypes = require('../core/task-types');

/**
 * 创建`tasks` model。
 *、
 * @param global {object} 全局对象，主要使用了以下字段：
 *   - config：读取上传目录
 *   - db：Mongoose链接
 * @return {mongoose.model} `tasks` model
 */
module.exports = function (global) {
  const {db, config} = global;

  const statusEnum = {
    EDITING: 0,
    SUBMITTED: 1,
    ADMITTED: 2,
    PUBLISHED: 3,
    COMPLETED: 4
  };

  /**
   * `tasks` schema对象，包含以下字段：
   *  - `name`：字符串，必要
   *  - `publisher`：ObjectId，必要，为某user的`_id`
   *  - `description`：字符串，必要，任务介绍，Markdown
   *  - `excerption`：字符串，必要，任务摘要，短文本，无Markdown
   *  - `picture`：图片
   *  - `pictureThumbnail`：图片缩略图
   *  - `type`：类型，必要
   *  - `valid`：是否可以发布，必要
   *  - `tags`：字符串数组
   *  - `deadline`：截止时间，可选
   *  - `status`：数字，必要，状态，可通过静态成员`statusEnum`获得所有的状态
   *    - EDITING：待提交
   *    - SUBMITTED：待审核
   *    - ADMITTED：待发布
   *    - PUBLISHED：已发布
   *    - COMPLETED：已完成
   *  - `data` 额外数据
   *  - `createdAt`：创建时间，自动字段
   *  - `updatedAt`：更新时间，自动字段
   *  - `deleted` 是否被删除
   *  @class Task
   */
  const taskSchema = new mongoose.Schema({
    name: {type: String, required: true},
    publisher: {type: mongoose.Schema.Types.ObjectId, required: true},
    description: {type: String, required: true},
    excerption: {type: String, required: true},
    picture: {type: String},
    pictureThumbnail: {type: String},
    type: {type: String, required: true},
    valid: {type: Boolean, required: true},
    tags: {type: [String]},
    deadline: {type: Date},
    status: {type: Number, required: true, index: true},
    data: {type: mongoose.Schema.Types.Mixed},
    createdAt: {type: Date},
    updatedAt: {type: Date},
    deleted: {type: Boolean, index: true}
  });

  /**
   * 任务的状态到编号的映射
   * @name module:models/tasks~Task.statusEnum
   */
  taskSchema.statics.statusEnum = statusEnum;

  addCreatedAt(taskSchema);
  addUpdatedAt(taskSchema);
  addDeleted(taskSchema);
  addFileFields(taskSchema, ['picture', 'pictureThumbnail'], config['upload-dir']);

  taskSchema.methods.toPlainObject = function (auth) {
    return taskTypes[this.type].taskToPlainObject(this, auth);
  };

  return db.model('tasks', taskSchema);
};
