# 安全加固路线图

## 1. CSRF 防护方案

| 目标 | 方案 | 要点 |
| --- | --- | --- |
| 拦截跨站 POST | **双重提交 Token**：在用户登录后由 API 返回一个 `csrfToken`，并通过 `Set-Cookie: csrf-token=<value>`（`SameSite=Lax`、非 HttpOnly）写入浏览器；前端在每次 `fetch` / 表单提交时，自动把同一个 token 放到 `X-CSRF-Token` 头。 | - token 建议使用 `crypto.randomUUID()` 或 32 bytes 随机字符串；<br>- 有效期与会话相同，登出时清理；<br>- 为兼容多标签页，可在 token 失效时通过 `/api/auth/csrf` 重新获取。 |
| 服务端校验 | 在 Next `middleware.ts` 或共享中间件中，拦截 `/api/**` 的 **非 GET/HEAD/OPTIONS** 请求，比较请求头 `X-CSRF-Token` 与 Cookie `csrf-token`，任一缺失或不一致时返回 `403 CSRF token mismatch`。 | - middleware 可使用 `NextResponse.next()` 读取/写入 cookies；<br>- 需要允许来自同域的 `fetch`，因此 `SameSite=Lax` 足够；<br>- 对于 JSON API，可在响应体中带上 `csrfToken` 以便前端刷新。 |
| 前端配合 | 在 `src/lib/http/client.ts`（可新增）封装 `fetch`：自动读取 `csrf-token` Cookie（通过 `document.cookie`）并写入 `X-CSRF-Token`。对原生 `<form>`，可在提交前把 token 写入隐藏字段，再由 API route 验证。 | - 封装中统一处理 403，提示“请刷新页面重试”；<br>- SSR/Server Actions 也需在请求头附带 token。 |
| 兼容 JSON/表单 | API route 中保留 `OPTIONS` 处理，以便未来切换到 CORS；若要兼容第三方 webhook，可为特定路径加白名单并跳过 CSRF 校验。 | - 白名单必须采用明确路径，严禁通配。 |

### 交付顺序
1. 新增 `/api/auth/csrf`（或在登录/`/api/auth/me` 响应里）返回 token，前端存储至 Cookie。
2. 在 `middleware.ts` 实现校验逻辑，并在缺失 token 时下发新的 token Cookie。
3. 前端公共 `fetch`/表单 hooking，确保所有非幂等请求自动携带 `X-CSRF-Token`。
4. 为批量调用（如上传、导出）补充集成测试，验证跨域页面无法完成 POST。

---

## 2. 其他即将实施的安全工作

1. **角色映射**：将 `auth_users` 与业务 `users` 表对齐，支持多角色；更新 `toPermissionUser` 以携带完整角色数组。
2. **会话绑定**：在 `auth_sessions` 增加 `ip_hash` / `ua_hash` 并在 `findActiveSession` 中校验，降低 token 被窃取后的可用性。
3. **上传白名单**：集中 MIME/后缀白名单，所有 `FileUpload` 与 `saveBase64File` 共享，避免任意格式落盘。
4. **速率限制**：在 `middleware.ts` 接入 Upstash 或自建 Redis 限流器，对 `/api/auth/login`、`/api/files/upload` 等进行 IP 级别节流。

> 本文档用于指导落地工作，具体实现会按照“先文档、后代码、再测试”的流程推进。