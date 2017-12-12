/**
 * 任务model，存储了任务的信息。
 *
 * @module models/tasks
 */
const mongoose = require('mongoose');
const {addCreatedAt, addUpdatedAt, addDeleted, addFileFields} = require('./hooks');
const {roleEnum} = require('./users');

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
    PUBLISHED: 3
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
   *  - `remain`：数字，进度
   *  - `total`：数字，进度总数，如果为-1表示无穷
   *  - `data` 额外数据
   *  - `createdAt`：创建时间，自动字段
   *  - `updatedAt`：更新时间，自动字段
   *  - `deleted` 是否被删除
   *
   *  注意，其中`valid`，`remain`、`total`和`data`都是交给特殊逻辑处理的，其余都是通用逻辑处理。
   *  @class Task
   */
  const taskSchema = new mongoose.Schema({
    name: {type: String, required: true},
    publisher: {type: mongoose.Schema.Types.ObjectId, required: true},
    description: {type: String, required: true},
    excerption: {type: String, required: true},
    picture: {type: String},
    pictureThumbnail: {type: String},
    type: {type: String},
    valid: {type: Boolean, required: true},
    tags: {type: [String]},
    deadline: {type: Date},
    status: {type: Number, required: true, index: true},
    remain: {type: Number},
    total: {type: Number},
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

  /**
   * 按照请求者的权限，转换成对应的对象。
   * @param auth {object} 可选，权限信息，包含uid和role
   * 那就是权限。
   * @return {object} 对象
   * @function module:models/tasks~Task#toPlainObject
   */
  taskSchema.methods.toPlainObject = function (auth) {
    const isPublisher = auth && this.publisher.equals(auth.uid);
    const isTaskAdmin = auth && (auth.role & roleEnum.TASK_ADMIN) !== 0;
    const result = {
      _id: this._id.toString(),
      name: this.name,
      publisher: this.publisher,
      description: this.description,
      excerption: this.excerption,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tags: this.tags,
      status: this.status
    };
    if (this.type !== undefined)
      result.type = this.type;
    if (this.picture !== undefined && this.pictureThumbnail !== undefined) {
      result.picture = '/uploads/' + this.picture;
      result.pictureThumbnail = '/uploads/' + this.pictureThumbnail;
    }
    if (this.remain !== undefined && this.total !== undefined) {
      result.remain = this.remain;
      result.total = this.total;
    }
    if (isPublisher || isTaskAdmin)
      result.valid = !!this.valid;
    return result;
  };

  return db.model('tasks', taskSchema);
};
