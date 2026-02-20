# 多角色协作自动化测试方案设计

对于“员工提交申请 -> 主管审批 -> 财务打款”这类典型的多角色工作流，最推荐的自动化测试工具是 **[Playwright](https://playwright.dev/)**。

传统的测试工具（如 Cypress 最初版本、Selenium 等）在处理多用户同时登录时比较麻烦，通常需要反复登录/登出。而 **Playwright 原生支持多浏览器上下文 (Multiple Browser Contexts)**，这就相当于在同一个测试脚本中，同时打开了 A 用户的普通窗口和 B 用户的无痕窗口，两个用户的 Session 完全物理隔离。

## 1. 核心架构选型
*   **测试框架**：Playwright Test (`@playwright/test`)
*   **特性依赖**：`browser.newContext()` —— 每一个 Context 代表一个独立的浏览器环境（隔离了 LocalStorage、Cookies 等）。
*   **数据库策略**：
    *   在测试运行前通过脚本插入测试专用账号（如 `test_emp@example.com`, `test_admin@example.com`）。
    *   每个测试文件运行完成后清理脏数据，或者使用固定的测试租户。

## 2. 脚本实施范例 (TypeScript)

以下是一个自动化测试采购流转机制（从发起到审批）的完整脚本设计。

```typescript
// tests/e2e/purchase-flow.spec.ts
import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('多角色采购审批流测试', () => {
  let employeeContext: BrowserContext;
  let adminContext: BrowserContext;
  let employeePage: Page;
  let adminPage: Page;

  // 在所有测试开始前，分别初始化两个隔离的浏览器环境并自动登录
  test.beforeAll(async ({ browser }) => {
    // 1. 初始化员工环境
    employeeContext = await browser.newContext();
    employeePage = await employeeContext.newPage();
    await loginApp(employeePage, 'employee@example.com', 'password123');

    // 2. 初始化管理员(审批人)环境
    adminContext = await browser.newContext();
    adminPage = await adminContext.newPage();
    await loginApp(adminPage, 'admin@example.com', 'password123');
  });

  test.afterAll(async () => {
    await employeeContext.close();
    await adminContext.close();
  });

  test('员工提交采购单，管理员应能立刻看到并审批通过', async () => {
    // ==========================================
    // 视窗 1：员工操作 (发起采购)
    // ==========================================
    await employeePage.goto('http://localhost:3000/purchases');
    await employeePage.getByRole('button', { name: '发起采购' }).click();
    
    // 填写表单
    await employeePage.getByLabel('采购物品').fill('MacBook Pro (测试专用)');
    await employeePage.getByLabel('数量').fill('1');
    await employeePage.getByLabel('总金额').fill('15000');
    await employeePage.getByRole('button', { name: '保存草稿' }).click();
    
    // 点击提交审批
    await employeePage.getByText('MacBook Pro (测试专用)').click();
    await employeePage.getByRole('button', { name: '提交审批' }).click();
    
    // 断言：员工界面的状态已变更为“待审批”
    await expect(employeePage.locator('.status-badge')).toContainText('待审批');

    // ==========================================
    // 视窗 2：管理员操作 (审批环节)
    // ==========================================
    // 管理员刷新或前往后台采购列表
    await adminPage.goto('http://localhost:3000/purchases');
    
    // 断言：管理员能看到此条数据
    const purchaseRow = adminPage.getByRole('row', { name: /MacBook Pro \(测试专用\)/ });
    await expect(purchaseRow).toBeVisible();
    await expect(purchaseRow).toContainText('待审批');

    // 管理员点进详情，点击通过
    await purchaseRow.getByRole('button', { name: '查看详情' }).click();
    await adminPage.getByRole('button', { name: '批准申请' }).click();
    
    // 断言：管理员界面已变为“已批准”
    await expect(adminPage.locator('.status-badge')).toContainText('已批准');

    // ==========================================
    // 视窗 1 再次确认：员工界面状态是否同步
    // ==========================================
    // 员工刷新页面
    await employeePage.reload();
    await expect(employeePage.getByRole('row', { name: /MacBook Pro \(测试专用\)/ })).toContainText('已批准');
  });
});

/**
 * 封装的公用自动登录函数
 */
async function loginApp(page: Page, email: string, password: string) {
  await page.goto('http://localhost:3000/signin');
  await page.getByPlaceholder('邮箱/手机号/工号').fill(email);
  await page.getByPlaceholder('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  // 等待跳转至首页，证明登录成功
  await expect(page).toHaveURL(/.*\/purchases/); 
}
```

## 3. 该方案的优势总结

1. **真实性极高**：它完全模拟了公司里甲乙两方分别趴在自己电脑前协作拉扯的过程。
2. **免除 Mock 成本**：不需要在接口层面造假数据，都是真实的页面点击 -> 真实的数据库写入读出。
3. **极速并行**：Playwright 运行这些多 Context 测试速度极快，远超早期的无头浏览器方案。
4. **易于调试**：测试报错时，Playwright 会自带 UI Mode。你可以直观看到在第几秒种由于“左边的员工提交了但右侧的管理员没刷出来”导致了断言失败，并且附带有全程录屏代码痕迹。

如果您希望在当前项目中落地此方案，我们可以先安装 `npm init playwright@latest`，并且挑一条基础逻辑（如新建一个申请 -> 退回）进行第一次跑通。
