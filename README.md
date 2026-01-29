# larkflow
飞流: 将用户飞书知识库中的文章分发到各种内容平台。

## 功能

1. 从飞书文档 中整理全部的文章 :
https://github.com/larksuite/node-sdk  
2. 将文章转成markdown
3. 将文章中的图片（包括封面）上传aliyun oss，并替换最终markdown
4. 将产生的文章，标题，封面等信息，保存到数据库
5. 用户通过前端网页可以获取文章列表，并将文章发布到微信公众号中，后面有可能还会同步到小红书，知乎等平台


## 技术选型

1. 后端使用 deno(hono)
2. 数据库使用postgresql(drizzle)
3. 任务队列使用postgresql(postgres.queue.js)
3. 对象存储使用aliyun oss
2. 前端使用vue3(Ant Design Vue)


 
## ai接入
1. 针对不同平台需要的封面大小，生成不同的封面
2. ai能总结更好的文章标题
3. ai能润色文章内容





