import julyAnchorsData from "./date-anchors.json";

export type DateAnchor = {
  day: number;
  x: number;
  y: number;
  width: number;
  rotation: number;
};

type GridStoneSpec = {
  days: number;
  image: string;
  alt: string;
  columns: number[];
  rows: number[];
  finalRow?: {
    columns: number[];
    y: number;
  };
  stageWidth: string;
};

export type MonthStone = {
  days: number;
  image: string;
  alt: string;
  anchors: DateAnchor[];
  stageWidth: string;
};

const anchorRotations = [-4, 3, -2, 4, -3, 2, -4, 4, -2, 3];

function buildGridAnchors(spec: GridStoneSpec): DateAnchor[] {
  const anchors: DateAnchor[] = [];
  const fullGridDays = Math.min(spec.days, spec.columns.length * spec.rows.length);

  for (let day = 1; day <= fullGridDays; day += 1) {
    const zeroBasedDay = day - 1;
    const column = zeroBasedDay % spec.columns.length;
    const row = Math.floor(zeroBasedDay / spec.columns.length);
    anchors.push({
      day,
      x: spec.columns[column],
      y: spec.rows[row],
      width: day < 10 ? 9.2 : 11.5,
      rotation: anchorRotations[zeroBasedDay % anchorRotations.length],
    });
  }

  if (spec.finalRow) {
    for (
      let index = 0;
      anchors.length < spec.days && index < spec.finalRow.columns.length;
      index += 1
    ) {
      const day = anchors.length + 1;
      anchors.push({
        day,
        x: spec.finalRow.columns[index],
        y: spec.finalRow.y,
        width: 11.8,
        rotation: anchorRotations[(day - 1) % anchorRotations.length],
      });
    }
  }

  return anchors;
}

const gridStoneSpecs: Record<number, GridStoneSpec> = {
  1: {
    days: 31,
    image: "/assets/scene/stones/01.webp",
    alt: "刻有一至三十一日的隆冬尖峰立石",
    columns: [26.4, 38.16, 49.78, 61.98, 74.32],
    rows: [32.28, 39.32, 46.22, 53.11, 60.28, 67.58],
    finalRow: { columns: [49.21], y: 74.75 },
    stageWidth: "min(67%, 260px)",
  },
  2: {
    days: 28,
    image: "/assets/scene/stones/02.webp",
    alt: "刻有一至二十八日的初春方正立石",
    columns: [30.96, 41.89, 52.73, 63.77, 74.61],
    rows: [24.11, 33.23, 42.66, 52.34, 62.01],
    finalRow: { columns: [41.41, 52.54, 63.28], y: 71.53 },
    stageWidth: "min(92%, 360px)",
  },
  3: {
    days: 31,
    image: "/assets/scene/stones/03.webp",
    alt: "刻有一至三十一日的仲春浑圆立石",
    columns: [25.02, 37.24, 49.95, 63.15, 75.67],
    rows: [24.87, 33.86, 42.86, 52, 61.15, 70.45],
    finalRow: { columns: [50.54], y: 78.76 },
    stageWidth: "min(91%, 355px)",
  },
  4: {
    days: 30,
    image: "/assets/scene/stones/04.webp",
    alt: "刻有一至三十日的暮春斜立石",
    columns: [30.06, 41.55, 53.54, 65.42, 77.6],
    rows: [29.88, 37.08, 44.28, 52.12, 59.68, 67.03],
    stageWidth: "min(88%, 344px)",
  },
  5: {
    days: 31,
    image: "/assets/scene/stones/05.webp",
    alt: "刻有一至三十一日的晚春尖顶立石",
    columns: [29.29, 39.51, 49.95, 60.49, 71.14],
    rows: [33.04, 40.07, 47.09, 54.11, 61.14, 68.09],
    finalRow: { columns: [49.52], y: 75.18 },
    stageWidth: "min(83%, 324px)",
  },
  6: {
    days: 30,
    image: "/assets/scene/stones/06.webp",
    alt: "刻有一至三十日的初夏苔藓立石",
    columns: [26.69, 38.31, 49.79, 61.55, 73.3],
    rows: [25.37, 34.74, 44.27, 53.89, 63.65, 73.54],
    stageWidth: "min(90%, 350px)",
  },
  8: {
    days: 31,
    image: "/assets/scene/stones/08.webp",
    alt: "刻有一至三十一日的盛夏立石",
    columns: [34.64, 43.37, 52.42, 61.46, 69.68],
    rows: [20.21, 29.31, 37.72, 45.17, 52.34, 59.45],
    finalRow: { columns: [50.87], y: 66.07 },
    stageWidth: "min(87%, 342px)",
  },
  9: {
    days: 30,
    image: "/assets/scene/stones/09.webp",
    alt: "刻有一至三十日的初秋立石",
    columns: [34.83, 43.69, 52.55, 61.63, 70.49],
    rows: [19.7, 26.84, 33.84, 40.91, 47.63, 54.43],
    stageWidth: "min(87%, 342px)",
  },
  10: {
    days: 31,
    image: "/assets/scene/stones/10.webp",
    alt: "刻有一至三十一日的深秋立石",
    columns: [34.49, 42.98, 51.78, 60.59, 69.6],
    rows: [19.18, 26.53, 33.68, 40.62, 47.56, 54.43],
    finalRow: { columns: [51.05], y: 60.89 },
    stageWidth: "min(87%, 342px)",
  },
  11: {
    days: 30,
    image: "/assets/scene/stones/11.webp",
    alt: "刻有一至三十日的初冬立石",
    columns: [35.29, 44.67, 54.05, 63.22, 71.96],
    rows: [21.44, 30.74, 39.39, 47.31, 55.09, 62.14],
    stageWidth: "min(87%, 342px)",
  },
  12: {
    days: 31,
    image: "/assets/scene/stones/12.webp",
    alt: "刻有一至三十一日的隆冬霜石",
    columns: [35.3, 44.15, 53.49, 62.05, 70.21],
    rows: [20.48, 28.93, 37.19, 45.18, 52.91, 60.24],
    finalRow: { columns: [50.05], y: 67.64 },
    stageWidth: "min(87%, 342px)",
  },
};

const julyStone: MonthStone = {
  days: 31,
  image: "/assets/scene/stone.webp",
  alt: "刻有一至三十一日的盛夏苔藓立石",
  anchors: julyAnchorsData as DateAnchor[],
  stageWidth: "min(87%, 342px)",
};

export const monthStones: Record<number, MonthStone> = Object.fromEntries([
  [7, julyStone],
  ...Object.entries(gridStoneSpecs).map(([month, spec]) => [
    Number(month),
    {
      days: spec.days,
      image: spec.image,
      alt: spec.alt,
      anchors: buildGridAnchors(spec),
      stageWidth: spec.stageWidth,
    },
  ]),
]);

export function getMonthStone(month: number): MonthStone {
  return monthStones[month] ?? julyStone;
}
