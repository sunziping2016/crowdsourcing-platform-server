/**
 * 验证模块
 * @module core/auth
 */

/**
 * 验证用户，并颁发JWT。通过以下两种方式暴露：
 *   - ajax: POST /api/auth
 *   - socket.io: emit auth
 * @param params 请求数据
 *   - auth {object} 权限
 *   - data {object} 请求的data
 *     - strategy {string} 可以为`local`、`jwt`
 *     - payload 如果`strategy`为`local`，则为{username,password}或{email,password}；
 *       如果`strategy`为`jwt`则重新续`jwt`的使用时间
 * @param global
 * @return {Promise<object>}
 */
async function authenticate(params, global) {

}

module.exports = {
  authenticate
};
