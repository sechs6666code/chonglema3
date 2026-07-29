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

test("home more menu exports only sorted raw records", async ({ page }) => {
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
  expect(backup.exportVersion).toBe(1);
  expect(backup.exportedAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
  );
  expect(backup.records).toEqual([
    { date: "2026-07-01", status: "relapse" },
    { date: "2026-07-03", status: "checkin" },
  ]);
});

test("import requires confirmation, replaces records, and recalculates every view", async ({
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
  ).toEqual({ records: { "2026-07-28": "success" } });

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
      "2026-07-01": "relapse",
      "2026-07-02": "success",
      "2026-07-03": "success",
    },
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
  ).toEqual({ records: { "2026-07-01": "success" } });
});
