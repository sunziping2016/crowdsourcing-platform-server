[![Build Status](https://travis-ci.org/sunziping2016/crowdsourcing-platform-server.svg?branch=master)](https://travis-ci.org/sunziping2016/crowdsourcing-platform-server)

# 目录

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->
<!-- code_chunk_output -->

* [目录](#目录)
* [1 关于](#1-关于)
* [2 设计](#2-设计)
	* [2.1 数据表](#21-数据表)
		* [2.1.1 `users`表](#211-users表)
		* [2.1.2 `wechatUsers`表](#212-wechatusers表)

<!-- /code_chunk_output -->

# 1 关于

这是一个在线众包平台的服务端，作为我们软件工程(3)的大作业项目。以下是项目的相关链接。
* [前端项目GitHub地址](https://github.com/sunziping2016/crowdsourcing-platform-client)
* [用户故事文档](https://github.com/sunziping2016/crowdsourcing-platform-server/blob/master/docs/user-story.md)
* [项目的开发文档](https://sunziping2016.github.io/crowdsourcing-platform-server/0.1.0/index.html)

# 2 设计
## 2.1 数据表

### 2.1.1 `users`表

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| _id | ObjectId | |
| username | String | 未删则唯一，必要 |
| password | String | bcrypt，可为null（不可登录，强制重置密码） |
| roles | Array<String> | 必要 |
| email | String | 未删且存在则唯一，可选 |
| wechat | String, ref `wechatUsers` | 未删且存在则唯一，可选 |
| settings | any (Object) | 见下，用户设置，仅自己可见 |
| blocked | Boolean | 用户是否被封禁，可选（相当于false） |
| createdAt | Date | |
| updatedAt | Date | |
| deleted | Boolean | 是否删除，必要 |

其中`roles`可以为以下几种：
* subscriber： 可以领取任务
* publisher：可以发布任务
* taskAdmin：可以管理任务
* userAdmin：可以管理用户
* siteAdmin：可以对站点、微信进行设置

`settings`待定。

### 2.1.2 `wechatUsers`表

注意除了`_id`外，别的都是可选。部分内容详见[微信公众平台 - 获取用户基本信息](https://mp.weixin.qq.com/wiki?t=resource/res_main&id=mp1421140839)

| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| _id (alias openId) | ObjectId | |
| subscribe | Boolean | |
| nickname | String | |
| gender | Number | |
| language | String | |
| avatar | String | 相对于 uploads 目录的位置 |
| avatarThumbnail | String | 相对于 uploads 目录的位置 |
