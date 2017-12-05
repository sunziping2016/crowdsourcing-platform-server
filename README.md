[![Build Status](https://travis-ci.com/sunziping2016/crowdsourcing-platform-server.svg?token=2FxtqdbFxQyVuaWRjsdf&branch=master)](https://travis-ci.com/sunziping2016/crowdsourcing-platform-server)

# 目录

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=4 orderedList=false} -->
<!-- code_chunk_output -->

* [目录](#目录)
* [1 关于](#1-关于)
	* [1.1 项目目录简介](#11-项目目录简介)
	* [1.2 项目启动及部署](#12-项目启动及部署)
* [2 设计](#2-设计)
	* [2.1 数据表](#21-数据表)
		* [2.1.1 `users`表](#211-users表)
		* [2.1.2 `tasks`表](#212-tasks表)
		* [2.1.3 牙片任务](#213-牙片任务)
			* [2.1.3.1 `tests`表](#2131-tests表)
			* [2.1.3.2 `testDistribution`表](#2132-testdistribution表)
			* [2.1.3.3 `assignments`表](#2133-assignments表)
			* [2.1.3.4 `distribution`表](#2134-distribution表)
	* [2.2 接口设计](#22-接口设计)
		* [2.2.1 `users`接口设计](#221-users接口设计)

<!-- /code_chunk_output -->

# 1 关于

这是一个在线众包平台的服务端，作为我们软件工程(3)的大作业项目。以下是项目的相关链接。
* [后端项目GitHub地址](https://github.com/sunziping2016/crowdsourcing-platform-server)
* [前端项目GitHub地址](https://github.com/sunziping2016/crowdsourcing-platform-client)
* [用户故事文档](https://github.com/sunziping2016/crowdsourcing-platform-server/blob/master/docs/user-story.md)
* [项目自动生成文档](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/index.html)

## 1.1 项目目录简介
文档主要是有一下几个部分：
* `docs/`：存放文档（不同于自动生成文档）
* `README.md`：自动生成文档的首页

自动文档会依据注释生成，具体格式可以参照[Use JSDoc: Getting Started with JSDoc 3](http://usejsdoc.org/about-getting-started.html)。

代码主要是：
* `test/`：项目测试代码
* `src/`：项目核心代码
  * `models/`：model数据层
  * `core/`：controller控制层，操纵数据层
  * `api/`：RESTful API的事件处理
  * `socket/`：Socket.io的事件处理
  * `wechat/`：微信消息推送的事件处理
  * `server.js`：整个服务端的对象
* `app.js`：启动`src/server.js`
* `config.json`：项目的配置文件（在`.gitignore`中）
* `package.json`：`npm`的配置文件

因而整个项目模块之间的依赖如下：

![模块依赖图](https://cdn.pbrd.co/images/GWdSjZ0.png)

此外还有额外的配置：
* `.editorconfig`：编辑器配置
* `.eslintrc`：代码风格检查工具配置（这是强制的，不通过就报错）
* `.jsdoc.json`：自动文档生成配置
* `.travis.yml`：Travis CI配置

## 1.2 项目启动及部署
本项目依赖两个数据库：
* MongoDB
* Redis

配置完这两个数据库后，可以通过如下命令启动server：
```bash
# Install Dependencies
npm install
# Start Server
node app # Or `npm start`
```

建议提交前应当跑一下测试：
```bash
# Check coding style
npm run lint
# Unit test
npm run test
```

部署项目自动文档到GitHub上可以采用如下方式：
```bash
# Generate documentation from code
npm run docs
# Deploy documentation to GitHub Pages
npm run gh-pages
```

当然每次提交之后会有[CI](https://travis-ci.org/sunziping2016/crowdsourcing-platform-server)自动测试并部署文档。

# 2 设计
## 2.1 数据表

### 2.1.1 `users`表

见[Users的文档](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-models_users-User.html)。

### 2.1.2 `tasks`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| taskname | String | 必要 |
| publisher | String, ref `users` | 存在且唯一 |
| description | string | 必要，任务介绍 |
| tags | Array\<String\> | 可选 |
| leftMoney | Float | 必要，剩余资金 |
| spentMeney | Float | 必要，已消费的资金 |
| deadline | Date | 可选 |
| createdAt | Date | |
| submittedAt | Date | |
| publishedAt | Date | |
| completedAt | Date | |
| updatedAt | Date | |
| status | Integer | 0：待提交，1：待审核，2：待发布，3：已发布，4：已完成，5：已删除 |

### 2.1.3 牙片任务

`tasks` 中追加字段：

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| question | String | 作业问题 |
| options | Array\<String\> | 选项 |
| allowedUsers | Array\<ref `users`\> | 可以领取任务的用户 |
| testAccuracy | Float | 测试通过的准确率阈值 |
| testAmount | Integer | 测试题的数量 |
| requiredTimes | Interger | 必要，每个作业需要的完成次数 |
| requiredAccuracy | Float | 必要，每个作业完成需要的准确率 |
| assignmentAmount | Integer | 每组作业的作业数量 |
| timeout | Integer | 超时时间 |

#### 2.1.3.1 `tests`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| pic1 | String | 必要，图一的路径 |
| pic2 | String | 必要，图二的路径 |
| answer | String | 正确选项 |

#### 2.1.3.2 `testDistribution`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| user | String, ref `users` | 必要，分配到该组测试的用户 |
| testResult | Array\<{test, answer}> | 结果，是`test`的`id`和`answer`的数组 |
| createAt | Date | 测试组的创建时间 |
| submittedAt | Date | 提交时间 |
| status | Interger | 0：未完成，1：超时，2：通过，3：未通过 |

#### 2.1.3.3 `assignments`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| pic1 | String | 必要，图一的路径 |
| pic2 | String | 必要，图二的路径 |
| submittedTimes | Integer | 必要，已提交的次数 |
| result | Array\<{user, option}\> | 提交的结果，是提交者的`id`和提交的`option`的数组 |

#### 2.1.3.4 `distribution`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| user | String, ref `users` | 必要，分配到该组作业的用户 |
| assignmentResult | Array\<{assignment, option}> | 结果，是`assignment`的`id`和`option`的数组 |
| createAt | Date | 作业组的创建时间 |
| submittedAt | Date | 提交时间 |
| status | Interger | 0：待完成，1：超时，2：已提交，3：已评判，4：已领取收益 |

## 2.2 接口设计
### 2.2.1 `users`接口设计
