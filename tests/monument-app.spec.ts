import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function drag(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY: number,
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Drag target has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?previewDate=2026-07-28");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("home menu exposes PWA install guidance", async ({ page }) => {
  await page.getByRole("button", { name: "打开更多选项" }).click();
  await expect(
    page.getByRole("button", { name: /添加到桌面/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /添加到桌面/ }).click();
  const guide = page.getByTestId("pwa-install-guide");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("独立网页 App")).toBeVisible();
  await expect(
    guide.getByText(/安装后将以独立全屏窗口打开/),
  ).toBeVisible();

  await guide.getByRole("button", { name: "知道了" }).click();
  await expect(guide).toHaveCount(0);
});

test("relapse carving opens optional reason capture and persists metadata", async ({
  page,
}) => {
  await page.getByTestId("relapse-button").click();
  await expect(page.locator(".date-mark--relapse.is-carving")).toBeVisible();

  const reasonSheet = page.getByTestId("relapse-reason-sheet");
  await expect(reasonSheet).toBeVisible();
  await reasonSheet.getByRole("button", { name: "深夜" }).click();
  await reasonSheet.getByRole("button", { name: "独处" }).click();
  await reasonSheet.getByRole("button", { name: "保存" }).click();
  await expect(reasonSheet).toHaveCount(0);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(stored.records["2026-07-28"]).toMatchObject({
    status: "relapse",
    reasons: ["late-night", "alone"],
  });
});

test("reset lives in a danger section and requires confirmation", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-28": { status: "success" },
        },
      }),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "打开更多选项" }).click();
  await expect(page.getByText("危险操作")).toBeVisible();
  await page.getByRole("button", { name: /恢复初始状态/ }).click();

  const confirmation = page.getByTestId("reset-confirmation");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "先导出备份" })).toBeVisible();
  await confirmation.getByRole("button", { name: "取消" }).click();
  await expect(confirmation).toHaveCount(0);

  const afterCancel = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(afterCancel.records["2026-07-28"].status).toBe("success");

  await page.getByRole("button", { name: "打开更多选项" }).click();
  await page.getByRole("button", { name: /恢复初始状态/ }).click();
  await page.getByTestId("reset-confirmation").getByRole("button", {
    name: "确认清除",
  }).click();
  const afterReset = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(afterReset.records).toEqual({});
});

test("legacy string records migrate without losing status", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-27": "success",
          "2026-07-28": "relapse",
        },
      }),
    );
  });
  await page.reload();
  await expect(page.locator(".date-mark--success")).toHaveCount(1);
  await expect(page.locator(".date-mark--relapse")).toHaveCount(1);

  const migrated = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(migrated.records["2026-07-27"]).toMatchObject({ status: "success" });
  expect(migrated.records["2026-07-28"]).toMatchObject({ status: "relapse" });
});

test("month swipes follow platform direction and non-current months are read-only", async ({
  page,
}) => {
  const app = page.getByTestId("monument-app");
  const swipeArea = page.getByTestId("month-swipe-area");

  await expect(app).toHaveAttribute("data-visible-month", "2026-07");
  await drag(page, swipeArea, -110, 3);
  await expect(app).toHaveAttribute("data-visible-month", "2026-08");
  await expect(page.getByTestId("readonly-month-panel")).toBeVisible();
  await expect(page.getByTestId("success-button")).toHaveCount(0);
  await expect(page.getByTestId("relapse-button")).toHaveCount(0);
  await expect(page.getByText("本月尚未开始 · 只读")).toBeVisible();

  await drag(page, swipeArea, 110, -2);
  await expect(app).toHaveAttribute("data-visible-month", "2026-07");
  await expect(page.getByTestId("success-button")).toBeVisible();
  await expect(page.getByTestId("relapse-button")).toBeVisible();

  await drag(page, swipeArea, 110, 2);
  await expect(app).toHaveAttribute("data-visible-month", "2026-07");
  await expect(page.getByText("石碑始立于今年七月，此前尚无史迹。")).toBeVisible();
});

test("showroom has twelve states and current detail uses through-today totals", async ({
  page,
}) => {
  await page.getByRole("button", { name: "史迹" }).click();
  await expect(page.getByTestId("gallery-page")).toBeVisible();

  const tiles = page.locator(".museum-tile");
  await expect(tiles).toHaveCount(12);
  await expect(tiles.filter({ has: page.getByText("进行中") })).toHaveCount(1);
  await expect(page.locator(".museum-tile:disabled")).toHaveCount(11);
  await expect(page.locator(".museum-stone-silhouette")).toHaveCount(12);
  const showroomBackground = await page
    .getByTestId("gallery-page")
    .evaluate((gallery) => getComputedStyle(gallery, "::after").backgroundImage);
  expect(showroomBackground).toContain("showroom-cavern.jpg");

  const futureSurface = page.locator(
    ".museum-tile.is-future .museum-stone-surface",
  ).first();
  const futureSilhouette = page.locator(
    ".museum-tile.is-future .museum-stone-silhouette",
  ).first();
  await expect(futureSurface).toHaveCSS("filter", /blur\(3\.5px\)/);
  await expect(futureSilhouette).toHaveCSS("opacity", "0.88");

  await tiles.filter({ has: page.getByText("进行中") }).click();
  const detail = page.getByTestId("month-detail-page");
  await expect(detail).toBeVisible();
  await expect(page.getByText("本月进行中，数据截至今日").first()).toBeVisible();
  await expect(page.getByText("三项合计 28 日")).toBeVisible();
  await expect(detail.getByTestId("success-button")).toHaveCount(0);
  await expect(detail.getByTestId("relapse-button")).toHaveCount(0);

  const stoneFitsDetailViewport = await detail.evaluate((detailElement) => {
    const wrap = detailElement.querySelector(".detail-stone-wrap");
    const stone = detailElement.querySelector(".stone-stage--detail");
    if (!(wrap instanceof HTMLElement) || !(stone instanceof HTMLElement)) {
      return false;
    }

    const wrapBounds = wrap.getBoundingClientRect();
    const stoneBounds = stone.getBoundingClientRect();
    return (
      stoneBounds.top >= wrapBounds.top &&
      stoneBounds.bottom <= wrapBounds.bottom
    );
  });
  expect(stoneFitsDetailViewport).toBe(true);
});

test("completed-month statistics include unlogged days and remain read-only", async ({
  page,
}) => {
  await page.goto("/?previewDate=2026-08-03");
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-01": "success",
          "2026-07-02": "success",
          "2026-07-03": "relapse",
        },
      }),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "史迹" }).click();
  await page
    .getByRole("button", { name: "2026年7月，已完成" })
    .click();

  const values = await page.locator(".detail-stats-panel dd").allTextContents();
  expect(values.map(Number)).toEqual([2, 1, 28]);
  await expect(page.getByText("三项合计 31 日 · 本月共 31 日")).toBeVisible();
  const detail = page.getByTestId("month-detail-page");
  await expect(detail.getByTestId("success-button")).toHaveCount(0);
  await expect(detail.getByTestId("relapse-button")).toHaveCount(0);
});

test("completed months can be supplemented, sealed, and reopened", async ({
  page,
}) => {
  await page.goto("/?previewDate=2026-08-03");
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-01": { status: "success" },
          "2026-07-02": { status: "success" },
          "2026-07-03": {
            status: "relapse",
            reasons: ["late-night"],
          },
        },
      }),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "史迹" }).click();
  await page
    .getByRole("button", { name: "2026年7月，已完成" })
    .click();

  const prompt = page.getByTestId("seal-prompt");
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "先补记" }).click();

  const editor = page.getByTestId("history-edit-panel");
  await expect(editor).toBeVisible();
  await expect(editor.getByText("7月4日")).toBeVisible();
  await editor.getByRole("button", { name: "未破戒" }).click();
  await editor.getByRole("button", { name: "完成" }).click();

  const entry = page.getByTestId("seal-entry-panel");
  await entry.getByRole("button", { name: "封存本月" }).click();
  await page
    .getByTestId("seal-prompt")
    .getByRole("button", { name: "封存本月" })
    .click();

  const sealed = page.getByTestId("sealed-record");
  await expect(sealed).toBeVisible();
  await expect(sealed.getByText(/此月守 3 日，失 1 日，缺 27 日/)).toBeVisible();
  await expect(sealed.getByText("深夜")).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(stored.seals["2026-07"].summary).toMatchObject({
    checkins: 3,
    relapses: 1,
    missing: 27,
    longestStreak: 2,
    topReasons: ["late-night"],
  });

  await sealed.getByRole("button", { name: "启封修改" }).click();
  await page
    .getByTestId("unseal-confirmation")
    .getByRole("button", { name: "确认启封" })
    .click();
  await expect(page.getByTestId("history-edit-panel")).toBeVisible();
  const reopened = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
  );
  expect(reopened.seals).toEqual({});
});

test("all twelve month details share the cavern background", async ({ page }) => {
  const cycleDates = [
    "2026-07-15",
    "2026-08-15",
    "2026-09-15",
    "2026-10-15",
    "2026-11-15",
    "2026-12-15",
    "2027-01-15",
    "2027-02-15",
    "2027-03-15",
    "2027-04-15",
    "2027-05-15",
    "2027-06-15",
  ];

  for (const previewDate of cycleDates) {
    await page.goto(`/?previewDate=${previewDate}`);
    await page.getByRole("button", { name: "史迹" }).click();
    await page.locator(".museum-tile.is-current").click();

    const detail = page.getByTestId("month-detail-page");
    const background = await detail.evaluate((element) =>
      getComputedStyle(element, "::after").backgroundImage,
    );
    expect(background).toContain("showroom-cavern.jpg");
    await expect(detail.locator(".month-detail-header h1")).toBeVisible();
    await expect(detail.locator(".detail-stats-panel")).toBeVisible();
  }
});

test("home more menu exports sorted records with metadata schema", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-03": "success",
          "2026-07-01": "relapse",
        },
      }),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "打开更多选项" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /导出备份/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^石碑打卡-备份-\d{4}-\d{2}-\d{2}\.json$/,
  );

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backup = JSON.parse(
    await readFile(downloadPath as string, "utf8"),
  ) as {
    app: string;
    exportVersion: number;
    exportedAt: string;
    records: Array<{ date: string; status: string }>;
  };

  expect(backup.app).toBe("石碑打卡");
  expect(backup.exportVersion).toBe(2);
  expect(backup.exportedAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
  );
  expect(backup.records).toEqual([
    { date: "2026-07-01", status: "relapse" },
    { date: "2026-07-03", status: "checkin" },
  ]);
});

test("version 1 import remains compatible and recalculates every view", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({
        records: {
          "2026-07-28": "success",
        },
      }),
    );
  });
  await page.reload();

  const backup = JSON.stringify({
    app: "石碑打卡",
    exportVersion: 1,
    exportedAt: "2026-07-29T21:00:00+08:00",
    records: [
      { date: "2026-07-01", status: "relapse" },
      { date: "2026-07-02", status: "checkin" },
      { date: "2026-07-03", status: "checkin" },
    ],
  });

  await page.getByRole("button", { name: "打开更多选项" }).click();
  let fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /导入备份/ }).click();
  let fileChooser = await fileChooserPromise;
  const dismissDialogPromise = page.waitForEvent("dialog");
  await fileChooser.setFiles({
    name: "cancelled-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  const dismissDialog = await dismissDialogPromise;
  expect(dismissDialog.message()).toContain("将覆盖当前所有本地记录");
  await dismissDialog.dismiss();

  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
    ),
  ).toEqual({
    records: { "2026-07-28": { status: "success" } },
    seals: {},
  });

  fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /导入备份/ }).click();
  fileChooser = await fileChooserPromise;
  const acceptDialogPromise = page.waitForEvent("dialog");
  await fileChooser.setFiles({
    name: "replacement-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  const acceptDialog = await acceptDialogPromise;
  await acceptDialog.accept();

  await expect(page.getByText("导入成功，共恢复 3 条记录")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
    ),
  ).toEqual({
    records: {
      "2026-07-01": { status: "relapse" },
      "2026-07-02": { status: "success" },
      "2026-07-03": { status: "success" },
    },
    seals: {},
  });
  await expect(page.getByTestId("level-label")).toContainText("茂盛");

  await page.getByRole("button", { name: "史迹" }).click();
  await page.locator(".museum-tile.is-current").click();
  const values = await page.locator(".detail-stats-panel dd").allTextContents();
  expect(values.map(Number)).toEqual([2, 1, 25]);
});

test("invalid backup files never change local records", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "stone-checkin-demo-v1",
      JSON.stringify({ records: { "2026-07-01": "success" } }),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "打开更多选项" }).click();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /导入备份/ }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        exportVersion: 99,
        records: [{ date: "2026-07-02", status: "checkin" }],
      }),
    ),
  });

  await expect(page.getByText("文件格式不正确，无法导入")).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("stone-checkin-demo-v1") ?? "{}"),
    ),
  ).toEqual({
    records: { "2026-07-01": { status: "success" } },
    seals: {},
  });
});
