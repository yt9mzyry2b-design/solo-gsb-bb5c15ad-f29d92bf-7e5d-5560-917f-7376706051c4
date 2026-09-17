# 盲审分配台 · Blind Review Desk

一款在 **浏览器本地** 完成稿件—评审人自动分配的 Web 应用。无需后端、无需注册，所有数据只保存在你自己的浏览器（localStorage）中，分配计算由 [javascript-lp-solver](https://www.npmjs.com/package/javascript-lp-solver) 以整数线性规划（ILP）在页面内完成。

技术栈：**React 18 + TypeScript + Vite + javascript-lp-solver**。

## 功能

- **录入稿件**：标题、所需评审人数、主题标签（可多个）。
- **录入评审人**：姓名、擅长标签、审稿容量（最多承担稿件数）、利益冲突（勾选需回避的稿件）。
- **一键生成**：先严格满足全部硬约束，再做目标优化。
  - 硬约束
    1. **利益冲突**：声明冲突的稿件—评审人对绝不分配；
    2. **容量**：每位评审人承担稿件数 ≤ 其容量；
    3. **人数**：每篇稿件恰好分配到所需数量的、互不相同的评审人。
  - 优化目标（字典序）
    1. **主题匹配最大化**：优先把稿件分给擅长标签命中的评审人；
    2. **负载均衡**：在此基础上最小化评审人的最大负载。
  - 可行性预检使用 Dinic 最大流；不可行时基于最小割给出**具体原因**：
    - 单篇稿件可分配评审人数不足（含缺口数）；
    - 全局容量不足（总名额缺口）；
    - 组合性瓶颈：哪一组稿件只能由哪几位评审人承担、缺口多少（Hall 条件违反的紧见证）。
- **结果展示**：每篇稿件的分配明细与主题匹配标记、评审人负载进度条、匹配/负载统计、本地求解耗时。
- **数据持久化**：录入内容自动保存到 localStorage，刷新或关闭页面不丢失。
- **导出 JSON**：将分配结果（含稿件、评审人、匹配标签、负载与利用率）下载为 JSON 文件。
- 另附「载入示例」按钮，可快速体验。

## 一条命令启动（Docker Compose）

```bash
docker compose up -d --build
```

启动后访问：

> **http://localhost:8080**

停止：

```bash
docker compose down
```

> 如宿主机的 8080 端口被占用，修改 `docker-compose.yml` 中 `"8080:80"` 的左侧端口即可。

## 本地开发（不用 Docker）

要求 Node.js ≥ 18。

```bash
npm install
npm run dev        # 开发服务器，访问 http://localhost:5173
```

生产构建与本地预览：

```bash
npm run build      # 类型检查 + 打包到 dist/
npm run preview    # 预览生产构建，访问 http://localhost:4173
```

## 导出结果 JSON 结构

```jsonc
{
  "exportedAt": "2026-09-17T08:00:00.000Z",
  "summary": {
    "topicMatches": 6,      // 命中主题匹配的分配条数
    "maxLoad": 2,           // 评审人最大负载
    "totalAssigned": 8,     // 已分配名额
    "totalRequired": 8      // 总需求名额
  },
  "assignments": [
    {
      "paperId": "paper_ml_001",
      "paperTitle": "面向大语言模型的高效微调方法",
      "reviewerId": "rev_bob",
      "reviewerName": "Bob（推荐/ML）",
      "topicMatched": true,
      "matchedTags": ["机器学习", "NLP"]
    }
  ],
  "reviewerLoads": [
    {
      "reviewerId": "rev_bob",
      "reviewerName": "Bob（推荐/ML）",
      "assigned": 2,
      "capacity": 2,
      "utilization": 1.0
    }
  ]
}
```

## 求解模型说明

对每个无冲突的（稿件 i，评审人 j）对设置 0/1 变量 `x[i][j]`：

- 约束：每篇稿件 `Σ_j x[i][j] = 需求_i`；每位评审人 `Σ_i x[i][j] ≤ 容量_j`；
- 冲突对不生成变量，因此天然不可能被分配；
- 目标采用**两阶段字典序优化**（避免直接引入 min-max 变量破坏全幺模性、拖慢整数分支）：
  1. **阶段一**：在真实容量下最大化 `Σ 命中主题的 x[i][j]`。该模型是带容量二部图匹配（b-匹配/运输问题），约束矩阵全幺模，LP 松弛的最优顶点解即为 0/1 整数解，求解器在根节点即可快速完成；
  2. **阶段二**：固定阶段一的最优匹配数不损失，对“评审人最大负载 L”做二分搜索（把所有评审人的容量上限临时改为 L 后重复阶段一），找到可行的最小 L，即实现负载均衡。

生成前先以 Dinic 最大流验证硬约束可行性：若不可行则不调用优化器，并通过最小割源侧集合定位瓶颈，给出可操作的修改提示。

## 目录结构

```
src/
  engine/
    maxflow.ts      # Dinic 最大流：硬约束可行性与瓶颈定位
    solver.ts       # 主流程 + ILP 建模（javascript-lp-solver）
  components/       # 录入与结果展示组件
  types.ts          # 数据模型
  storage.ts        # localStorage 持久化
  exporter.ts       # 结果 JSON 导出
  sampleData.ts     # 示例数据
Dockerfile          # 多阶段构建：Node 构建 + nginx 静态托管
docker-compose.yml  # 一条命令启动
```
