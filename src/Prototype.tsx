/*
THESIS: 陈列室让十二块月碑成为可回看的年度史迹，不把它做成普通数据面板。
OWN-WORLD: 沿用真实石碑、深炭灰、暖铜与高透明雾面玻璃，不引入新的视觉语言。
STORY: 首页记录当下；史迹总览区分已完成、进行中与未开始；详情只读回看。
FIRST VIEWPORT: 首页仍由当月石碑主导，陈列室入口克制地留在底部信息卡片。
FORM: 既有场景的局部扩展；陈列室采用自适应博物馆展柜网格。
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion } from "motion/react";
import { getMonthStone, type MonthStone } from "./month-stones";
import PwaManager from "./PwaManager";
import {
  FlowStack,
  KeyboardInput,
  MobileScroll,
  type FlowScreen,
  useFlow,
  useKeyboard,
} from "./mobile";

type CheckStatus = "success" | "relapse";
type BackupStatus = "checkin" | "relapse";
type MonthState = "complete" | "current" | "future";
type RelapseReason =
  | "content"
  | "late-night"
  | "alone"
  | "boredom"
  | "stress"
  | "other";

type DayRecord = {
  status: CheckStatus;
  reasons?: RelapseReason[];
  note?: string;
  updatedAt?: string;
};

type MonthSealSummary = {
  checkins: number;
  relapses: number;
  missing: number;
  longestStreak: number;
  topReasons: RelapseReason[];
  vegetationLevel: number;
};

type MonthSeal = {
  month: string;
  sealedAt: string;
  summary: MonthSealSummary;
};

type StoredState = {
  records: Record<string, DayRecord>;
  seals: Record<string, MonthSeal>;
};

type BackupRecord = {
  date: string;
  status: BackupStatus;
  reasons?: RelapseReason[];
  note?: string;
  updatedAt?: string;
};

type BackupFile = {
  app: "石碑打卡";
  exportVersion: 2;
  exportedAt: string;
  records: BackupRecord[];
  seals: MonthSeal[];
};

type CycleMonth = {
  year: number;
  month: number;
  days: number;
  key: string;
  label: string;
  stone: MonthStone;
};

type MonthStats = {
  success: number;
  relapse: number;
  missing: number;
  scopeDays: number;
};

type LeaderboardPreferences = {
  ownerToken: string;
  publicId: string;
  isPublic: boolean;
};

type LeaderboardEntry = {
  publicId: string;
  days: number;
  rank: number;
  updatedAt: string;
};

type LeaderboardData = {
  ninja: LeaderboardEntry[];
  rush: LeaderboardEntry[];
  generatedAt: string;
};

type LeaderboardStreaks = {
  ninjaDays: number;
  rushDays: number;
};

type MonumentContextValue = {
  today: Date;
  state: StoredState;
  setState: Dispatch<SetStateAction<StoredState>>;
  currentLevel: number;
  feedback: string;
  setFeedback: Dispatch<SetStateAction<string>>;
};

const STORAGE_KEY = "stone-checkin-demo-v1";
const SETTINGS_KEY = "stone-checkin-settings-v1";
const LEADERBOARD_SETTINGS_KEY = "stone-checkin-leaderboard-v1";
const LEADERBOARD_PREFERENCES_EVENT = "stone-leaderboard-preferences";
const LEADERBOARD_API =
  "https://chonglema-leaderboard-api.sechs6666.chatgpt.site/v1";
const EXPORT_VERSION = 2;
const HISTORY_START_YEAR = 2026;
const HISTORY_START_MONTH = 7;
const MAX_RELAPSE_REASONS = 3;

const relapseReasonMeta: Record<
  RelapseReason,
  { label: string; shortLabel: string }
> = {
  content: { label: "内容刺激", shortLabel: "内容刺激" },
  "late-night": { label: "深夜", shortLabel: "深夜" },
  alone: { label: "独处", shortLabel: "独处" },
  boredom: { label: "无聊", shortLabel: "无聊" },
  stress: { label: "压力", shortLabel: "压力" },
  other: { label: "其他", shortLabel: "其他" },
};

const relapseReasonOrder = Object.keys(
  relapseReasonMeta,
) as RelapseReason[];

const levelMeta = {
  1: { label: "枯萎", image: "/assets/scene/source/level-1-wilted.jpg" },
  2: { label: "稀疏", image: "/assets/scene/source/level-2-sparse.jpg" },
  3: { label: "正常", image: "/assets/scene/source/level-3-normal.jpg" },
  4: { label: "茂盛", image: "/assets/scene/source/level-4-lush.jpg" },
  5: { label: "繁盛", image: "/assets/scene/source/level-5-blooming.jpg" },
} as const;

const defaultState: StoredState = {
  records: {},
  seals: {},
};

const statusLabels: Record<CheckStatus, string> = {
  success: "未破戒",
  relapse: "破戒",
};

const monthTransitionVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 42 : -42,
    filter: "blur(2px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -42 : 42,
    filter: "blur(2px)",
  }),
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nextDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

function createOwnerToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createDefaultLeaderboardPreferences(): LeaderboardPreferences {
  const suffix = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  return {
    ownerToken: createOwnerToken(),
    publicId: `石客${suffix}`,
    isPublic: false,
  };
}

function loadLeaderboardPreferences() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LEADERBOARD_SETTINGS_KEY) ?? "null",
    ) as Partial<LeaderboardPreferences> | null;
    if (
      parsed &&
      typeof parsed.ownerToken === "string" &&
      /^[A-Za-z0-9_-]{24,160}$/.test(parsed.ownerToken) &&
      typeof parsed.publicId === "string" &&
      typeof parsed.isPublic === "boolean"
    ) {
      return {
        ownerToken: parsed.ownerToken,
        publicId: parsed.publicId,
        isPublic: parsed.isPublic,
      };
    }
  } catch {
    // A malformed local preference is replaced with a private fresh identity.
  }
  return createDefaultLeaderboardPreferences();
}

function persistLeaderboardPreferences(preferences: LeaderboardPreferences) {
  window.localStorage.setItem(
    LEADERBOARD_SETTINGS_KEY,
    JSON.stringify(preferences),
  );
  window.dispatchEvent(new Event(LEADERBOARD_PREFERENCES_EVENT));
}

function calculateLongestStreaks(
  records: Record<string, DayRecord>,
  today: Date,
): LeaderboardStreaks {
  let previousKey = "";
  let previousStatus: CheckStatus | null = null;
  let running = 0;
  let ninjaDays = 0;
  let rushDays = 0;
  const todayKey = dateKey(today);

  for (const [key, record] of Object.entries(records).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (key > todayKey) break;
    const continues =
      previousStatus === record.status &&
      previousKey !== "" &&
      nextDateKey(previousKey) === key;
    running = continues ? running + 1 : 1;
    if (record.status === "success") ninjaDays = Math.max(ninjaDays, running);
    if (record.status === "relapse") rushDays = Math.max(rushDays, running);
    previousKey = key;
    previousStatus = record.status;
  }

  return { ninjaDays, rushDays };
}

async function fetchLeaderboard(signal?: AbortSignal) {
  const response = await fetch(`${LEADERBOARD_API}/leaderboard`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("排行榜暂时无法读取");
  return (await response.json()) as LeaderboardData;
}

async function saveLeaderboardProfile(
  preferences: LeaderboardPreferences,
  streaks: LeaderboardStreaks,
) {
  const response = await fetch(`${LEADERBOARD_API}/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerToken: preferences.ownerToken,
      publicId: preferences.publicId,
      isPublic: preferences.isPublic,
      ...streaks,
    }),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(payload?.error || "排行榜暂时无法更新");
  }
}

function localIsoTimestamp(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absoluteOffset / 60));
  const offsetRemainder = pad(absoluteOffset % 60);

  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}${sign}${offsetHours}:${offsetRemainder}`;
}

function isValidBackupDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isRelapseReason(value: unknown): value is RelapseReason {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(relapseReasonMeta, value)
  );
}

function normalizeDayRecord(value: unknown): DayRecord | null {
  if (value === "success" || value === "relapse") {
    return { status: value };
  }
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    status?: unknown;
    reasons?: unknown;
    note?: unknown;
    updatedAt?: unknown;
  };
  if (candidate.status !== "success" && candidate.status !== "relapse") {
    return null;
  }

  const reasons = Array.isArray(candidate.reasons)
    ? candidate.reasons.filter(isRelapseReason).slice(0, MAX_RELAPSE_REASONS)
    : [];
  const note =
    typeof candidate.note === "string"
      ? candidate.note.trim().slice(0, 30)
      : "";

  return {
    status: candidate.status,
    ...(candidate.status === "relapse" && reasons.length ? { reasons } : {}),
    ...(candidate.status === "relapse" && note ? { note } : {}),
    ...(typeof candidate.updatedAt === "string"
      ? { updatedAt: candidate.updatedAt }
      : {}),
  };
}

function normalizeMonthSeal(value: unknown): MonthSeal | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    month?: unknown;
    sealedAt?: unknown;
    summary?: unknown;
  };
  if (
    typeof candidate.month !== "string" ||
    !/^\d{4}-\d{2}$/.test(candidate.month) ||
    typeof candidate.sealedAt !== "string" ||
    !candidate.summary ||
    typeof candidate.summary !== "object"
  ) {
    return null;
  }

  const summary = candidate.summary as Record<string, unknown>;
  const numericKeys = [
    "checkins",
    "relapses",
    "missing",
    "longestStreak",
    "vegetationLevel",
  ] as const;
  if (
    numericKeys.some(
      (key) =>
        typeof summary[key] !== "number" ||
        !Number.isInteger(summary[key]) ||
        Number(summary[key]) < 0,
    ) ||
    Number(summary.vegetationLevel) < 1 ||
    Number(summary.vegetationLevel) > 5
  ) {
    return null;
  }
  const topReasons = Array.isArray(summary.topReasons)
    ? summary.topReasons.filter(isRelapseReason).slice(0, 2)
    : [];

  return {
    month: candidate.month,
    sealedAt: candidate.sealedAt,
    summary: {
      checkins: Number(summary.checkins),
      relapses: Number(summary.relapses),
      missing: Number(summary.missing),
      longestStreak: Number(summary.longestStreak),
      topReasons,
      vegetationLevel: Number(summary.vegetationLevel),
    },
  };
}

function parseBackupFile(value: unknown): StoredState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    exportVersion?: unknown;
    records?: unknown;
  };
  if (
    candidate.exportVersion !== 1 &&
    candidate.exportVersion !== EXPORT_VERSION
  ) {
    return null;
  }
  if (
    !Array.isArray(candidate.records)
  ) {
    return null;
  }

  const records: Record<string, DayRecord> = {};
  const seals: Record<string, MonthSeal> = {};
  const seenDates = new Set<string>();

  for (const entry of candidate.records) {
    if (!entry || typeof entry !== "object") return null;
    const record = entry as {
      date?: unknown;
      status?: unknown;
      reasons?: unknown;
      note?: unknown;
      updatedAt?: unknown;
    };
    if (
      !isValidBackupDate(record.date) ||
      (record.status !== "checkin" && record.status !== "relapse") ||
      seenDates.has(record.date)
    ) {
      return null;
    }

    seenDates.add(record.date);
    const status = record.status === "checkin" ? "success" : "relapse";
    const normalized = normalizeDayRecord({
      status,
      reasons: record.reasons,
      note: record.note,
      updatedAt: record.updatedAt,
    });
    if (!normalized) return null;
    records[record.date] = normalized;
  }

  if (candidate.exportVersion === EXPORT_VERSION) {
    const sealEntries = (candidate as { seals?: unknown }).seals;
    if (sealEntries !== undefined && !Array.isArray(sealEntries)) return null;
    for (const entry of sealEntries ?? []) {
      const seal = normalizeMonthSeal(entry);
      if (!seal || seals[seal.month]) return null;
      seals[seal.month] = seal;
    }
  }

  return { records, seals };
}

function monthPrefix(month: CycleMonth) {
  return `${month.year}-${pad(month.month)}-`;
}

function dateForDay(month: CycleMonth, day: number) {
  return new Date(month.year, month.month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthOrdinal(year: number, month: number) {
  return year * 12 + month - 1;
}

function resolveToday() {
  if (window.location.hostname === "terminal.local" || import.meta.env.DEV) {
    const previewDate = new URLSearchParams(window.location.search).get(
      "previewDate",
    );
    if (previewDate && /^\d{4}-\d{2}-\d{2}$/.test(previewDate)) {
      const [year, month, day] = previewDate.split("-").map(Number);
      return startOfDay(new Date(year, month - 1, day));
    }
  }

  return startOfDay(new Date());
}

function calculateLevel(records: Record<string, DayRecord>) {
  return Object.keys(records)
    .sort()
    .reduce((level, key) => {
      const change = records[key].status === "success" ? 1 : -1;
      return Math.max(1, Math.min(5, level + change));
    }, 3);
}

function loadState(): StoredState {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return defaultState;
    const parsed = JSON.parse(value) as { records?: unknown; seals?: unknown };
    const records: Record<string, DayRecord> = {};
    const seals: Record<string, MonthSeal> = {};
    if (parsed.records && typeof parsed.records === "object") {
      for (const [key, value] of Object.entries(parsed.records)) {
        const normalized = normalizeDayRecord(value);
        if (isValidBackupDate(key) && normalized) records[key] = normalized;
      }
    }
    if (parsed.seals && typeof parsed.seals === "object") {
      for (const [key, value] of Object.entries(parsed.seals)) {
        const seal = normalizeMonthSeal(value);
        if (seal && seal.month === key) seals[key] = seal;
      }
    }
    return {
      records,
      seals,
    };
  } catch {
    return defaultState;
  }
}

function loadSoundPreference() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) ?? "{}",
    ) as { carvingSound?: unknown };
    return parsed.carvingSound !== false;
  } catch {
    return true;
  }
}

function playStoneSound(status: CheckStatus) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const duration = status === "relapse" ? 0.24 : 0.18;
    const frameCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const progress = index / frameCount;
      const grit = Math.random() * 2 - 1;
      channel[index] =
        grit *
        Math.pow(1 - progress, status === "relapse" ? 3.2 : 4.4) *
        0.34;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = status === "relapse" ? 390 : 520;
    filter.Q.value = 0.72;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.34, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    source.stop(context.currentTime + duration);
    source.addEventListener("ended", () => void context.close(), {
      once: true,
    });
  } catch {
    // Sound is optional; recording must still succeed when the browser blocks it.
  }
}

const cycleMonths: CycleMonth[] = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(
    HISTORY_START_YEAR,
    HISTORY_START_MONTH - 1 + index,
    1,
  );
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const stone = getMonthStone(month);
  const calendarDays = new Date(year, month, 0).getDate();

  return {
    year,
    month,
    days: Math.min(calendarDays, stone.days),
    key: `${year}-${pad(month)}`,
    label: `${month}月`,
    stone,
  };
});

function getMonthState(month: CycleMonth, today: Date): MonthState {
  const visible = monthOrdinal(month.year, month.month);
  const current = monthOrdinal(today.getFullYear(), today.getMonth() + 1);
  if (visible < current) return "complete";
  if (visible > current) return "future";
  return "current";
}

function getMonthStats(
  month: CycleMonth,
  today: Date,
  records: Record<string, DayRecord>,
): MonthStats {
  const state = getMonthState(month, today);
  const scopeDays =
    state === "complete"
      ? month.days
      : state === "current"
        ? Math.min(today.getDate(), month.days)
        : 0;
  const prefix = monthPrefix(month);
  let success = 0;
  let relapse = 0;

  for (let day = 1; day <= scopeDays; day += 1) {
    const status = records[`${prefix}${pad(day)}`]?.status;
    if (status === "success") success += 1;
    if (status === "relapse") relapse += 1;
  }

  return {
    success,
    relapse,
    missing: scopeDays - success - relapse,
    scopeDays,
  };
}

function getMonthSealSummary(
  month: CycleMonth,
  records: Record<string, DayRecord>,
): MonthSealSummary {
  const prefix = monthPrefix(month);
  let checkins = 0;
  let relapses = 0;
  let longestStreak = 0;
  let currentStreak = 0;
  const reasonCounts = new Map<RelapseReason, number>();

  for (let day = 1; day <= month.days; day += 1) {
    const record = records[`${prefix}${pad(day)}`];
    if (record?.status === "success") {
      checkins += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      continue;
    }

    currentStreak = 0;
    if (record?.status !== "relapse") continue;
    relapses += 1;
    for (const reason of record.reasons ?? []) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  const monthEndKey = `${month.key}-${pad(month.days)}`;
  const recordsThroughMonth = Object.fromEntries(
    Object.entries(records).filter(([key]) => key <= monthEndKey),
  );
  const topReasons = [...reasonCounts.entries()]
    .sort(([leftReason, leftCount], [rightReason, rightCount]) => {
      if (rightCount !== leftCount) return rightCount - leftCount;
      return (
        relapseReasonOrder.indexOf(leftReason) -
        relapseReasonOrder.indexOf(rightReason)
      );
    })
    .slice(0, 2)
    .map(([reason]) => reason);

  return {
    checkins,
    relapses,
    missing: month.days - checkins - relapses,
    longestStreak,
    topReasons,
    vegetationLevel: calculateLevel(recordsThroughMonth),
  };
}

function createMonthSeal(
  month: CycleMonth,
  records: Record<string, DayRecord>,
): MonthSeal {
  return {
    month: month.key,
    sealedAt: localIsoTimestamp(new Date()),
    summary: getMonthSealSummary(month, records),
  };
}

function sealEpitaph(seal: MonthSeal) {
  const { checkins, relapses, missing } = seal.summary;
  const ending =
    checkins >= relapses + missing
      ? "石有裂痕，志未曾断。"
      : relapses > checkins
        ? "痕虽深，来日仍可续刻。"
        : "得失皆留，步履未停。";

  return [
    `此月守 ${checkins} 日，失 ${relapses} 日，缺 ${missing} 日。`,
    ending,
  ];
}

function initialCycleIndex(today: Date) {
  const start = monthOrdinal(HISTORY_START_YEAR, HISTORY_START_MONTH);
  const current = monthOrdinal(today.getFullYear(), today.getMonth() + 1);
  return Math.max(0, Math.min(cycleMonths.length - 1, current - start));
}

const MonumentContext = createContext<MonumentContextValue | null>(null);

function useMonument() {
  const context = useContext(MonumentContext);
  if (!context) throw new Error("useMonument must be used inside MonumentContext");
  return context;
}

function Landscape({ level }: { level: number }) {
  return (
    <div className="landscape" aria-hidden="true">
      <img
        className="landscape-base"
        src={levelMeta[3].image}
        alt=""
        draggable={false}
      />
      {Object.entries(levelMeta).map(([entryLevel, meta]) => (
        <img
          key={entryLevel}
          className={`landscape-ground ${
            Number(entryLevel) === level ? "is-active" : ""
          }`}
          src={meta.image}
          alt=""
          draggable={false}
        />
      ))}
      <div className="landscape-wash" />
    </div>
  );
}

function StoneFigure({
  month,
  records,
  interactive = false,
  selectedDay,
  availableThrough = 0,
  onSelectDay,
  onInspectRelapse,
  activeCarving,
  detail = false,
}: {
  month: CycleMonth;
  records: Record<string, DayRecord>;
  interactive?: boolean;
  selectedDay?: number;
  availableThrough?: number;
  onSelectDay?: (day: number) => void;
  onInspectRelapse?: (day: number) => void;
  activeCarving?: {
    date: string;
    status: CheckStatus;
    token: number;
  } | null;
  detail?: boolean;
}) {
  const prefix = monthPrefix(month);

  return (
    <div
      className={`stone-stage ${detail ? "stone-stage--detail" : ""} ${
        activeCarving?.date.startsWith(prefix) ? "is-carving-active" : ""
      }`}
      style={
        {
          "--stone-stage-width": month.stone.stageWidth,
        } as CSSProperties
      }
    >
      <img
        className="stone-image"
        src={month.stone.image}
        alt={month.stone.alt}
        draggable={false}
        data-testid="stone-image"
      />

      <div className="stone-overlays">
        {month.stone.anchors.map((anchor) => {
          const recordKey = `${prefix}${pad(anchor.day)}`;
          const record = records[recordKey];
          if (!record) return null;
          const isCarving = activeCarving?.date === recordKey;
          const style = {
            "--anchor-x": `${anchor.x}%`,
            "--anchor-y": `${anchor.y}%`,
            "--anchor-width": `${anchor.width}%`,
            "--anchor-rotation": `${anchor.rotation}deg`,
          } as CSSProperties;

          return (
            <img
              key={`mark-${anchor.day}-${isCarving ? activeCarving.token : "rest"}`}
              className={`date-mark date-mark--${record.status} ${
                isCarving ? "is-carving" : ""
              }`}
              src={
                record.status === "success"
                  ? "/assets/scene/mark-success.webp"
                  : "/assets/scene/mark-broken.webp"
              }
              alt=""
              aria-hidden="true"
              draggable={false}
              style={style}
            />
          );
        })}

        {interactive
          ? month.stone.anchors.map((anchor) => {
              const unavailable =
                anchor.day > availableThrough || anchor.day > month.days;
              const style = {
                "--anchor-x": `${anchor.x}%`,
                "--anchor-y": `${anchor.y}%`,
                "--hotspot-width": `${Math.max(anchor.width, 10.5)}%`,
              } as CSSProperties;

              return (
                <button
                  key={`day-${anchor.day}`}
                  className={`date-hotspot ${
                    selectedDay === anchor.day ? "is-selected" : ""
                  }`}
                  type="button"
                  disabled={unavailable}
                  aria-label={`选择第 ${anchor.day} 日${
                    unavailable ? "，日期尚未到来" : ""
                  }`}
                  aria-pressed={selectedDay === anchor.day}
                onClick={() => onSelectDay?.(anchor.day)}
                  style={style}
                />
              );
            })
          : null}

        {!interactive && onInspectRelapse
          ? month.stone.anchors.map((anchor) => {
              const record = records[`${prefix}${pad(anchor.day)}`];
              if (record?.status !== "relapse") return null;
              const style = {
                "--anchor-x": `${anchor.x}%`,
                "--anchor-y": `${anchor.y}%`,
                "--hotspot-width": `${Math.max(anchor.width, 11.5)}%`,
              } as CSSProperties;

              return (
                <button
                  key={`inspect-${anchor.day}`}
                  className="date-hotspot date-hotspot--inspect"
                  type="button"
                  aria-label={`查看第 ${anchor.day} 日破戒原因`}
                  onClick={() => onInspectRelapse(anchor.day)}
                  style={style}
                />
              );
            })
          : null}

        {activeCarving && activeCarving.date.startsWith(prefix) ? (
          <div
            key={`burst-${activeCarving.token}`}
            className={`carving-burst carving-burst--${activeCarving.status}`}
            aria-hidden="true"
            style={
              (() => {
                const activeDay = Number(activeCarving.date.slice(-2));
                const anchor = month.stone.anchors.find(
                  (entry) => entry.day === activeDay,
                );
                return anchor
                  ? ({
                      "--anchor-x": `${anchor.x}%`,
                      "--anchor-y": `${anchor.y}%`,
                    } as CSSProperties)
                  : undefined;
              })()
            }
          >
            {Array.from({ length: 8 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatReasonSummary(record?: DayRecord) {
  if (!record || record.status !== "relapse") return "";
  const labels = (record.reasons ?? []).map(
    (reason) => relapseReasonMeta[reason].shortLabel,
  );
  if (record.note && !labels.includes("其他")) labels.push("其他");
  return labels.join(" · ");
}

function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  compact = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const keyboard = useKeyboard();

  useEffect(() => {
    if (!open) return;
    keyboard.hide();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="app-sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.17 }}
        >
          <button
            className="app-sheet-backdrop"
            type="button"
            aria-label="关闭面板"
            onClick={() => onOpenChange(false)}
          />
          <motion.section
            className={`app-sheet ${compact ? "is-compact" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{
              type: "spring",
              stiffness: 430,
              damping: 39,
              mass: 0.92,
            }}
          >
            <div className="app-sheet-handle" aria-hidden="true" />
            <header>
              <h2>{title}</h2>
              {description ? <p>{description}</p> : null}
            </header>
            {children}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function RelapseReasonSheet({
  open,
  dateLabel,
  record,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  dateLabel: string;
  record?: DayRecord;
  onOpenChange: (open: boolean) => void;
  onSave: (reasons: RelapseReason[], note: string) => void;
}) {
  const keyboard = useKeyboard();
  const [selectedReasons, setSelectedReasons] = useState<RelapseReason[]>([]);
  const [note, setNote] = useState("");
  const [limitHint, setLimitHint] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedReasons(record?.reasons ?? []);
    setNote(record?.note ?? "");
    setLimitHint("");
  }, [open, record]);

  const toggleReason = (reason: RelapseReason) => {
    setSelectedReasons((current) => {
      if (current.includes(reason)) {
        setLimitHint("");
        return current.filter((entry) => entry !== reason);
      }
      if (current.length >= MAX_RELAPSE_REASONS) {
        setLimitHint("最多选择 3 项");
        navigator.vibrate?.(10);
        return current;
      }
      setLimitHint("");
      return [...current, reason];
    });
  };

  return (
    <AppSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) keyboard.hide();
        onOpenChange(nextOpen);
      }}
      title="记录当时的诱因"
      description={`${dateLabel} · 完全选填，不作评判`}
    >
      <div className="reason-sheet" data-testid="relapse-reason-sheet">
        <div className="reason-options" aria-label="破戒原因，可多选">
          {relapseReasonOrder.map((reason) => (
            <button
              key={reason}
              className={
                selectedReasons.includes(reason) ? "is-selected" : ""
              }
              type="button"
              aria-pressed={selectedReasons.includes(reason)}
              onClick={() => toggleReason(reason)}
            >
              {relapseReasonMeta[reason].label}
            </button>
          ))}
        </div>
        <p className={`reason-limit ${limitHint ? "is-visible" : ""}`}>
          {limitHint || `${selectedReasons.length} / ${MAX_RELAPSE_REASONS}`}
        </p>
        {selectedReasons.includes("other") ? (
          <label className="reason-note">
            <span>简单记一句</span>
            <KeyboardInput
              value={note}
              maxLength={30}
              placeholder="不超过30字"
              onChange={(event) => setNote(event.currentTarget.value)}
            />
            <small>{note.length} / 30</small>
          </label>
        ) : null}
        <div className="reason-sheet-actions">
          <button
            className="reason-skip"
            type="button"
            onClick={() => {
              keyboard.hide();
              onOpenChange(false);
            }}
          >
            暂不记录
          </button>
          <button
            className="reason-save"
            type="button"
            onClick={() => {
              keyboard.hide();
              onSave(
                selectedReasons,
                selectedReasons.includes("other") ? note.trim() : "",
              );
            }}
          >
            保存
          </button>
        </div>
      </div>
    </AppSheet>
  );
}

function MonthStatsRow({
  stats,
  className = "",
}: {
  stats: MonthStats;
  className?: string;
}) {
  return (
    <dl className={`month-stats ${className}`}>
      <div>
        <dt>未破戒</dt>
        <dd>{stats.success}</dd>
      </div>
      <div>
        <dt>破戒</dt>
        <dd>{stats.relapse}</dd>
      </div>
      <div>
        <dt>未打卡</dt>
        <dd>{stats.missing}</dd>
      </div>
    </dl>
  );
}

function HistoryEntry({ onClick }: { onClick: () => void }) {
  return (
    <button className="history-entry" type="button" onClick={onClick}>
      史迹
    </button>
  );
}

function LeaderboardEntry({ onClick }: { onClick: () => void }) {
  return (
    <button className="leaderboard-entry" type="button" onClick={onClick}>
      排行榜
    </button>
  );
}

function HomeScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today, state, setState, currentLevel, feedback, setFeedback } =
    useMonument();
  const isActiveScreen = flow.current.id === "home";
  const todayDay = today.getDate();
  const currentIndex = initialCycleIndex(today);
  const [visibleIndex, setVisibleIndex] = useState(currentIndex);
  const visibleMonth = cycleMonths[visibleIndex];
  const visibleMonthState = getMonthState(visibleMonth, today);
  const isCurrentMonth = visibleMonthState === "current";
  const monthStats = useMemo(
    () => getMonthStats(visibleMonth, today, state.records),
    [state.records, today, visibleMonth],
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    isCurrentMonth ? Math.min(todayDay, visibleMonth.days) : 1,
  );
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [monthDirection, setMonthDirection] = useState(1);
  const [panelCollapsed, setPanelCollapsed] = useState(
    () => isCurrentMonth && Boolean(state.records[dateKey(today)]),
  );
  const [soundEnabled, setSoundEnabled] = useState(loadSoundPreference);
  const [activeCarving, setActiveCarving] = useState<{
    date: string;
    status: CheckStatus;
    token: number;
  } | null>(null);
  const [reasonSheetKey, setReasonSheetKey] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);
  const secondaryControlsRef = useRef<HTMLDivElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const carvingTimerRef = useRef<number | null>(null);
  const reasonTimerRef = useRef<number | null>(null);
  const collapseTimerRef = useRef<number | null>(null);

  const selectedDate = dateForDay(visibleMonth, selectedDay);
  const selectedKey = dateKey(selectedDate);
  const selectedRecord = state.records[selectedKey];
  const selectedStatus = selectedRecord?.status;

  useEffect(
    () => () => {
      if (carvingTimerRef.current) {
        window.clearTimeout(carvingTimerRef.current);
      }
      if (reasonTimerRef.current) {
        window.clearTimeout(reasonTimerRef.current);
      }
      if (collapseTimerRef.current) {
        window.clearTimeout(collapseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ carvingSound: soundEnabled }),
    );
  }, [soundEnabled]);

  useEffect(() => {
    if (!secondaryOpen) return;

    const closeSecondaryControls = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setSecondaryOpen(false);
        return;
      }

      if (
        event.target instanceof Node &&
        !secondaryControlsRef.current?.contains(event.target)
      ) {
        setSecondaryOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeSecondaryControls);
    document.addEventListener("keydown", closeSecondaryControls);
    return () => {
      document.removeEventListener("pointerdown", closeSecondaryControls);
      document.removeEventListener("keydown", closeSecondaryControls);
    };
  }, [secondaryOpen]);

  const changeVisibleMonth = useCallback(
    (delta: -1 | 1) => {
      const nextIndex = visibleIndex + delta;
      keyboard.hide();
      setSecondaryOpen(false);

      if (nextIndex < 0) {
        setFeedback("石碑始立于今年七月，此前尚无史迹。");
        navigator.vibrate?.(12);
        return;
      }

      if (nextIndex >= cycleMonths.length) {
        setFeedback("本轮史迹止于明年六月。");
        navigator.vibrate?.(12);
        return;
      }

      const nextMonth = cycleMonths[nextIndex];
      const nextState = getMonthState(nextMonth, today);
      setMonthDirection(delta);
      setVisibleIndex(nextIndex);
      setSelectedDay(
        nextState === "current" ? Math.min(todayDay, nextMonth.days) : 1,
      );
      setPanelCollapsed(false);
    },
    [keyboard, setFeedback, today, todayDay, visibleIndex],
  );

  const bindMonthSwipe = useDrag(
    (gesture) => {
      if (!gesture.last) return;
      const [movementX] = gesture.movement;
      const [velocityX] = gesture.velocity;
      const [directionX] = gesture.direction;
      const committed =
        Math.abs(movementX) >= 54 ||
        (velocityX >= 0.45 && Math.abs(directionX) > 0);
      if (!committed) return;

      // System convention: a left swipe reveals the next/future month.
      changeVisibleMonth(movementX < 0 || directionX < 0 ? 1 : -1);
    },
    {
      axis: "x",
      filterTaps: true,
      threshold: 10,
    },
  );

  const commitRecord = (status: CheckStatus) => {
    if (
      !isCurrentMonth ||
      selectedDay > todayDay ||
      selectedDay > visibleMonth.days
    ) {
      return;
    }
    keyboard.hide();
    const previousRecord = state.records[selectedKey];
    const nextRecord: DayRecord = {
      status,
      updatedAt: localIsoTimestamp(new Date()),
      ...(status === "relapse" && previousRecord?.status === "relapse"
        ? {
            ...(previousRecord.reasons?.length
              ? { reasons: previousRecord.reasons }
              : {}),
            ...(previousRecord.note ? { note: previousRecord.note } : {}),
          }
        : {}),
    };
    const records = { ...state.records, [selectedKey]: nextRecord };
    const nextLevel = calculateLevel(records);
    setState({ ...state, records });
    const token = Date.now();
    setActiveCarving({ date: selectedKey, status, token });
    if (soundEnabled) playStoneSound(status);

    navigator.vibrate?.(status === "success" ? 18 : [20, 30, 20]);
    setFeedback(
      `第 ${selectedDay} 日已${selectedStatus ? "改为" : "记录为"}“${
        statusLabels[status]
      }” · 档位 ${currentLevel} → ${nextLevel}`,
    );
    if (carvingTimerRef.current) {
      window.clearTimeout(carvingTimerRef.current);
    }
    carvingTimerRef.current = window.setTimeout(
      () => setActiveCarving(null),
      status === "relapse" ? 1180 : 1040,
    );

    if (selectedDay === todayDay) {
      if (collapseTimerRef.current) {
        window.clearTimeout(collapseTimerRef.current);
      }
      collapseTimerRef.current = window.setTimeout(
        () => setPanelCollapsed(true),
        920,
      );
    }

    if (status === "relapse") {
      if (reasonTimerRef.current) {
        window.clearTimeout(reasonTimerRef.current);
      }
      reasonTimerRef.current = window.setTimeout(
        () => setReasonSheetKey(selectedKey),
        880,
      );
    }
  };

  const updateRecord = (status: CheckStatus) => {
    if (selectedStatus === status) {
      if (status === "relapse") {
        setReasonSheetKey(selectedKey);
        return;
      }
      setFeedback(`第 ${selectedDay} 日已经记录为“${statusLabels[status]}”`);
      if (selectedDay === todayDay) setPanelCollapsed(true);
      return;
    }

    if (
      status === "success" &&
      selectedRecord?.status === "relapse" &&
      ((selectedRecord.reasons?.length ?? 0) > 0 || selectedRecord.note)
    ) {
      keyboard.hide();
      setReplaceConfirmOpen(true);
      return;
    }

    commitRecord(status);
  };

  const resetDemo = () => {
    keyboard.hide();
    setState(defaultState);
    setVisibleIndex(currentIndex);
    setSelectedDay(Math.min(todayDay, cycleMonths[currentIndex].days));
    setSecondaryOpen(false);
    setPanelCollapsed(false);
    setFeedback("石碑已恢复到初始状态");
    setResetConfirmOpen(false);
  };

  const exportBackup = (closeMenu = true) => {
    keyboard.hide();
    const exportedAt = new Date();
    const backup: BackupFile = {
      app: "石碑打卡",
      exportVersion: EXPORT_VERSION,
      exportedAt: localIsoTimestamp(exportedAt),
      records: Object.entries(state.records)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([date, record]): BackupRecord => ({
            date,
            status: record.status === "success" ? "checkin" : "relapse",
            ...(record.reasons?.length ? { reasons: record.reasons } : {}),
            ...(record.note ? { note: record.note } : {}),
            ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
          }),
        ),
      seals: Object.values(state.seals).sort((left, right) =>
        left.month.localeCompare(right.month),
      ),
    };
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
      type: "application/json;charset=utf-8",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `石碑打卡-备份-${dateKey(exportedAt)}.json`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    if (closeMenu) setSecondaryOpen(false);
    setFeedback(`已导出 ${backup.records.length} 条打卡记录`);
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const [file] = Array.from(input.files ?? []);
    if (!file) return;

    keyboard.hide();
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const nextState = parseBackupFile(parsed);
      if (!nextState) {
        setSecondaryOpen(false);
        setFeedback("文件格式不正确，无法导入");
        return;
      }

      const confirmed = window.confirm(
        "导入将覆盖当前所有本地记录，此操作不可撤销，确认导入吗？",
      );
      if (!confirmed) return;

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      setState(nextState);
      setVisibleIndex(currentIndex);
      setMonthDirection(1);
      setSelectedDay(Math.min(todayDay, cycleMonths[currentIndex].days));
      setPanelCollapsed(Boolean(nextState.records[dateKey(today)]));
      setSecondaryOpen(false);
      setFeedback(
        `导入成功，共恢复 ${Object.keys(nextState.records).length} 条记录`,
      );
      navigator.vibrate?.(18);
    } catch {
      setSecondaryOpen(false);
      setFeedback("文件格式不正确，无法导入");
    } finally {
      input.value = "";
    }
  };

  const expandCheckinPanel = () => {
    if (!isCurrentMonth || !panelCollapsed) return;
    keyboard.hide();
    setPanelCollapsed(false);
  };

  const handleCollapsedPanelKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (
      !isCurrentMonth ||
      !panelCollapsed ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }
    event.preventDefault();
    expandCheckinPanel();
  };

  const selectedRecordLabel = selectedStatus
    ? `已刻：${statusLabels[selectedStatus]}`
    : selectedDay > todayDay
      ? "尚未到来"
      : "等待落刻";
  const selectedReasonSummary = formatReasonSummary(selectedRecord);

  const openGallery = () => {
    keyboard.hide();
    flow.push(galleryScreen);
  };

  const openLeaderboard = () => {
    keyboard.hide();
    setSecondaryOpen(false);
    flow.push(leaderboardScreen);
  };

  const headerLabel = isCurrentMonth
    ? today.toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : `${visibleMonth.year}年${visibleMonth.month}月 · ${
        visibleMonthState === "complete" ? "已完成" : "尚未开始"
      }`;

  return (
    <MobileScroll className="app-screen">
      <main
        className="monument-app"
        data-level={currentLevel}
        data-testid="monument-app"
        data-visible-month={visibleMonth.key}
        aria-hidden={!isActiveScreen}
        inert={!isActiveScreen}
      >
        <Landscape level={currentLevel} />

        <header className="monument-header">
          <p className="eyebrow">{headerLabel}</p>
          <div className="secondary-controls" ref={secondaryControlsRef}>
            <button
              className="secondary-trigger"
              type="button"
              aria-label={
                secondaryOpen
                  ? "收起更多选项"
                  : "打开更多选项"
              }
              aria-expanded={secondaryOpen}
              aria-controls="secondary-panel"
              onClick={() => {
                keyboard.hide();
                setSecondaryOpen((open) => !open);
              }}
            >
              <span className="stone-menu-glyph" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="visually-hidden" data-testid="level-label">
                花草 {levelMeta[currentLevel as keyof typeof levelMeta].label}
              </span>
            </button>

            <div
              className={`secondary-panel ${secondaryOpen ? "is-open" : ""}`}
              id="secondary-panel"
              aria-hidden={!secondaryOpen}
              inert={!secondaryOpen}
            >
              <div className="growth-summary">
                <span>花草状态</span>
                <strong>
                  {levelMeta[currentLevel as keyof typeof levelMeta].label}
                </strong>
                <small>第 {currentLevel} 档 / 共 5 档</small>
              </div>
              <div
                className="secondary-menu-section backup-actions"
                aria-label="数据备份与恢复"
              >
                <span className="secondary-section-label">数据</span>
                <button type="button" onClick={() => exportBackup()}>
                  <span>导出备份</span>
                  <small>保存 JSON 文件</small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    keyboard.hide();
                    backupInputRef.current?.click();
                  }}
                >
                  <span>导入备份</span>
                  <small>覆盖本地记录</small>
                </button>
                <input
                  ref={backupInputRef}
                  className="backup-file-input"
                  type="file"
                  accept=".json,application/json"
                  aria-label="选择石碑打卡备份文件"
                  onChange={importBackup}
                />
              </div>
              <div
                className="secondary-menu-section app-actions"
                aria-label="应用设置"
              >
                <span className="secondary-section-label">应用</span>
                <button
                  className="leaderboard-menu-action"
                  type="button"
                  onClick={openLeaderboard}
                >
                  <span>线上排行</span>
                  <small>双榜 · 自愿加入</small>
                </button>
                <button
                  className="sound-toggle"
                  type="button"
                  aria-pressed={soundEnabled}
                  onClick={() => setSoundEnabled((enabled) => !enabled)}
                >
                  <span>落刻音效</span>
                  <small>{soundEnabled ? "已开启" : "已关闭"}</small>
                </button>
                <button
                  className="pwa-install-action"
                  type="button"
                  onClick={() => {
                    keyboard.hide();
                    setSecondaryOpen(false);
                    window.dispatchEvent(new CustomEvent("stone-pwa-install"));
                  }}
                >
                  <span>添加到桌面</span>
                  <small>安装为网页 App</small>
                </button>
              </div>
              {isCurrentMonth ? (
                <div
                  className="secondary-menu-section danger-actions"
                  aria-label="危险操作"
                >
                  <span className="secondary-section-label">危险操作</span>
                  <button
                    className="reset-button"
                    type="button"
                    onClick={() => {
                      keyboard.hide();
                      setSecondaryOpen(false);
                      setResetConfirmOpen(true);
                    }}
                  >
                    <span>恢复初始状态</span>
                    <small>清除全部本地数据</small>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section
          className="monument-scene"
          aria-label={`${visibleMonth.year}年${visibleMonth.month}月石碑记录`}
          data-scroll-drag="ignore"
          data-testid="month-swipe-area"
          {...bindMonthSwipe()}
        >
          <AnimatePresence
            initial={false}
            mode="popLayout"
            custom={monthDirection}
          >
            <motion.div
              key={visibleMonth.key}
              className="month-stone-transition"
              custom={monthDirection}
              variants={monthTransitionVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.32,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <StoneFigure
                month={visibleMonth}
                records={state.records}
                interactive={isCurrentMonth}
                selectedDay={isCurrentMonth ? selectedDay : undefined}
                availableThrough={isCurrentMonth ? todayDay : 0}
                activeCarving={activeCarving}
                onSelectDay={(day) => {
                  keyboard.hide();
                  setSelectedDay(day);
                  if (day !== todayDay) setPanelCollapsed(false);
                }}
              />
            </motion.div>
          </AnimatePresence>
        </section>

        {isCurrentMonth ? (
          <section
            className={`checkin-panel ${
              panelCollapsed ? "is-collapsed" : ""
            }`}
            aria-label={panelCollapsed ? "展开打卡操作" : "打卡操作"}
            role={panelCollapsed ? "button" : undefined}
            tabIndex={panelCollapsed ? 0 : undefined}
            onClick={expandCheckinPanel}
            onKeyDown={handleCollapsedPanelKeyDown}
            data-testid="checkin-panel"
            data-collapsed={panelCollapsed}
          >
            <div
              className="panel-collapsed-summary"
              aria-hidden={!panelCollapsed}
            >
              <span className="collapsed-mark" aria-hidden="true" />
              <span>第 {selectedDay} 日</span>
              <strong>{selectedRecordLabel}</strong>
            </div>

            <div
              className="panel-expanded-content"
              aria-hidden={panelCollapsed}
              inert={panelCollapsed}
            >
              <div className="panel-summary">
                <div>
                  <p>第 {selectedDay} 日</p>
                  <strong>{selectedRecordLabel}</strong>
                  {selectedReasonSummary ? (
                    <small className="selected-reason-summary">
                      {selectedReasonSummary}
                    </small>
                  ) : null}
                </div>
                <div className="rolling-score">
                  <span>当前档位</span>
                  <strong>{currentLevel}</strong>
                  <small>
                    / 5 ·{" "}
                    {levelMeta[currentLevel as keyof typeof levelMeta].label}
                  </small>
                </div>
              </div>

              <div className="checkin-actions">
                <button
                  className={`checkin-button checkin-button--success ${
                    selectedStatus === "success" ? "is-current" : ""
                  }`}
                  type="button"
                  disabled={
                    selectedDay > todayDay || selectedDay > visibleMonth.days
                  }
                  onClick={() => updateRecord("success")}
                  data-testid="success-button"
                  aria-pressed={selectedStatus === "success"}
                >
                  未破戒
                </button>
                <button
                  className={`checkin-button checkin-button--relapse ${
                    selectedStatus === "relapse" ? "is-current" : ""
                  }`}
                  type="button"
                  disabled={
                    selectedDay > todayDay || selectedDay > visibleMonth.days
                  }
                  onClick={() => updateRecord("relapse")}
                  data-testid="relapse-button"
                  aria-pressed={selectedStatus === "relapse"}
                >
                  破戒
                </button>
              </div>

              <div className="panel-utilities">
                <LeaderboardEntry onClick={openLeaderboard} />
                <HistoryEntry onClick={openGallery} />
              </div>
            </div>
          </section>
        ) : (
          <section
            className="checkin-panel checkin-panel--readonly"
            aria-label={`${visibleMonth.year}年${visibleMonth.month}月只读统计`}
            data-testid="readonly-month-panel"
          >
            <div className="readonly-heading">
              <div>
                <p>
                  {visibleMonth.year}年{visibleMonth.month}月
                </p>
                <strong>
                  {visibleMonthState === "complete"
                    ? "历史月份 · 只读"
                    : "本月尚未开始 · 只读"}
                </strong>
              </div>
              <span>{monthStats.scopeDays} / {visibleMonth.days} 日</span>
            </div>
            <MonthStatsRow stats={monthStats} className="month-stats--compact" />
            <div className="readonly-utilities">
              <span>不可补打卡或修改记录</span>
              <HistoryEntry onClick={openGallery} />
            </div>
          </section>
        )}

        <div
          className={`feedback-toast ${feedback ? "is-visible" : ""} ${
            isCurrentMonth && panelCollapsed ? "is-panel-collapsed" : ""
          }`}
          aria-live="polite"
        >
          {feedback}
        </div>

        <RelapseReasonSheet
          open={Boolean(reasonSheetKey)}
          dateLabel={
            reasonSheetKey
              ? `${Number(reasonSheetKey.slice(5, 7))}月${Number(
                  reasonSheetKey.slice(8, 10),
                )}日`
              : ""
          }
          record={
            reasonSheetKey ? state.records[reasonSheetKey] : undefined
          }
          onOpenChange={(open) => {
            if (!open) setReasonSheetKey(null);
          }}
          onSave={(reasons, note) => {
            if (!reasonSheetKey) return;
            const record = state.records[reasonSheetKey];
            if (!record || record.status !== "relapse") {
              setReasonSheetKey(null);
              return;
            }
            setState({
              ...state,
              records: {
                ...state.records,
                [reasonSheetKey]: {
                  ...record,
                  ...(reasons.length ? { reasons } : { reasons: undefined }),
                  ...(note ? { note } : { note: undefined }),
                  updatedAt: localIsoTimestamp(new Date()),
                },
              },
            });
            setReasonSheetKey(null);
            setFeedback(reasons.length || note ? "诱因已记下" : "已保存");
          }}
        />

        <AppSheet
          open={replaceConfirmOpen}
          onOpenChange={setReplaceConfirmOpen}
          title="改为未破戒？"
          description="原有破戒原因会随记录一起清除"
          compact
        >
          <div className="confirmation-sheet">
            <p>日期状态将被改写，已记录的诱因不会保留。</p>
            <div className="confirmation-actions">
              <button
                type="button"
                onClick={() => setReplaceConfirmOpen(false)}
              >
                取消
              </button>
              <button
                className="confirm-primary"
                type="button"
                onClick={() => {
                  setReplaceConfirmOpen(false);
                  commitRecord("success");
                }}
              >
                确认改写
              </button>
            </div>
          </div>
        </AppSheet>

        <AppSheet
          open={resetConfirmOpen}
          onOpenChange={setResetConfirmOpen}
          title="恢复初始状态"
          description="这是不可撤销的危险操作"
          compact
        >
          <div
            className="confirmation-sheet confirmation-sheet--danger"
            data-testid="reset-confirmation"
          >
            <p>将清除全部打卡记录、破戒原因与封碑记录，无法撤销。</p>
            <button
              className="backup-before-reset"
              type="button"
              onClick={() => exportBackup(false)}
            >
              先导出备份
            </button>
            <div className="confirmation-actions">
              <button type="button" onClick={() => setResetConfirmOpen(false)}>
                取消
              </button>
              <button
                className="confirm-danger"
                type="button"
                onClick={resetDemo}
              >
                确认清除
              </button>
            </div>
          </div>
        </AppSheet>
      </main>
    </MobileScroll>
  );
}

function GalleryScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today, state } = useMonument();
  const isActiveScreen = flow.current.id === "gallery";

  return (
    <MobileScroll className="gallery-screen">
      <main
        className="gallery-app"
        data-testid="gallery-page"
        aria-hidden={!isActiveScreen}
        inert={!isActiveScreen}
      >
        <header className="museum-header">
          <button
            className="museum-back"
            type="button"
            onClick={() => {
              keyboard.hide();
              flow.pop();
            }}
          >
            返回
          </button>
          <div>
            <h1>陈列室</h1>
            <p>七月至次年六月</p>
          </div>
        </header>

        <section className="museum-grid-panel" aria-label="十二个月石碑陈列">
          <div className="museum-grid">
            {cycleMonths.map((month) => {
              const stateForMonth = getMonthState(month, today);
              const isFuture = stateForMonth === "future";
              const isSealed = Boolean(state.seals[month.key]);
              return (
                <button
                  key={month.key}
                  className={`museum-tile ${
                    stateForMonth === "current" ? "is-current" : ""
                  } ${isFuture ? "is-future" : ""} ${
                    isSealed ? "is-sealed" : ""
                  }`}
                  type="button"
                  disabled={isFuture}
                  data-state={stateForMonth}
                  aria-label={`${month.year}年${month.month}月${
                    stateForMonth === "complete"
                      ? "，已完成"
                      : stateForMonth === "current"
                        ? "，本月进行中"
                        : "，尚未开始"
                  }`}
                  onClick={() => {
                    keyboard.hide();
                    flow.push(createDetailScreen(month));
                  }}
                >
                  <span className="museum-stone-frame">
                    <img
                      className="museum-stone-silhouette"
                      src={month.stone.image}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                    />
                    <img
                      className="museum-stone-surface"
                      src={month.stone.image}
                      alt=""
                      draggable={false}
                    />
                  </span>
                  <span className="museum-month-label">
                    <strong>{month.label}</strong>
                    <small>
                      {isSealed
                        ? "已封碑"
                        : stateForMonth === "complete"
                          ? "待封碑"
                        : stateForMonth === "current"
                          ? "进行中"
                          : "尚未开始"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="museum-footnote">
          历史月份可在封碑前补记；封存后转为只读史迹。
        </p>
      </main>
    </MobileScroll>
  );
}

function LeaderboardScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today, state } = useMonument();
  const isActiveScreen = flow.current.id === "leaderboard";
  const streaks = useMemo(
    () => calculateLongestStreaks(state.records, today),
    [state.records, today],
  );
  const [preferences, setPreferences] = useState(loadLeaderboardPreferences);
  const [publicId, setPublicId] = useState(preferences.publicId);
  const [joinOnline, setJoinOnline] = useState(preferences.isPublic);
  const [activeBoard, setActiveBoard] = useState<"ninja" | "rush">("ninja");
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLeaderboard(await fetchLeaderboard());
      setMessage("");
    } catch {
      setMessage("排行榜暂时无法读取，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreferences = async () => {
    keyboard.hide();
    const normalizedId = publicId.trim().normalize("NFC");
    if (joinOnline && !/^[\p{L}\p{N}_-]{3,16}$/u.test(normalizedId)) {
      setMessage("匿名 ID 需为 3—16 位中文、字母、数字、下划线或短横线");
      navigator.vibrate?.(10);
      return;
    }

    const nextPreferences: LeaderboardPreferences = {
      ownerToken: preferences.ownerToken,
      publicId: normalizedId || preferences.publicId,
      isPublic: joinOnline,
    };
    setSaving(true);
    setMessage(joinOnline ? "正在加入碑林……" : "正在退出线上排行……");
    try {
      await saveLeaderboardProfile(nextPreferences, streaks);
      persistLeaderboardPreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPublicId(nextPreferences.publicId);
      setMessage(
        joinOnline
          ? "已加入线上排行；今后的落刻会自动更新纪录。"
          : "已退出线上排行；线上资料已删除，本地记录不受影响。",
      );
      navigator.vibrate?.(18);
      try {
        setLeaderboard(await fetchLeaderboard());
      } catch {
        // Saving succeeded; a refresh failure should not reverse the preference.
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(
        detail && !/failed to fetch/i.test(detail)
          ? detail
          : "排行榜暂时无法更新，请稍后重试。",
      );
    } finally {
      setSaving(false);
    }
  };

  const entries = leaderboard?.[activeBoard] ?? [];
  const ownId = preferences.isPublic ? preferences.publicId : "";
  const boardMeta =
    activeBoard === "ninja"
      ? {
          title: "连续未破戒",
          value: streaks.ninjaDays,
          empty: "尚无人留下未破戒纪录",
        }
      : {
          title: "连续破戒",
          value: streaks.rushDays,
          empty: "尚无人留下破戒纪录",
        };

  return (
    <MobileScroll className="leaderboard-screen">
      <main
        className="leaderboard-app"
        data-testid="leaderboard-page"
        aria-hidden={!isActiveScreen}
        inert={!isActiveScreen}
      >
        <header className="museum-header leaderboard-header">
          <button
            className="museum-back"
            type="button"
            onClick={() => {
              keyboard.hide();
              flow.pop();
            }}
          >
            返回
          </button>
          <div>
            <h1>碑林排行</h1>
            <p>只见纪录，不见私事</p>
          </div>
        </header>

        <section className="leaderboard-privacy-card" aria-label="线上排行设置">
          <div className="leaderboard-privacy-heading">
            <div>
              <span>线上留名</span>
              <strong>{joinOnline ? "已选择加入" : "保持私密"}</strong>
            </div>
            <button
              className={`leaderboard-switch ${joinOnline ? "is-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={joinOnline}
              aria-label="加入线上排行"
              onClick={() => setJoinOnline((joined) => !joined)}
            >
              <i />
            </button>
          </div>

          <label className="leaderboard-id-field">
            <span>匿名 ID</span>
            <KeyboardInput
              value={publicId}
              maxLength={16}
              disabled={!joinOnline || saving}
              autoComplete="off"
              spellCheck={false}
              placeholder="例如：山中石客"
              onChange={(event) => setPublicId(event.currentTarget.value)}
            />
          </label>

          <dl className="leaderboard-local-records">
            <div>
              <dt>最长未破戒</dt>
              <dd>{streaks.ninjaDays}<small>天</small></dd>
            </div>
            <div>
              <dt>最长破戒</dt>
              <dd>{streaks.rushDays}<small>天</small></dd>
            </div>
          </dl>

          <p className="leaderboard-privacy-note">
            仅上传匿名 ID、参榜状态和两项最长连续天数；每日记录、诱因与备注始终留在本机。
          </p>
          <button
            className="leaderboard-save"
            type="button"
            disabled={saving}
            onClick={() => void savePreferences()}
          >
            {saving ? "正在保存" : joinOnline ? "保存并加入" : "确认退出排行"}
          </button>
          {message ? (
            <p className="leaderboard-message" role="status">
              {message}
            </p>
          ) : null}
        </section>

        <section className="leaderboard-board" aria-label="线上排行榜">
          <div className="leaderboard-tabs" role="tablist" aria-label="选择榜单">
            <button
              className={activeBoard === "ninja" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={activeBoard === "ninja"}
              onClick={() => setActiveBoard("ninja")}
            >
              未破戒榜
            </button>
            <button
              className={activeBoard === "rush" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={activeBoard === "rush"}
              onClick={() => setActiveBoard("rush")}
            >
              破戒榜
            </button>
          </div>

          <div className="leaderboard-board-heading">
            <div>
              <span>历史最长连续</span>
              <h2>{boardMeta.title}</h2>
            </div>
            <strong>{boardMeta.value}<small>天 · 本机</small></strong>
          </div>

          {loading ? (
            <div className="leaderboard-empty">正在读取碑林……</div>
          ) : entries.length ? (
            <ol className="leaderboard-list">
              {entries.map((entry) => (
                <li
                  key={`${activeBoard}-${entry.publicId}`}
                  className={entry.publicId === ownId ? "is-self" : ""}
                >
                  <span className={`leaderboard-rank rank-${entry.rank}`}>
                    {entry.rank <= 3 ? ["Ⅰ", "Ⅱ", "Ⅲ"][entry.rank - 1] : entry.rank}
                  </span>
                  <span className="leaderboard-name">
                    {entry.publicId}
                    {entry.publicId === ownId ? <small>我</small> : null}
                  </span>
                  <strong>{entry.days}<small>天</small></strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="leaderboard-empty">{boardMeta.empty}</div>
          )}

          <footer className="leaderboard-board-footer">
            <span>漏记会中断连续天数</span>
            <button type="button" disabled={loading} onClick={() => void refresh()}>
              刷新
            </button>
          </footer>
        </section>
      </main>
    </MobileScroll>
  );
}

function MonthDetailScreen({ month }: { month: CycleMonth }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today, state, setState, setFeedback } = useMonument();
  const stateForMonth = getMonthState(month, today);
  const stats = getMonthStats(month, today, state.records);
  const seal = state.seals[month.key];
  const firstMissingDay = Math.max(
    1,
    Array.from({ length: month.days }, (_, index) => index + 1).find(
      (day) => !state.records[`${monthPrefix(month)}${pad(day)}`],
    ) ?? month.days,
  );
  const [reasonDay, setReasonDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(firstMissingDay);
  const [historyEditing, setHistoryEditing] = useState(false);
  const [sealPromptOpen, setSealPromptOpen] = useState<boolean>(
    stateForMonth === "complete" && !seal,
  );
  const [unsealConfirmOpen, setUnsealConfirmOpen] = useState(false);
  const [sealCeremony, setSealCeremony] = useState(false);
  const reasonKey =
    reasonDay === null ? null : `${monthPrefix(month)}${pad(reasonDay)}`;
  const selectedKey = `${monthPrefix(month)}${pad(selectedDay)}`;
  const selectedRecord = state.records[selectedKey];

  const writeHistoryRecord = (status: CheckStatus) => {
    if (stateForMonth !== "complete" || seal) return;
    keyboard.hide();
    const previousRecord = state.records[selectedKey];
    setState({
      ...state,
      records: {
        ...state.records,
        [selectedKey]: {
          status,
          updatedAt: localIsoTimestamp(new Date()),
          ...(status === "relapse" && previousRecord?.status === "relapse"
            ? {
                ...(previousRecord.reasons?.length
                  ? { reasons: previousRecord.reasons }
                  : {}),
                ...(previousRecord.note ? { note: previousRecord.note } : {}),
              }
            : {}),
        },
      },
    });
    setFeedback(
      `${month.month}月${selectedDay}日已补记为“${statusLabels[status]}”`,
    );
    navigator.vibrate?.(status === "success" ? 14 : [16, 24, 16]);
    if (status === "relapse") {
      window.setTimeout(() => setReasonDay(selectedDay), 360);
    }
  };

  const clearHistoryRecord = () => {
    if (stateForMonth !== "complete" || seal || !selectedRecord) return;
    const records = { ...state.records };
    delete records[selectedKey];
    setState({ ...state, records });
    setFeedback(`${month.month}月${selectedDay}日记录已清除`);
  };

  const sealMonth = () => {
    if (stateForMonth !== "complete" || seal) return;
    keyboard.hide();
    const nextSeal = createMonthSeal(month, state.records);
    setSealPromptOpen(false);
    setHistoryEditing(false);
    setState({
      ...state,
      seals: {
        ...state.seals,
        [month.key]: nextSeal,
      },
    });
    setSealCeremony(true);
    navigator.vibrate?.([16, 54, 26]);
    window.setTimeout(() => setSealCeremony(false), 2500);
    setFeedback(`${month.year}年${month.month}月已封碑`);
  };

  const unsealMonth = () => {
    if (!seal) return;
    const seals = { ...state.seals };
    delete seals[month.key];
    setState({ ...state, seals });
    setUnsealConfirmOpen(false);
    setHistoryEditing(true);
    setFeedback("石碑已启封，修改后请重新封存");
  };

  const epitaph = seal ? sealEpitaph(seal) : [];
  const sealedDate = seal
    ? new Date(seal.sealedAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <MobileScroll className="gallery-screen">
      <main
        className={`month-detail ${sealCeremony ? "is-sealing" : ""}`}
        data-testid="month-detail-page"
        data-sealed={Boolean(seal)}
      >
        <header className="museum-header month-detail-header">
          <button
            className="museum-back"
            type="button"
            onClick={() => {
              keyboard.hide();
              flow.pop();
            }}
          >
            返回
          </button>
          <div>
            <h1>
              {month.year}年{month.month}月
            </h1>
            <p>
              {stateForMonth === "current"
                ? "本月进行中，数据截至今日"
                : seal
                  ? "历史月份 · 已封碑"
                  : historyEditing
                    ? "历史月份 · 补记中"
                    : "历史月份 · 待封碑"}
            </p>
          </div>
        </header>

        <section
          className={`detail-stone-wrap ${
            sealCeremony ? "is-sealing" : ""
          }`}
          aria-label={`${month.year}年${month.month}月完整石碑`}
        >
          <StoneFigure
            month={month}
            records={state.records}
            interactive={historyEditing && !seal}
            selectedDay={selectedDay}
            availableThrough={month.days}
            onSelectDay={setSelectedDay}
            onInspectRelapse={!seal && !historyEditing ? setReasonDay : undefined}
            detail
          />
          {sealCeremony ? (
            <div className="seal-ceremony-overlay" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          ) : null}
        </section>

        <section className="detail-stats-panel" aria-label="当月打卡统计">
          {stateForMonth === "current" ? (
            <p className="detail-progress-note">本月进行中，数据截至今日</p>
          ) : null}
          <MonthStatsRow stats={stats} />
          <p className="detail-total">
            三项合计 {stats.scopeDays} 日
            {stateForMonth === "complete" ? ` · 本月共 ${month.days} 日` : ""}
          </p>
        </section>

        {historyEditing && !seal ? (
          <section
            className="history-edit-panel"
            data-testid="history-edit-panel"
            aria-label="历史月份补记"
          >
            <div className="history-edit-heading">
              <div>
                <small>正在补记</small>
                <strong>
                  {month.month}月{selectedDay}日
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setHistoryEditing(false)}
              >
                完成
              </button>
            </div>
            <div className="history-edit-actions">
              <button
                className={
                  selectedRecord?.status === "success" ? "is-active" : ""
                }
                type="button"
                onClick={() => writeHistoryRecord("success")}
              >
                未破戒
              </button>
              <button
                className={
                  selectedRecord?.status === "relapse"
                    ? "is-active is-relapse"
                    : ""
                }
                type="button"
                onClick={() => writeHistoryRecord("relapse")}
              >
                破戒
              </button>
              <button
                className="history-clear"
                type="button"
                disabled={!selectedRecord}
                onClick={clearHistoryRecord}
              >
                清除
              </button>
            </div>
          </section>
        ) : null}

        {stateForMonth === "complete" && !seal && !historyEditing ? (
          <section className="seal-entry-panel" data-testid="seal-entry-panel">
            <div>
              <small>此月已尽</small>
              <strong>补全记录后，将它封存为一块史迹。</strong>
            </div>
            <div>
              <button type="button" onClick={() => setHistoryEditing(true)}>
                补记本月
              </button>
              <button
                className="seal-primary-action"
                type="button"
                onClick={() => setSealPromptOpen(true)}
              >
                封存本月
              </button>
            </div>
          </section>
        ) : null}

        {seal ? (
          <section className="sealed-record" data-testid="sealed-record">
            <span className="seal-emblem" aria-hidden="true">
              封
            </span>
            <div className="seal-epitaph">
              {epitaph.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <dl className="seal-summary">
              <div>
                <dt>最长连续</dt>
                <dd>{seal.summary.longestStreak} 日</dd>
              </div>
              <div>
                <dt>常见诱因</dt>
                <dd>
                  {seal.summary.topReasons.length
                    ? seal.summary.topReasons
                        .map((reason) => relapseReasonMeta[reason].shortLabel)
                        .join(" · ")
                    : "未记录"}
                </dd>
              </div>
              <div>
                <dt>草木档位</dt>
                <dd>
                  {seal.summary.vegetationLevel} ·{" "}
                  {
                    levelMeta[
                      seal.summary
                        .vegetationLevel as keyof typeof levelMeta
                    ].label
                  }
                </dd>
              </div>
              <div>
                <dt>封碑日期</dt>
                <dd>{sealedDate}</dd>
              </div>
            </dl>
            <button
              className="unseal-action"
              type="button"
              onClick={() => setUnsealConfirmOpen(true)}
            >
              启封修改
            </button>
          </section>
        ) : null}

        <RelapseReasonSheet
          open={reasonDay !== null && !seal}
          dateLabel={
            reasonDay === null ? "" : `${month.month}月${reasonDay}日`
          }
          record={reasonKey ? state.records[reasonKey] : undefined}
          onOpenChange={(open) => {
            if (!open) setReasonDay(null);
          }}
          onSave={(reasons, note) => {
            if (!reasonKey) return;
            const record = state.records[reasonKey];
            if (!record || record.status !== "relapse") {
              setReasonDay(null);
              return;
            }
            setState({
              ...state,
              records: {
                ...state.records,
                [reasonKey]: {
                  ...record,
                  ...(reasons.length ? { reasons } : { reasons: undefined }),
                  ...(note ? { note } : { note: undefined }),
                  updatedAt: localIsoTimestamp(new Date()),
                },
              },
            });
            setReasonDay(null);
            setFeedback("诱因记录已更新");
          }}
        />

        <AppSheet
          open={sealPromptOpen && stateForMonth === "complete" && !seal}
          onOpenChange={setSealPromptOpen}
          title="此月已尽，是否封碑留存？"
          description="封碑后转为只读；需要时仍可启封修改。"
          compact
        >
          <div className="seal-prompt" data-testid="seal-prompt">
            <MonthStatsRow stats={stats} className="month-stats--compact" />
            <div className="seal-prompt-actions">
              <button
                type="button"
                onClick={() => {
                  setSealPromptOpen(false);
                  setHistoryEditing(true);
                }}
              >
                先补记
              </button>
              <button type="button" onClick={() => setSealPromptOpen(false)}>
                暂不封碑
              </button>
              <button
                className="seal-primary-action"
                type="button"
                onClick={sealMonth}
              >
                封存本月
              </button>
            </div>
          </div>
        </AppSheet>

        <AppSheet
          open={unsealConfirmOpen}
          onOpenChange={setUnsealConfirmOpen}
          title="启封这块月碑？"
          description="启封后可补记或修改；原碑文会失效，完成后需重新封碑。"
          compact
        >
          <div className="unseal-confirmation" data-testid="unseal-confirmation">
            <button type="button" onClick={() => setUnsealConfirmOpen(false)}>
              取消
            </button>
            <button type="button" onClick={unsealMonth}>
              确认启封
            </button>
          </div>
        </AppSheet>
      </main>
    </MobileScroll>
  );
}

const homeScreen: FlowScreen = {
  id: "home",
  render: () => <HomeScreen />,
};

const galleryScreen: FlowScreen = {
  id: "gallery",
  render: () => <GalleryScreen />,
};

const leaderboardScreen: FlowScreen = {
  id: "leaderboard",
  render: () => <LeaderboardScreen />,
};

function createDetailScreen(month: CycleMonth): FlowScreen {
  return {
    id: `month-${month.key}`,
    render: () => <MonthDetailScreen month={month} />,
  };
}

function LeaderboardSync() {
  const { today, state } = useMonument();
  const [preferences, setPreferences] = useState(loadLeaderboardPreferences);
  const streaks = useMemo(
    () => calculateLongestStreaks(state.records, today),
    [state.records, today],
  );

  useEffect(() => {
    const reload = () => setPreferences(loadLeaderboardPreferences());
    window.addEventListener(LEADERBOARD_PREFERENCES_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(LEADERBOARD_PREFERENCES_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  useEffect(() => {
    if (!preferences.isPublic) return;
    const timer = window.setTimeout(() => {
      void saveLeaderboardProfile(preferences, streaks).catch(() => {
        // Online sync is best-effort; local recording must never be blocked.
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [preferences, streaks]);

  return null;
}

export default function Prototype() {
  const today = useMemo(resolveToday, []);
  const [state, setState] = useState<StoredState>(loadState);
  const [feedback, setFeedback] = useState("");
  const currentLevel = useMemo(
    () => calculateLevel(state.records),
    [state.records],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const contextValue = useMemo<MonumentContextValue>(
    () => ({
      today,
      state,
      setState,
      currentLevel,
      feedback,
      setFeedback,
    }),
    [currentLevel, feedback, state, today],
  );

  return (
    <MonumentContext.Provider value={contextValue}>
      <FlowStack initial={homeScreen} />
      <LeaderboardSync />
      <PwaManager />
    </MonumentContext.Provider>
  );
}
