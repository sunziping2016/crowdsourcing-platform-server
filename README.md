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

见[models/users~User](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-models_users-User.html)。

### 2.1.2 `tasks`表

见[models/tasks~Task](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-models_tasks-Task.html)。

### 2.1.3 `assignments`表

用户到作业和任务到作业都是一对多的关系。通过引入作业表，问题得以简化。

见[models/assignments~Assignment](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-models_assignments-Assignment.html)。

### 2.2 接口设计
借口主要以两种方式接入：
1. AJAX请求：见[api](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-api.html)
2. Socket.IO事件：见[socket](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-socket.html)

### 2.1.1 用户模块
注意：用户的邮箱注册请参考邮箱模块，用户的登录请参照认证模块。

见[core/user](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-core_user.html)。

### 2.1.2 邮箱模块

见[core/email](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-core_email.html)。

### 2.1.3 认证模块

见[core/auth](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-core_auth.html)。

### 2.1.4 任务模块

见[core/task](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-core_task.html)。

### 2.1.5 作业模块

见[core/assignment](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/module-core_assignment.html)。
