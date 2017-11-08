 数据表设计
 ===

以下每个单独表中均包含 mongodb 自带的`_id`字段
 # 用户
 表`users`包含以下字段：
 | 字段 | 类型 | 注解 |
 |:---:|:---|:---|
 | \_id | ObjectId | |
 | username | String | 未删则唯一，必要 |
 | password | String | bcrypt，可为null（不可登录，强制重置密码） |
 | roles | Array\<String\> | 必要 |
 | email | String | 未删且存在则唯一，可选 |
 | wechat | String, ref `wechatUsers` | 未删且存在则唯一，可选 |
 | settings | any (Object) | 见下，用户设置，仅自己可见 |
 | createdAt | Date | |
 | updatedAt | Date | |
 | status | Interger | 0: 正常，1: 冻结，2: 删除 |

# 任务
表`tasks`包含以下字段：
| 字段 | 类型 | 注解 |
|:---:|:---|:---|
| \_id | ObjectId | |
| taskname | String | 必要 |
| publisher | String, ref `users` | 存在且唯一 |
| description | string | 必要，任务介绍 |
| tags | Array\<String\> | 可选 |
| leftMoney | Double | 必要，剩余资金 |
| spentMeney | Double | 必要，已消费的资金 |
| deadline | Date | 可选 |
| createdAt | Date | |
| submittedAt | Date | |
| publishedAt | Date | |
| completedAt | Date | |
| updatedAt | Date | |
| status | Interger | 0: 待提交，1: 待审核，2: 待发布，3: 已发布，4: 已完成，5: 已删除 |
