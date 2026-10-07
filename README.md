# xlinkseditor

Allonelink 编辑器第一阶段：一个可切换登录/注册的认证页，以及登录后的页面列表。技术栈为 React、TypeScript、Tailwind CSS 和 Vite，发布目标是 Cloudflare Workers Static Assets。

## 已实现

- Email 注册、登录；邮箱与密码在浏览器中使用 AES-256-GCM 加密，AES 密钥再由 RSA-OAEP/SHA-256 公钥加密
- Google、Facebook Firebase 弹窗登录
- 相同邮箱的已有登录方式提示
- Email 账号之后使用 Google/Facebook 时，先完成原生 Email 登录，再关联已验证的 Firebase 社交 token
- 登录态保存、Firebase Token 刷新、退出登录
- 登录后页面列表、加载态、空状态与错误状态
- `/auth`、`/login`、`/signup` 和受保护的 `/pages` 路由

本项目不直接访问 D1、KV 或 R2，所有业务请求均通过 `xlinksapi`。

## 本地启动

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

在 `.env.local` 中填写 Firebase Web App 配置。Firebase Console 需要启用 Google 和 Facebook 登录，并把本地域名与 `app.allonel.ink` 加入 Authorized domains。

API 侧还需要设置：

```bash
cd ../xlinksapi
pnpm wrangler secret put AUTH_RSA_PRIVATE_KEY < .secrets/auth-rsa-private.pem
```

项目已在 xlinksapi 的 `.secrets/auth-rsa-private.pem` 保存与 `src/config/rsaPublicKey.ts` 内公钥配对的 PKCS#8 PEM 私钥；该目录已被 Git 忽略。私钥只能存在于 Cloudflare secret、这个本地 secret 文件或未提交的 `.dev.vars`，不得写入前端或版本库。Google/Facebook 使用编辑器 Firebase 项目，API 的 FIREBASE_PROJECT_ID 必须与其一致。

## RSA 密钥轮换

1. 生成新的 RSA 2048 位密钥对。
2. 先把新公钥替换到 `src/config/rsaPublicKey.ts` 并发布编辑器。
3. 随后立即把配对私钥更新到 xlinksapi 的 `AUTH_RSA_PRIVATE_KEY` secret 并发布 API。
4. 两次发布之间应安排维护窗口；当前协议只支持一把活动密钥。

## 校验和部署

```bash
pnpm typecheck
pnpm build
pnpm deploy
```

Cloudflare 自定义域使用 `app.allonel.ink`。完整架构见上级目录的 `re-built-allonelink.md`。


当前 Email 登录由 Allonelink AUTH_DB 校验 scrypt password + salt，登录凭据通过原生 refresh endpoint 刷新；Google/Facebook 继续使用 Firebase。密码设置页位于 `/settings/password`，列表页提供入口。修改密码时校验原密码；社交用户首次设置密码须最近重新登录并验证邮箱。API 需要 AUTH_SESSION_SECRET 与 AUTH_RSA_PRIVATE_KEY。
