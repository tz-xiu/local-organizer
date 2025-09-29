# 本项目为一个帮助程序员本地开发的时候更好的管理task的dashboard,这个dashboard需要有一下功能:
- 是一个npm package
- 启动在localhost 6749端口

### Example:
安装依赖
npm install markdown-task-dashboard

启动 dashboard
npx markdown-task-dashboard --folder local-dashboard-source



## task有以下几个属性：
- title
- parent
- Status (backlog, in-progress, complete, archived)
- Description

## 页面具体需求：
- 展示task list，list view中显示task的title
- list按照 Backlog/In-progress/Complete/Arhived的顺序展示，
- 有一个new button可以添加一个task，添加task时是popup一个 new task modal，可以添加一个task到对应的文档中。
- 有一个刷新按钮，刷新后重新从三个markdown文档中重新读取task。
- list中每一个task的最左边有一个按钮：第一个是edit 按钮，点击后popup 一个modal，可以修改这个task的所有属性。
- 可以按照task的status filter tasks。
- styling设计简洁大气，符合程序员偏好。
- 除了以上的需求，不要有其他多余需求。


## data source:
- 使用markdown文档作为数据来源。
- backlog tasks都存在一个backlog.md文档中，archive的task都在一个叫archive-tasks.md的文档中，完成的task都存在一个completed-tasks.md的文档中, in progess的task都存在一个in-progress-tasks.md的文档中，这些文档在使用者的指定的文件夹下。（数据源即为这些文档）

