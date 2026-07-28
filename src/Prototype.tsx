import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { getMonthStone } from "./month-stones";
import { MobileScroll, useKeyboard } from "./mobile";

type CheckStatus = "success" | "relapse";

type StoredState = {
  records: Record<string, CheckStatus>;
};

const STORAGE_KEY = "stone-checkin-demo-v1";

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateForDay(reference: Date, day: number) {
  return new Date(reference.getFullYear(), reference.getMonth(), day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function resolveToday() {
  if (window.location.hostname === "terminal.local") {
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

export default function Prototype() {
  const keyboard = useKeyboard();
  const today = useMemo(resolveToday, []);
  const todayDay = today.getDate();
  const monthStone = useMemo(() => getMonthStone(today.getMonth() + 1), [today]);
  const calendarMonthDays = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();
  const monthDays = Math.min(calendarMonthDays, monthStone.days);
  const [selectedDay, setSelectedDay] = useState(Math.min(todayDay, monthDays));
  const [state, setState] = useState<StoredState>(loadState);
  const [feedback, setFeedback] = useState("");
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(
    () => Boolean(state.records[dateKey(today)]),
  );
  const secondaryControlsRef = useRef<HTMLDivElement>(null);

  const selectedDate = dateForDay(today, selectedDay);
  const selectedKey = dateKey(selectedDate);
  const selectedStatus = state.records[selectedKey];
  const currentLevel = useMemo(
    () => calculateLevel(state.records),
    [state.records],
  );
  const visibleMonthPrefix = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-`;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

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

  const updateRecord = (status: CheckStatus) => {
    if (selectedDay > todayDay || selectedDay > monthDays) return;
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
    if (!selectedStatus) return;
    keyboard.hide();
    const records = { ...state.records };
    delete records[selectedKey];
    const nextLevel = calculateLevel(records);
    setState({ records });
    setPanelCollapsed(false);
    setFeedback(`已清除第 ${selectedDay} 日记录 · 档位 ${currentLevel} → ${nextLevel}`);
  };

  const resetDemo = () => {
    keyboard.hide();
    setState(defaultState);
    setSelectedDay(Math.min(todayDay, monthDays));
    setSecondaryOpen(false);
    setPanelCollapsed(false);
    setFeedback("石碑已恢复到初始状态");
  };

  const expandCheckinPanel = () => {
    if (!panelCollapsed) return;
    keyboard.hide();
    setPanelCollapsed(false);
  };

  const handleCollapsedPanelKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    if (!panelCollapsed || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    expandCheckinPanel();
  };

  const selectedRecordLabel = selectedStatus
    ? `已刻：${statusLabels[selectedStatus]}`
    : selectedDay > todayDay
      ? "尚未到来"
      : "等待落刻";

  return (
    <MobileScroll className="app-screen">
      <main
        className="monument-app"
        data-level={currentLevel}
        data-testid="monument-app"
      >
        <div className="landscape" aria-hidden="true">
          <img
            className="landscape-base"
            src={levelMeta[3].image}
            alt=""
            draggable={false}
          />
          {Object.entries(levelMeta).map(([level, meta]) => (
            <img
              key={level}
              className={`landscape-ground ${
                Number(level) === currentLevel ? "is-active" : ""
              }`}
              src={meta.image}
              alt=""
              draggable={false}
            />
          ))}
          <div className="landscape-wash" />
        </div>

        <header className="monument-header">
          <p className="eyebrow">
            {today.toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </p>
          <div className="secondary-controls" ref={secondaryControlsRef}>
            <button
              className="secondary-trigger"
              type="button"
              aria-label={secondaryOpen ? "收起花草状态和重置选项" : "打开花草状态和重置选项"}
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
                <strong>{levelMeta[currentLevel as keyof typeof levelMeta].label}</strong>
                <small>第 {currentLevel} 档 / 共 5 档</small>
              </div>
              <button className="reset-button" type="button" onClick={resetDemo}>
                恢复初始状态
              </button>
            </div>
          </div>
        </header>

        <section className="monument-scene" aria-label="本月石碑打卡记录">
          <div
            className="stone-stage"
            style={
              {
                "--stone-stage-width": monthStone.stageWidth,
              } as CSSProperties
            }
          >
            <img
              className="stone-image"
              src={monthStone.image}
              alt={monthStone.alt}
              draggable={false}
              data-testid="stone-image"
            />

            <div className="stone-overlays">
              {monthStone.anchors.map((anchor) => {
                const key = `${visibleMonthPrefix}${pad(anchor.day)}`;
                const status = state.records[key];
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

              {monthStone.anchors.map((anchor) => {
                const unavailable = anchor.day > todayDay || anchor.day > monthDays;
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
                    onClick={() => {
                      keyboard.hide();
                      setSelectedDay(anchor.day);
                      if (anchor.day !== todayDay) setPanelCollapsed(false);
                    }}
                    style={style}
                  />
                );
              })}
            </div>
          </div>
        </section>

        <section
          className={`checkin-panel ${panelCollapsed ? "is-collapsed" : ""}`}
          aria-label={panelCollapsed ? "展开打卡操作" : "打卡操作"}
          role={panelCollapsed ? "button" : undefined}
          tabIndex={panelCollapsed ? 0 : undefined}
          onClick={expandCheckinPanel}
          onKeyDown={handleCollapsedPanelKeyDown}
          data-testid="checkin-panel"
          data-collapsed={panelCollapsed}
        >
          <div className="panel-collapsed-summary" aria-hidden={!panelCollapsed}>
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
                <small>/ 5 · {levelMeta[currentLevel as keyof typeof levelMeta].label}</small>
              </div>
            </div>

            <div className="checkin-actions">
              <button
                className={`checkin-button checkin-button--success ${
                  selectedStatus === "success" ? "is-current" : ""
                }`}
                type="button"
                disabled={selectedDay > todayDay || selectedDay > monthDays}
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
                disabled={selectedDay > todayDay || selectedDay > monthDays}
                onClick={() => updateRecord("relapse")}
                data-testid="relapse-button"
                aria-pressed={selectedStatus === "relapse"}
              >
                破戒
              </button>
            </div>

            <button
              className="clear-record"
              type="button"
              disabled={!selectedStatus}
              onClick={clearSelectedRecord}
            >
              清除本日记录
            </button>
          </div>
        </section>

        <div
          className={`feedback-toast ${feedback ? "is-visible" : ""} ${
            panelCollapsed ? "is-panel-collapsed" : ""
          }`}
          aria-live="polite"
        >
          {feedback}
        </div>
      </main>
    </MobileScroll>
  );
}
