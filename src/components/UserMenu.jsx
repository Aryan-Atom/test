import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n.jsx";
import { getUserInfo, getUserDisplayName, getUserEmail } from "../utils/cookieUtils.js";
import { performLogout } from "../utils/logout.js";

function getMenuPosition(buttonEl) {
  if (!buttonEl) return null;
  const rect = buttonEl.getBoundingClientRect();
  return {
    top: rect.bottom + 8,
    right: Math.max(8, window.innerWidth - rect.right),
  };
}

export default function UserMenu() {
  const { t } = useI18n();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);

  const userInfo = getUserInfo();
  const userName = getUserDisplayName(userInfo) || t("app.user");
  const userEmail = getUserEmail(userInfo);
  const userInitial =
    String(userName || "User")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";
  const appVersion = import.meta.env.VITE_APP_VERSION || "v3.7.0";

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      setMenuPosition(getMenuPosition(buttonRef.current));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        menuRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsOpen(false);
    await performLogout();
  };

  const menuPanel =
    isOpen && menuPosition
      ? createPortal(
          <div
            ref={panelRef}
            className="eq-user-menu-panel eq-user-menu-panel--fixed"
            role="menu"
            style={{
              top: menuPosition.top,
              right: menuPosition.right,
            }}
          >
            <div className="eq-user-menu-header">
              <div className="eq-user-menu-avatar">{userInitial}</div>
              <div className="eq-user-menu-name">{userName}</div>
              {userEmail ? (
                <div className="eq-user-menu-email">{userEmail}</div>
              ) : null}
            </div>

            <div className="eq-user-menu-divider" />

            <button
              type="button"
              className="eq-user-menu-logout"
              role="menuitem"
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              <i
                className={`fas ${isLoggingOut ? "fa-spinner fa-spin" : "fa-right-from-bracket"}`}
              />
              <span>{t("app.logout", "Logout")}</span>
            </button>

            <div className="eq-user-menu-divider" />

            <div className="eq-user-menu-version">{appVersion}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="eq-user-menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="eq-user-button"
        aria-label={userName}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={userName}
        onClick={() => setIsOpen((open) => !open)}
      >
        {userInitial}
      </button>
      {menuPanel}
    </div>
  );
}
