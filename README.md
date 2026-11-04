# oxxx

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_OGomAO1ym2j4uqyvI6MkLHFqDk8z)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## 后端：账号与模拟交易

站内的登录、注册和下单都是**模拟交易**：每个新账号获得 10,000 USDT 虚拟资金，按 OKX 实时买一卖一价成交，不涉及任何真实资金，也不支持充值或提现。

### 本地运行

1. 准备一个 Postgres 数据库（Neon、Supabase、Vercel Postgres 或本地 Postgres 均可）。
2. 复制 `.env.example` 为 `.env.local`，填入 `DATABASE_URL`。
3. 安装依赖并建表：

   ```bash
   pnpm install
   pnpm db:push   # 按 lib/server/db/schema.ts 创建或更新表结构
   pnpm dev
   ```

4. 运行撮合计算的单元测试（需要 Node 22.18 或更高版本）：`pnpm test`

部署到 Vercel 时，在项目的环境变量里设置同样的 `DATABASE_URL`，并在首次部署前对生产库执行一次 `pnpm db:push`。

### 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ email, password }`，注册并登录 |
| POST | `/api/auth/login` | `{ email, password }`，登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户，未登录返回 `{ user: null }` |
| GET | `/api/account` | 模拟资产余额 |
| GET | `/api/orders?status=open\|closed&symbol=` | 当前委托或历史委托 |
| POST | `/api/orders` | `{ symbol, side, type, quantity, price? }`，现货下单 |
| DELETE | `/api/orders/:id` | 撤单 |
| GET | `/api/fills?symbol=` | 成交记录 |

所有写操作只接受同源请求（校验 `Origin`），会话保存在 httpOnly Cookie 中，数据库里只存令牌的 SHA-256。

### 撮合规则与已知限制

- **市价单**：买单按卖一价、卖单按买一价立即成交，计 Taker 手续费 0.05%。
- **限价单**：能立即成交（买价 ≥ 卖一，或卖价 ≤ 买一）时按盘口价成交；否则挂单并冻结资金，之后按委托价以 Maker 手续费 0.02% 成交。
- **挂单结算时机**：用户读取账户或委托时检查一次（交易页每 5 秒轮询）。两次检查之间价格触及又离开的挂单不会成交。
- 只支持现货，合约和杠杆下单按钮会显示「暂不支持」。
- 价格来自服务器请求 OKX 公共接口（缓存 1 秒）。若部署区域无法访问 OKX，下单会提示「行情暂不可用」，此时需把函数区域设到可访问 OKX 的地区。
- 暂未实现：手机号和通行密钥登录、邮箱验证、找回密码、过期会话清理、按 IP 的频率限制。登录连续失败 10 次会锁定该账号 15 分钟。

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
