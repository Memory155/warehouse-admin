# Warehouse Admin (单人版酒店仓库后台)

这是一个面向**单人/小规模（最多 3 人）**使用的轻量仓库后台系统。

目标是快速实现：
- 实时查看库存
- 管理商品和分类
- 记录库存变动
- 识别低库存/缺货

本项目按 **MVP 优先** 设计：先做简单、稳定、可上线，再逐步迭代。

---

## 1. 项目定位与范围

### 1.1 适用场景
- 酒店仓库个人管理
- 数据量小
- 操作频率中低
- 对接外部系统需求低

### 1.2 第一阶段必须功能（MVP）
1. 登录/退出（简单账号体系）
2. 商品管理（增删改查 + 停用）
3. 分类管理（增删改查 + 停用）
4. 库存变动登记（入库/出库/盘点调整/报损/手工修正）
5. 库存列表与筛选
6. 首页看板（总数、低库存、缺货、最近变动）

### 1.3 明确不做（第一阶段）
- 领用审批流程
- 采购单/出库单工作流
- 多仓库复杂调拨
- 酒店系统对接

---

## 2. 技术选型（高效开发 + 简单部署）

- 前后端：`Next.js`（App Router，全栈）
- 语言：`TypeScript`
- 数据库：`PostgreSQL`（推荐 Supabase 托管）
- ORM：`Prisma`
- 鉴权：`JWT + HttpOnly Cookie`（或 next-auth，二选一）
- 部署：`Vercel`（应用） + `Supabase`（数据库）

为什么这样选：
- 一个仓库同时管理前端 + API，开发快
- Prisma 类型安全 + migration 方便后续迭代
- Vercel/Supabase 几乎免运维，适合个人项目

---

## 3. 系统规则（按你当前确认的简化方案）

1. 当前系统默认单人使用，不做复杂并发防护
2. 每次库存变化必须记录日志
3. 日志不可编辑、不可删除（录错使用“冲正日志”）
4. 商品/分类不物理删除，统一停用（`is_active = false`）
5. 低库存规则：`current_stock <= safety_stock`
6. 缺货规则：`current_stock = 0`
7. 权限先做两级：`admin` / `member`（当前可只用 admin）

> 说明：即使是单人系统，也建议保留“操作日志 + 停用机制”，后续查错成本会低很多。

---

## 4. 数据库设计（Prisma Schema 建议）

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  DISABLED
}

enum StockLogType {
  IN
  OUT
  ADJUST
  DAMAGE
  MANUAL
}

model User {
  id           String     @id @default(cuid())
  username     String     @unique
  avatarUrl    String?
  passwordHash String
  role         Role       @default(USER)
  canManageUsers Boolean  @default(false)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  sort      Int       @default(0)
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  products  Product[]
}

model Product {
  id           String    @id @default(cuid())
  name         String
  categoryId   String
  unit         String
  spec         String?
  currentStock Decimal   @default(0)
  safetyStock  Decimal   @default(0)
  location     String?
  remark       String?
  isActive     Boolean   @default(true)
  createdBy    String
  updatedBy    String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  category     Category  @relation(fields: [categoryId], references: [id])
  logs         StockLog[]

  @@index([name])
  @@index([categoryId])
}

model StockLog {
  id          String       @id @default(cuid())
  productId   String
  type        StockLogType
  quantity    Decimal
  beforeStock Decimal
  afterStock  Decimal
  remark      String?
  operatorId  String
  createdAt   DateTime     @default(now())

  product     Product      @relation(fields: [productId], references: [id])

  @@index([productId, createdAt])
}
```

---

## 5. 页面与菜单设计

### 5.1 菜单结构
1. 首页（Dashboard）
2. 商品管理（Products）
3. 分类管理（Categories）
4. 库存记录（Stock Logs）
5. 系统设置（Profile / Users）

### 5.2 核心页面
- `/login`
- `/dashboard`
- `/products`
- `/products/[id]`
- `/categories`
- `/stock-logs`
- `/settings/profile`
- `/settings/users`（可后置）

---

## 6. API 设计（MVP）

### 鉴权
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 看板
- `GET /api/dashboard/summary`

### 分类
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`（实际停用）

### 商品
- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`（实际停用）

### 库存日志
- `GET /api/stock-logs`
- `POST /api/stock-logs`

---

## 7. 库存变动逻辑（核心）

`POST /api/stock-logs` 的业务规则：

1. 读取商品当前库存
2. 根据 `type` 计算变动后库存
3. 校验：`OUT`/`DAMAGE` 不允许变成负数
4. 写入 `StockLog`
5. 更新 `Product.currentStock`

计算规则建议：
- `IN`: `after = before + quantity`
- `OUT`: `after = before - quantity`
- `DAMAGE`: `after = before - quantity`
- `MANUAL`: `after = before + quantity`（可正可负）
- `ADJUST`: `after = targetStock`（注意该类型建议 quantity 存“调整差值”或单独传目标库存）

---

## 8. 项目目录建议

```txt
warehouse-admin/
  prisma/
    schema.prisma
    seed.ts
  src/
    app/
      (auth)/login/page.tsx
      (admin)/dashboard/page.tsx
      (admin)/products/page.tsx
      (admin)/products/[id]/page.tsx
      (admin)/categories/page.tsx
      (admin)/stock-logs/page.tsx
      api/
        auth/
        dashboard/
        products/
        categories/
        stock-logs/
    components/
      ui/
      business/
    lib/
      db.ts
      auth.ts
      validators/
      inventory/
  .env.example
  README.md
```

---

## 9. 从 0 到本地运行（完整步骤）

### 9.1 初始化项目
```bash
npx create-next-app@latest warehouse-admin --typescript --eslint --app
cd warehouse-admin
```

### 9.2 安装依赖
```bash
npm i @prisma/client prisma zod bcryptjs jose
npm i -D tsx
```

### 9.3 初始化 Prisma
```bash
npx prisma init
```

### 9.4 配置环境变量
创建 `.env`：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/warehouse_admin?schema=public"
AUTH_SECRET="replace-with-strong-random-string"
APP_URL="http://localhost:3000"
```

### 9.5 编写 schema 并迁移
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 9.6 初始化种子数据（管理员 + 默认分类）
```bash
npx prisma db seed
```

`prisma.config.ts` 增加：
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

### 9.7 启动开发环境
```bash
npm run dev
```

---

## 10. 发布部署（Vercel + Supabase）

### 10.1 准备 Supabase Postgres
1. 创建 Supabase 项目
2. 获取连接串 `DATABASE_URL`
3. 在本地 `.env` 替换并测试连接

### 10.2 连接 Vercel
1. 推送代码到 GitHub
2. 在 Vercel 导入仓库
3. 配置环境变量：
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `APP_URL`（填线上域名）
4. 触发部署

### 10.3 执行线上 migration
推荐在 CI 或手动执行：
```bash
npx prisma migrate deploy
```

### 10.4 上线验收清单
- 能登录/退出
- 商品可新增、编辑、停用
- 分类可新增、编辑、停用
- 库存变动后库存数字正确
- 低库存/缺货展示正确
- 看板统计与列表一致

### 10.5 后续每次改代码如何再次上线（详细步骤）

下面流程适用于你已经完成首发部署，后续要发布新版本。

#### A. 日常发布（直接推主分支）
1. 本地拉取最新代码：
```bash
git pull
```
2. 修改代码后先做本地检查：
```bash
npm run lint
npm run build
```
3. 提交并推送：
```bash
git add .
git commit -m "feat: 你的改动说明"
git push
```
4. Vercel 会自动触发新部署（Auto Deploy）。
5. 部署完成后在 Vercel `Deployments` 查看状态，打开线上地址验收。

#### B. 推荐发布（分支 + PR）
1. 新建功能分支：
```bash
git checkout -b codex/feature-xxx
```
2. 开发并自测：
```bash
npm run lint
npm run build
```
3. 推送分支并发起 PR：
```bash
git add .
git commit -m "feat: 你的改动说明"
git push -u origin codex/feature-xxx
```
4. Vercel 会自动生成 Preview 环境给你验收。
5. 验收通过后合并 PR 到主分支，Vercel 自动发布 Production。

#### C. 如果这次改动包含数据库结构变更（Prisma schema 有变）
1. 本地生成并提交迁移文件：
```bash
npx prisma migrate dev --name your_migration_name
```
2. 确保 `prisma/migrations/...` 已提交到 Git。
3. 代码上线后，对线上数据库执行：
```bash
npx prisma migrate deploy
```
4. 如果需要补初始化/默认数据，再执行：
```bash
npx prisma db seed
```

#### D. 每次上线后的最小验收
1. 登录是否正常
2. 首页、商品、分类、库存记录页面是否可打开
3. 用户管理（若有权限）是否正常
4. 关键写操作（新增商品、库存变动）是否成功
5. 控制台/日志是否无致命报错

#### E. 常见发布问题快速处理
1. Vercel 构建失败：先本地执行 `npm run build`，修复后再推送。
2. 数据库字段报错：确认是否忘了执行 `npx prisma migrate deploy`。
3. 登录异常：检查 Vercel 环境变量 `DATABASE_URL`、`AUTH_SECRET` 是否正确。
4. 改了环境变量没生效：在 Vercel 重新部署一次（Redeploy）。

---

## 11. 安全与稳定性（最小必做）

1. 密码必须哈希存储（`bcrypt`）
2. 鉴权 token 放 HttpOnly Cookie
3. 所有写接口要验证登录态
4. 关键输入做 `zod` 校验
5. 日志不可改删，保留审计追踪
6. 每日自动数据库备份（Supabase 可配置）

---

## 12. 测试建议（先做最关键的）

至少覆盖：
1. `OUT` 导致负库存时必须报错
2. `IN` 后库存增加正确
3. `ADJUST` 调整后库存正确
4. 每次库存变动必须生成日志
5. 停用商品后不允许再变动（可选规则）

---

## 13. 迭代路线（上线后）

### V1.1
- CSV 导出库存
- 商品搜索优化（拼音/别名）

### V1.2
- 批量导入商品
- 低库存通知（邮件/企业微信）

### V1.3
- 手机端适配
- 简单图表（7 天变动趋势）

---

## 14. 常见问题与约定

### Q1: 单人系统要不要做复杂事务/锁？
- 你的当前场景不用做复杂并发控制。
- 但依然建议保证“单次操作完整性”（日志和库存同时成功/失败）。

### Q2: 为什么不允许删库存日志？
- 因为一删就失去可追踪性，后续无法核对错误来源。

### Q3: 为什么不用真删除？
- 停用更安全，历史数据可保留，可恢复。

---

## 15. 交付标准（Definition of Done）

满足以下条件即视为 MVP 可上线：
1. 本地与线上都可稳定运行
2. 核心 6 个模块可用
3. 库存变动规则正确
4. 低库存与缺货提醒正确
5. 管理员账号可维护基础数据
6. README 可让新成员在 30 分钟内跑起来

---

## 16. 建议的开发节奏（7-10 天）

1. Day 1-2：数据模型 + 登录 + 基础布局
2. Day 3-4：商品/分类 CRUD
3. Day 5：库存变动逻辑 + 日志
4. Day 6：看板与筛选
5. Day 7：联调 + 修复 + 上线
6. Day 8-10：优化体验和补测试

---

如果你希望，我下一步可以直接按这个 README 给你生成：
- Prisma `schema.prisma`
- `seed.ts`
- API 路由骨架
- 页面骨架（App Router）
- `.env.example`

这样你就可以直接开始跑项目。
