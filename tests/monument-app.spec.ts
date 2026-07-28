import { expect, test, type Locator, type Page } from "@playwright/test";

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
