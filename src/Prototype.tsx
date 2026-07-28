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
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion } from "motion/react";
import { getMonthStone, type MonthStone } from "./month-stones";
import {
  FlowStack,
  MobileScroll,
  type FlowScreen,
  useFlow,
  useKeyboard,
} from "./mobile";

type CheckStatus = "success" | "relapse";
type MonthState = "complete" | "current" | "future";

type StoredState = {
  records: Record<string, CheckStatus>;
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

type MonumentContextValue = {
  today: Date;
  state: StoredState;
  setState: Dispatch<SetStateAction<StoredState>>;
  currentLevel: number;
  feedback: string;
  setFeedback: Dispatch<SetStateAction<string>>;
};

const STORAGE_KEY = "stone-checkin-demo-v1";
const HISTORY_START_YEAR = 2026;
const HISTORY_START_MONTH = 7;

const levelMeta = {
  1: { label: "枯萎", image: "/assets/scene/source/level-1-wilted.jpg" },
  2: { label: "稀疏", image: "/assets/scene/source/level-2-sparse.jpg" },
  3: { label: "正常", image: "/assets/scene/source/level-3-normal.jpg" },
  4: { label: "茂盛", image: "/assets/scene/source/level-4-lush.jpg" },
  5: { label: "繁盛", image: "/assets/scene/source/level-5-blooming.jpg" },
} as const;

const defaultState: StoredState = {
  records: {},
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

function calculateLevel(records: Record<string, CheckStatus>) {
  return Object.keys(records)
    .sort()
    .reduce((level, key) => {
      const change = records[key] === "success" ? 1 : -1;
      return Math.max(1, Math.min(5, level + change));
    }, 3);
}

function loadState(): StoredState {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return defaultState;
    const parsed = JSON.parse(value) as Partial<StoredState>;
    return {
      records: parsed.records ?? {},
    };
  } catch {
    return defaultState;
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
  records: Record<string, CheckStatus>,
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
    const status = records[`${prefix}${pad(day)}`];
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
  detail = false,
}: {
  month: CycleMonth;
  records: Record<string, CheckStatus>;
  interactive?: boolean;
  selectedDay?: number;
  availableThrough?: number;
  onSelectDay?: (day: number) => void;
  detail?: boolean;
}) {
  const prefix = monthPrefix(month);

  return (
    <div
      className={`stone-stage ${detail ? "stone-stage--detail" : ""}`}
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
          const status = records[`${prefix}${pad(anchor.day)}`];
          if (!status) return null;
          const style = {
            "--anchor-x": `${anchor.x}%`,
            "--anchor-y": `${anchor.y}%`,
            "--anchor-width": `${anchor.width}%`,
            "--anchor-rotation": `${anchor.rotation}deg`,
          } as CSSProperties;

          return (
            <img
              key={`mark-${anchor.day}`}
              className={`date-mark date-mark--${status}`}
              src={
                status === "success"
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
      </div>
    </div>
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
  const secondaryControlsRef = useRef<HTMLDivElement>(null);

  const selectedDate = dateForDay(visibleMonth, selectedDay);
  const selectedKey = dateKey(selectedDate);
  const selectedStatus = state.records[selectedKey];

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

  const updateRecord = (status: CheckStatus) => {
    if (
      !isCurrentMonth ||
      selectedDay > todayDay ||
      selectedDay > visibleMonth.days
    ) {
      return;
    }
    keyboard.hide();
    if (selectedStatus === status) {
      setFeedback(`第 ${selectedDay} 日已经记录为“${statusLabels[status]}”`);
      if (selectedDay === todayDay) setPanelCollapsed(true);
      return;
    }

    const records = { ...state.records, [selectedKey]: status };
    const nextLevel = calculateLevel(records);
    setState({ records });

    navigator.vibrate?.(status === "success" ? 18 : [20, 30, 20]);
    setFeedback(
      `第 ${selectedDay} 日已${selectedStatus ? "改为" : "记录为"}“${
        statusLabels[status]
      }” · 档位 ${currentLevel} → ${nextLevel}`,
    );
    if (selectedDay === todayDay) setPanelCollapsed(true);
  };

  const clearSelectedRecord = () => {
    if (!isCurrentMonth || !selectedStatus) return;
    keyboard.hide();
    const records = { ...state.records };
    delete records[selectedKey];
    const nextLevel = calculateLevel(records);
    setState({ records });
    setPanelCollapsed(false);
    setFeedback(
      `已清除第 ${selectedDay} 日记录 · 档位 ${currentLevel} → ${nextLevel}`,
    );
  };

  const resetDemo = () => {
    keyboard.hide();
    setState(defaultState);
    setVisibleIndex(currentIndex);
    setSelectedDay(Math.min(todayDay, cycleMonths[currentIndex].days));
    setSecondaryOpen(false);
    setPanelCollapsed(false);
    setFeedback("石碑已恢复到初始状态");
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

  const openGallery = () => {
    keyboard.hide();
    flow.push(galleryScreen);
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
                  ? "收起花草状态和重置选项"
                  : "打开花草状态和重置选项"
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
              {isCurrentMonth ? (
                <button
                  className="reset-button"
                  type="button"
                  onClick={resetDemo}
                >
                  恢复初始状态
                </button>
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
                <button
                  className="clear-record"
                  type="button"
                  disabled={!selectedStatus}
                  onClick={clearSelectedRecord}
                >
                  清除本日记录
                </button>
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
      </main>
    </MobileScroll>
  );
}

function GalleryScreen() {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today } = useMonument();
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
              return (
                <button
                  key={month.key}
                  className={`museum-tile ${
                    stateForMonth === "current" ? "is-current" : ""
                  } ${isFuture ? "is-future" : ""}`}
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
                      src={month.stone.image}
                      alt=""
                      draggable={false}
                    />
                  </span>
                  <span className="museum-month-label">
                    <strong>{month.label}</strong>
                    <small>
                      {stateForMonth === "complete"
                        ? "已完成"
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
          历史月份仅供回看，不提供补打卡或修改入口。
        </p>
      </main>
    </MobileScroll>
  );
}

function MonthDetailScreen({ month }: { month: CycleMonth }) {
  const flow = useFlow();
  const keyboard = useKeyboard();
  const { today, state } = useMonument();
  const stateForMonth = getMonthState(month, today);
  const stats = getMonthStats(month, today, state.records);

  return (
    <MobileScroll className="gallery-screen">
      <main className="month-detail" data-testid="month-detail-page">
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
                : "历史月份 · 只读"}
            </p>
          </div>
        </header>

        <section
          className="detail-stone-wrap"
          aria-label={`${month.year}年${month.month}月完整石碑`}
        >
          <StoneFigure
            month={month}
            records={state.records}
            detail
          />
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

function createDetailScreen(month: CycleMonth): FlowScreen {
  return {
    id: `month-${month.key}`,
    render: () => <MonthDetailScreen month={month} />,
  };
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
    </MonumentContext.Provider>
  );
}
