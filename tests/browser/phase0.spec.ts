import { test, expect, type Page } from "@playwright/test";
const key = "flowforge:v1";
async function saved(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); }
async function seed(page: Page, raw: string) {
  // Seed only once per isolated test context; reload must exercise real persistence.
  await page.addInitScript(({ key, raw }) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(key, raw); sessionStorage.setItem("seeded", "yes"); } }, { key, raw });
}
for (const [name, raw] of [["corrupt JSON", "{original broken"], ["unsupported version", '{"version":999,"original":"keep"}'], ["malformed schema", '{"version":1,"workflows":[{}]}']]) {
  test(`${name}: recovery preserves bytes, exports, and confirms reset`, async ({ page }) => {
    await seed(page, raw);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Your workspace needs recovery" })).toBeVisible();
    await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your workspace needs recovery" })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export preserved data" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream(); const chunks = [];
    for await (const chunk of stream!) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe(raw);
    await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    await page.getByRole("button", { name: "Reset workspace", exact: true }).click();
    await page.getByRole("button", { name: "Confirm reset", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your workspace needs recovery" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("flowforge:recovery"))).toBe(raw);
    await expect.poll(async () => (await saved(page)).version).toBe(1);
  });
}
test("existing workspace loads and valid/invalid imports preserve the correct document", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Export workspace", exact: true })).toBeVisible();
  const state = await saved(page);
  state.settings.name = "Regression user";
  await page.locator('input[type=file]').setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await page.getByRole("dialog").getByRole("button", { name: "Import workspace", exact: true }).click();
  await expect.poll(async () => (await saved(page)).settings.name).toBe("Regression user");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Regression user");
  const before = await saved(page);
  state.workflows[0].nodes[0].data.config = {};
  await page.locator('input[type=file]').setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(state)) });
  await page.getByRole("dialog").getByRole("button", { name: "Import workspace", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("not a valid");
  expect(await saved(page)).toEqual(before);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("flowforge-workspace.json");
});
for (const width of [1440, 768, 390]) test(`Settings import input causes no overflow at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Import workspace", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('input[type=file]')).toBeHidden();
  // The visible import button still invokes the hidden native file picker.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import workspace", exact: true }).click();
  await chooserPromise;
});
test("more than 100 workflows remain reachable with search, filters, and actions", async ({ page }) => {
  await page.goto("/workflows");
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(3);
  const state = await saved(page);
  state.workflows = Array.from({ length: 125 }, (_, i) => ({ ...state.workflows[0], id: `workflow-${i}`, name: `Regression ${String(i).padStart(3, "0")}`, active: i % 2 === 0 }));
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
  await page.reload();
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(25);
  for (const count of [50, 75, 100, 125]) {
    await page.getByRole("button", { name: "Load more workflows" }).click();
    await expect(page.locator(".workflow-table tbody tr")).toHaveCount(count);
  }
  await expect(page.getByRole("button", { name: "Load more workflows" })).toHaveCount(0);
  await page.getByLabel("Search workflows").fill("Regression 124");
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Duplicate Regression 124", exact: true }).click();
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete Regression 124 (copy)", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete workflow", exact: true }).click();
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Drafts" }).click();
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(0);
  await page.getByLabel("Search workflows").fill("");
  await expect(page.locator(".workflow-table tbody tr")).toHaveCount(25);
});
test("inspector and canvas stay synchronized after add; connections, autosave and playback work", async ({ page }) => {
  await page.goto("/workflows");
  await page.getByRole("button", { name: "New workflow", exact: true }).click();
  await page.getByLabel("Workflow name").fill("Selection regression");
  await page.getByRole("button", { name: "Create workflow" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.locator('.palette-node[data-node-kind=transform]').click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  const inspect = page.getByRole("combobox", { name: "Inspect node", exact: true });
  const transformId = await inspect.inputValue();
  await inspect.selectOption("n0");
  await expect(inspect).toHaveValue("n0");
  await expect(page.locator('.react-flow__node[data-id=n0]')).toHaveClass(/selected/);
  await page.getByRole("combobox", { name: "Connect to", exact: true }).selectOption(transformId);
  await page.getByRole("button", { name: "Connect nodes" }).click();
  await expect(page.locator(".canvas-badge")).toContainText("1 connections");
  await page.locator(`.react-flow__node[data-id="${transformId}"]`).click();
  await expect(inspect).toHaveValue(transformId);
  await page.getByLabel("Node name", { exact: true }).fill("Persisted transform");
  await expect.poll(async () => (await saved(page)).workflows.find((w: { name: string }) => w.name === "Selection regression")?.nodes[1]?.data.label).toBe("Persisted transform");
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByRole("button", { name: "Run simulation", exact: true }).click();
  await page.getByRole("button", { name: "Pause execution" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect.poll(async () => (await saved(page)).executions.length).toBe(1);
  const execution = (await saved(page)).executions[0];
  expect(execution.status).toBe("success");
  expect(execution.steps[1].output.source).toBe("FlowForge");
});
