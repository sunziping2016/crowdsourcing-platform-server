/**
 * 邮箱模块
 * @module core/email
 */

const emailTemplates = {
  createUser(url) {
    return {
      subject: '请确认您的账号',
      text: `点击或在浏览器中打开以下链接以激活您的账号：\n${url}`,
      html: `<p>点击<a href="${url}">此处</a>或在浏览器中打开以下链接以激活您的账号：</p>
             <p><a href="${url}">${url}</a></p>`
    };
  },
  resetPassword(url) {
    return {
      subject: '请重置您的密码',
      text: `点击或在浏览器中打开以下链接以重置您账号的密码：\n${url}`,
      html: `<p>点击<a href="${url}">此处</a>或在浏览器中打开以下链接以重置您账号的密码：</p>
             <p><a href="${url}">${url}</a></p>`
    };
  }
};

/**
 * 确认邮件链接，并执行对应的操作。
 * @param params
 *
 * @param global
 * @return {Promise<void>}
 */
async function postEmail(params, global) {

}

module.exports = {
  emailTemplates,
  postEmail
};
