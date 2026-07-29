import { useCallback, useEffect, useRef, useState } from "react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const INSTALL_EVENT = "stone-pwa-install";

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PwaManager() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
  const [standalone, setStandalone] = useState(isStandaloneMode);
  const reloadingForUpdate = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.pwaStandalone = String(standalone);
    return () => {
      delete document.documentElement.dataset.pwaStandalone;
    };
  }, [standalone]);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallGuideOpen(false);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const requestInstall = useCallback(async () => {
    if (isStandaloneMode()) {
      setStandalone(true);
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setStandalone(true);
      setInstallPrompt(null);
      return;
    }

    setInstallGuideOpen(true);
  }, [installPrompt]);

  useEffect(() => {
    const openInstall = () => {
      void requestInstall();
    };
    window.addEventListener(INSTALL_EVENT, openInstall);
    return () => window.removeEventListener(INSTALL_EVENT, openInstall);
  }, [requestInstall]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `${import.meta.env.BASE_URL}pwa-sw.js`,
          { scope: import.meta.env.BASE_URL },
        );

        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateWorker(worker);
            }
          });
        });

        void registration.update();
      } catch (error) {
        console.warn("PWA service worker registration failed", error);
      }
    };

    if (document.readyState === "complete") {
      void registerWorker();
    } else {
      window.addEventListener("load", registerWorker, { once: true });
    }

    const checkForUpdate = () => {
      void navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL).then(
        (registration) => registration?.update(),
      );
    };
    window.addEventListener("focus", checkForUpdate);

    const reloadOnControllerChange = () => {
      if (reloadingForUpdate.current) return;
      reloadingForUpdate.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      reloadOnControllerChange,
    );

    return () => {
      window.removeEventListener("load", registerWorker);
      window.removeEventListener("focus", checkForUpdate);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        reloadOnControllerChange,
      );
    };
  }, []);

  const appleMobile = isAppleMobile();

  return (
    <>
      {installGuideOpen ? (
        <div
          className="pwa-dialog-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setInstallGuideOpen(false);
          }}
        >
          <section
            className="pwa-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-dialog-title"
            data-testid="pwa-install-guide"
          >
            <div className="pwa-dialog-icon" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}icons/pwa-192.png`}
                alt=""
              />
            </div>
            <div className="pwa-dialog-copy">
              <p>独立网页 App</p>
              <h2 id="pwa-dialog-title">
                {appleMobile ? "添加到 iPhone 主屏幕" : "安装“冲了吗”"}
              </h2>
              {appleMobile ? (
                <ol>
                  <li>使用 Safari 打开当前页面</li>
                  <li>轻点浏览器底部的“分享”按钮</li>
                  <li>选择“添加到主屏幕”，再轻点“添加”</li>
                </ol>
              ) : (
                <p className="pwa-dialog-note">
                  打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。安装后将以独立全屏窗口打开。
                </p>
              )}
              <small>打卡记录仍保存在本机，请继续定期导出备份。</small>
            </div>
            <button
              className="pwa-dialog-close"
              type="button"
              onClick={() => setInstallGuideOpen(false)}
            >
              知道了
            </button>
          </section>
        </div>
      ) : null}

      {updateWorker ? (
        <aside className="pwa-update-toast" aria-live="polite">
          <div>
            <strong>新版本已准备好</strong>
            <span>更新不会影响本机打卡记录</span>
          </div>
          <button
            type="button"
            onClick={() => updateWorker.postMessage({ type: "SKIP_WAITING" })}
          >
            立即更新
          </button>
        </aside>
      ) : null}
    </>
  );
}
