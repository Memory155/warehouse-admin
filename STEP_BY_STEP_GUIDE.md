# 仓库后台系统手把手执行指南（零基础版）

> 目标：你按本文档一步一步操作，就能把一个可用的「单人仓库后台系统」从 0 做到上线。
>
> 技术栈：Next.js + TypeScript + Prisma + PostgreSQL(Supabase) + Vercel

---

## 0. 先确认你将完成什么

完成后你会得到：
1. 可登录的后台系统
2. 商品管理（增改查 + 停用）
3. 分类管理（增改查 + 停用）
4. 库存变动记录（入库/出库/盘点调整等）
5. 首页看板（低库存、缺货、最近变动）
6. 可在线访问的网址（已部署）

---

## 1. 第一步：准备环境（只做一次）

### 1.1 安装 Node.js（建议 LTS）
- 去官网安装 Node.js LTS（建议 20+）
- 安装完成后，执行：

```bash
node -v
npm -v
```

预期：能显示版本号，例如 `v20.x.x`。

### 1.2 安装 Git
执行：

```bash
git --version
```

预期：能显示版本号。

### 1.3 准备账号
你需要有：
1. GitHub 账号（代码托管）
2. Supabase 账号（数据库）
3. Vercel 账号（部署）

建议这三个都用同一个邮箱，后面绑定更方便。

---

## 2. 第二步：创建项目骨架

### 2.1 在你想存项目的位置执行

```bash
npx create-next-app@latest warehouse-admin --typescript --eslint --app
```

当命令提问时建议：
1. Use Tailwind CSS? `Yes` 或 `No` 都行（你是前端，建议 `Yes`）
2. Use src/ directory? `Yes`
3. Use Turbopack? `Yes`（开发更快）
4. Customize import alias? `No`

### 2.2 进入项目目录

```bash
cd warehouse-admin
```

### 2.3 运行开发服务，验证项目可启动

```bash
npm run dev
```

打开浏览器访问：`http://localhost:3000`

预期：看到 Next.js 默认页面。

---

## 3. 第三步：安装后端依赖

在项目根目录执行：

```bash
npm i @prisma/client prisma zod bcryptjs jose
npm i -D tsx
```

依赖用途：
- `prisma` / `@prisma/client`：数据库操作
- `zod`：接口参数校验
- `bcryptjs`：密码加密
- `jose`：JWT 登录令牌
- `tsx`：运行 seed 脚本

---

## 4. 第四步：初始化 Prisma

### 4.1 初始化

```bash
npx prisma init
```

执行后会生成：
- `prisma/schema.prisma`
- `.env`

### 4.2 编辑 `.env`

把数据库连接先写成本地占位（后续会换 Supabase）：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/warehouse_admin?schema=public"
AUTH_SECRET="replace-with-a-long-random-string"
APP_URL="http://localhost:3000"
```

说明：
- `AUTH_SECRET` 需要长随机字符串，后续线上也要配置。

---

## 5. 第五步：设计数据库表（复制到 schema.prisma）

把 README 中给你的 Prisma schema 复制到：
- `prisma/schema.prisma`

你至少需要这些表：
1. `User`
2. `Category`
3. `Product`
4. `StockLog`

规则要点：
- 商品/分类都用 `isActive` 停用，不真删
- 低库存判断：`currentStock <= safetyStock`
- 日志不可改删

---

## 6. 第六步：生成数据库迁移

### 6.1 本地如果有 PostgreSQL，直接执行

```bash
npx prisma migrate dev --name init
npx prisma generate
```

如果你本机没有 PostgreSQL，可先跳到第 12 步先创建 Supabase，再回头执行 migration。

预期：
- 出现 `Applied migration` 或类似成功提示
- Prisma Client 生成成功

---

## 7. 第七步：创建种子数据（管理员账号）

### 7.1 新建文件
- `prisma/seed.ts`

写入逻辑：
1. 创建默认管理员账号（如 `admin`）
2. 密码用 `bcryptjs` 哈希
3. 初始化几个分类（客房用品、清洁用品等）

### 7.2 配置 prisma.config.ts（Prisma 7）

在 `prisma.config.ts` 的 `migrations` 下增加：

```ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

### 7.3 执行 seed

```bash
npx prisma db seed
```

预期：管理员和默认分类写入成功。

---

## 8. 第八步：先做登录（最小可用）

你需要实现：
1. `POST /api/auth/login`
2. `POST /api/auth/logout`
3. `GET /api/auth/me`

### 8.1 登录逻辑
- 按用户名查 `User`
- 用 `bcryptjs.compare` 校验密码
- 成功后签发 JWT（`jose`）
- 把 token 放到 HttpOnly Cookie

### 8.2 中间件保护后台页面
- 未登录访问 `/dashboard`、`/products` 等页面时跳转 `/login`

建议优先确保：
- 能登录
- 刷新页面登录状态不丢
- 退出后确实回到未登录状态

---

## 9. 第九步：实现分类管理模块

### 9.1 后端接口
1. `GET /api/categories`
2. `POST /api/categories`
3. `PATCH /api/categories/:id`
4. `DELETE /api/categories/:id`（改为 `isActive=false`）

### 9.2 前端页面
- `/categories`
- 列表 + 新增 + 编辑 + 停用

### 9.3 规则
- 分类下若有有效商品，禁止停用（可选但建议）

---

## 10. 第十步：实现商品管理模块

### 10.1 后端接口
1. `GET /api/products`
2. `POST /api/products`
3. `GET /api/products/:id`
4. `PATCH /api/products/:id`
5. `DELETE /api/products/:id`（停用）

### 10.2 前端页面
- `/products`
- 功能：
  - 搜索（商品名）
  - 分类筛选
  - 库存状态筛选（正常/低库存/缺货）

### 10.3 商品字段
- 名称、分类、单位、当前库存、安全库存、位置、备注、状态

---

## 11. 第十一步：实现库存变动（系统核心）

### 11.1 后端接口
- `POST /api/stock-logs`
- `GET /api/stock-logs`

### 11.2 核心处理流程
1. 获取商品当前库存
2. 根据变动类型计算 after_stock
3. 校验不可负库存（`OUT`/`DAMAGE`）
4. 写入日志（before/after）
5. 更新商品 `currentStock`

### 11.3 变动类型建议
- `IN` 入库
- `OUT` 出库
- `ADJUST` 盘点调整
- `DAMAGE` 报损
- `MANUAL` 手工修正

### 11.4 重要约束
- 日志不可修改
- 日志不可删除
- 录错使用新日志冲正

---

## 12. 第十二步：创建 Supabase 数据库（推荐）

### 12.1 创建项目
1. 登录 Supabase
2. 新建 Project
3. 等待数据库初始化完成

### 12.2 获取连接串
- 在 Supabase 控制台 Database -> Connection string 找到 `URI`
- 填入本地 `.env` 的 `DATABASE_URL`

示例：

```env
DATABASE_URL="postgresql://postgres:xxxxx@db.xxxxx.supabase.co:5432/postgres"
```

### 12.3 执行迁移与 seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

预期：Supabase 中出现你的 4 张核心表和种子数据。

---

## 13. 第十三步：实现首页看板

### 13.1 后端接口
- `GET /api/dashboard/summary`

返回建议：
1. 商品总数
2. 分类总数
3. 低库存商品数（`currentStock <= safetyStock`）
4. 缺货商品数（`currentStock = 0`）
5. 今日变动次数
6. 最近 10 条库存变动

### 13.2 前端页面
- `/dashboard`
- 上方统计卡片 + 低库存列表 + 最近变动

---

## 14. 第十四步：做最小测试与验收

### 14.1 手工验收清单
1. 登录成功/失败场景是否正常
2. 分类新增、编辑、停用是否正常
3. 商品新增、编辑、停用是否正常
4. 入库后库存是否增加
5. 出库后库存是否减少
6. 出库超过库存是否报错
7. 低库存与缺货标记是否正确
8. 首页看板数据是否准确

### 14.2 建议至少补 3 条自动化测试
1. 负库存拦截
2. 库存变动必产生日志
3. ADJUST 调整逻辑正确

---

## 15. 第十五步：准备上线（Vercel）

### 15.1 推送代码到 GitHub

```bash
git init
git add .
git commit -m "init warehouse admin mvp"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

### 15.2 在 Vercel 导入项目
1. 登录 Vercel
2. Import Git Repository
3. 选择你的仓库

### 15.3 配置环境变量（Vercel Project Settings）
1. `DATABASE_URL`
2. `AUTH_SECRET`
3. `APP_URL`（填 Vercel 分配的线上地址）

### 15.4 部署
- 点击 Deploy
- 部署成功后访问线上链接

### 15.5 线上执行迁移
可在 CI/CD 里做，也可本地执行：

```bash
npx prisma migrate deploy
```

---

## 16. 第十六步：上线后检查（必须做）

1. 用线上地址登录一次
2. 新增一个测试商品
3. 做一笔入库、一笔出库
4. 检查商品库存和日志是否一致
5. 看板是否同步更新
6. 退出登录后刷新，确认无法继续访问后台

---

## 17. 常见报错与排查

### 报错 1：`P1001 Can't reach database server`
原因：数据库连接不上
排查：
1. 检查 `DATABASE_URL` 是否正确
2. 检查 Supabase 项目是否 Running
3. 检查是否复制了错误端口或密码

### 报错 2：`prisma generate` 失败
原因：schema 写错或 Prisma 版本冲突
排查：
1. 执行 `npx prisma format`
2. 检查模型拼写和关系字段
3. 确保 `prisma` 与 `@prisma/client` 版本一致

### 报错 3：登录后马上掉线
原因：Cookie 配置问题
排查：
1. 本地开发 `secure` 应该是 `false`
2. 线上 HTTPS 时 `secure` 设为 `true`
3. `sameSite` 建议 `lax`

---

## 18. 你每天开发建议顺序（防止混乱）

每天开始先做这 4 件事：
1. 拉代码并启动本地项目
2. 确认数据库可连
3. 先跑关键页面（login/products/dashboard）
4. 再写当天功能

每天结束前做这 4 件事：
1. 自测一遍核心流程（登录->商品->库存变动->看板）
2. 提交代码
3. 记录今天改了什么
4. 记录明天第一步要做什么

---

## 19. 里程碑计划（你可以直接照这个节奏）

### M1（第 1-2 天）
- 项目初始化
- Prisma 表结构
- 登录/退出

### M2（第 3-4 天）
- 分类管理
- 商品管理

### M3（第 5-6 天）
- 库存变动 + 日志
- 看板统计

### M4（第 7 天）
- 联调修复
- 上线发布

---

## 20. 最终上线标准（达到即可交付）

满足以下即算成功：
1. 单人日常可稳定使用
2. 库存数据与日志一致
3. 低库存提醒可用
4. 有管理员登录保护
5. 可在线访问

---

如果你下一步愿意，我可以继续给你：
1. `schema.prisma` 完整可用版本
2. `seed.ts` 可直接执行版本
3. 登录 API 和中间件模板
4. 库存变动 API 模板（直接可改造成你项目代码）
