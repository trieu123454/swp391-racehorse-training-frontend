"use client";

import Link from "next/link";
import { ChevronRight, LogOut, X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { Brand } from "@/components/shared/Brand";
import { sidebarSections, type SidebarItem } from "@/lib/workspace-navigation";
import { roleLabels } from "@/lib/roles";
import type { AuthUser } from "@/lib/types";

type Props = {
  user: AuthUser;
  collapsed: boolean;
  desktop: boolean;
  open: boolean;
  pathname: string;
  activeTab: string;
  pendingRequests: number;
  signingOut: boolean;
  onClose: () => void;
  onSignOut: () => void;
};
type Flyout = {
  key: string;
  label: string;
  children?: SidebarItem["children"];
  account?: boolean;
  top: number;
  left: number;
  trigger: HTMLElement;
};

export default function EquineSidebar({
  user,
  collapsed,
  desktop,
  open,
  pathname,
  activeTab,
  pendingRequests,
  signingOut,
  onClose,
  onSignOut,
}: Props) {
  const compact = desktop && collapsed;
  const sections = useMemo(
    () => sidebarSections(user.roleName, pendingRequests),
    [user.roleName, pendingRequests],
  );
  const selected = (href?: string) => {
    if (!href) return false;
    const [path, query = ""] = href.split("?");
    if (path.startsWith("/dashboard/"))
      return (
        path === pathname &&
        (new URLSearchParams(query).get("tab") ?? "overview") === activeTab
      );
    return path === "/"
      ? pathname === "/"
      : pathname === path || pathname.startsWith(`${path}/`);
  };
  const activeGroup = sections
    .flatMap((section) => section.items)
    .find((item) => item.children?.some((child) => selected(child.href)))?.key;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    activeGroup ?? null,
  );
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const root = useRef<HTMLElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const suppressFocus = useRef(false);
  useEffect(() => {
    if (activeGroup) setExpandedGroup(activeGroup);
  }, [activeGroup]);
  useEffect(() => {
    setFlyout(null);
  }, [compact, pathname, activeTab]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    const element = footer.current;
    if (!element) return;
    const measure = () =>
      root.current?.style.setProperty(
        "--horse-account-height",
        `${element.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (desktop || !open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>("button, a")?.focus(),
    );
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled)",
        ) ?? []),
      ].filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (!root.current?.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keys);
      previous?.focus({ preventScroll: true });
    };
  }, [desktop, open, onClose]);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const delayClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setFlyout(null), 150);
  };
  const reveal = (
    item: {
      key: string;
      label: string;
      children?: SidebarItem["children"];
      account?: boolean;
    },
    trigger: HTMLElement,
  ) => {
    if (!compact) return;
    cancelClose();
    const rect = trigger.getBoundingClientRect();
    setFlyout({ ...item, top: rect.top, left: rect.right + 8, trigger });
  };
  const revealOnFocus: typeof reveal = (item, trigger) => {
    if (suppressFocus.current) {
      suppressFocus.current = false;
      return;
    }
    reveal(item, trigger);
  };
  useLayoutEffect(() => {
    if (!flyout || !flyoutRef.current) return;
    const height = flyoutRef.current.getBoundingClientRect().height;
    const top = Math.max(
      8,
      Math.min(
        flyout.trigger.getBoundingClientRect().top,
        window.innerHeight - height - 8,
      ),
    );
    flyoutRef.current.style.top = `${top}px`;
  }, [flyout]);
  useEffect(() => {
    if (!flyout) return;
    const close = () => setFlyout(null);
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setFlyout(null);
        suppressFocus.current = document.activeElement !== flyout.trigger;
        flyout.trigger.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !flyoutRef.current?.contains(event.target as Node) &&
        !flyout.trigger.contains(event.target as Node)
      )
        close();
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", outside);
    root.current
      ?.querySelector(".horse-sidebar-scroll")
      ?.addEventListener("scroll", close);
    const scroll = root.current?.querySelector(".horse-sidebar-scroll");
    return () => {
      window.removeEventListener("keydown", keys);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", outside);
      scroll?.removeEventListener("scroll", close);
    };
  }, [flyout]);
  const blur = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (
        !flyoutRef.current?.contains(document.activeElement) &&
        !flyout?.trigger.contains(document.activeElement)
      )
        setFlyout(null);
    }, 150);
  };
  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    setFlyout(null);
    onClose();
    const [path] = href.split("?");
    if (path !== pathname) return;
    event.preventDefault();
    if (window.location.pathname + window.location.search !== href)
      window.history.pushState(null, "", href);
    window.dispatchEvent(new Event("workspace-tab-change"));
  };
  const flyoutKeys = (event: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const controls = [
      ...(flyoutRef.current?.querySelectorAll<HTMLElement>("a,button") ?? []),
    ];
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + controls.length) %
            controls.length;
    controls[next]?.focus();
  };
  const triggerKeys = (
    event: KeyboardEvent<HTMLElement>,
    item: SidebarItem,
  ) => {
    if (
      !compact ||
      !item.children ||
      !["ArrowDown", "ArrowUp"].includes(event.key)
    )
      return;
    event.preventDefault();
    reveal(item, event.currentTarget);
    requestAnimationFrame(() => {
      const controls =
        flyoutRef.current?.querySelectorAll<HTMLElement>("a,button");
      (event.key === "ArrowUp"
        ? controls?.[controls.length - 1]
        : controls?.[0]
      )?.focus();
    });
  };
  return (
    <>
      {!desktop && open && (
        <button
          className="equine-drawer-backdrop"
          aria-label="Đóng menu"
          onClick={onClose}
        />
      )}
      <aside
        id="equine-sidebar"
        ref={root}
        className={`horse-sidebar equine-sidebar${compact ? " is-collapsed" : ""}${!desktop && open ? " is-open" : ""}`}
        inert={!desktop && !open}
        role={!desktop && open ? "dialog" : undefined}
        aria-modal={!desktop && open ? true : undefined}
        aria-label={!desktop && open ? "Menu điều hướng" : undefined}
      >
        <div className="equine-sidebar-brand">
          <Link href="/" aria-label="Equine - Về trang chủ">
            {compact ? (
              <span className="equine-brand-mark" aria-hidden="true">
                E
              </span>
            ) : (
              <Brand />
            )}
          </Link>
          {!desktop && (
            <button
              type="button"
              className="horse-icon-button"
              aria-label="Đóng menu"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="horse-sidebar-scroll">
          <nav aria-label="Menu chính">
            {sections.map((section) => (
              <section key={section.label} className="equine-menu-section">
                <h2 className="equine-section-label">{section.label}</h2>
                {section.items.map((item) => {
                  const Icon = item.icon,
                    active = selected(item.href),
                    groupActive = item.children?.some((child) =>
                      selected(child.href),
                    );
                  const expanded = compact
                    ? flyout?.key === item.key
                    : expandedGroup === item.key;
                  const contents = (
                    <>
                      <span className="equine-menu-icon">
                        <Icon size={19} />
                      </span>
                      <span className="equine-menu-text">{item.label}</span>
                      {Boolean(item.badge) && (
                        <span className="equine-menu-badge">
                          {item.badge! > 99 ? "99+" : item.badge}
                        </span>
                      )}
                      {item.children && (
                        <ChevronRight
                          size={16}
                          className={`equine-menu-chevron${expanded ? " is-expanded" : ""}`}
                        />
                      )}
                    </>
                  );
                  const shared = {
                    className: `equine-menu-row${active ? " active" : ""}${groupActive ? " has-active-child" : ""}`,
                    "aria-label": item.label,
                    "aria-describedby": compact && !item.children && flyout?.key === item.key ? `sidebar-flyout-${item.key}` : undefined,
                    onMouseEnter: (event: MouseEvent<HTMLElement>) =>
                      reveal(item, event.currentTarget),
                    onMouseLeave: delayClose,
                    onFocus: (event: React.FocusEvent<HTMLElement>) =>
                      revealOnFocus(item, event.currentTarget),
                    onBlur: blur,
                    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
                      triggerKeys(event, item),
                  };
                  return (
                    <div key={item.key}>
                      {item.children ? (
                        <button
                          type="button"
                          {...shared}
                          aria-expanded={expanded}
                          aria-controls={
                            compact
                              ? expanded
                                ? `sidebar-flyout-${item.key}`
                                : undefined
                              : `sidebar-group-${item.key}`
                          }
                          onClick={(event) =>
                            compact
                              ? reveal(item, event.currentTarget)
                              : setExpandedGroup(expanded ? null : item.key)
                          }
                        >
                          {contents}
                        </button>
                      ) : (
                        <Link
                          {...shared}
                          href={item.href!}
                          aria-current={active ? "page" : undefined}
                          onClick={(event) => navigate(event, item.href!)}
                        >
                          {contents}
                        </Link>
                      )}
                      {item.children && !compact && (
                        <div
                          id={`sidebar-group-${item.key}`}
                          className="equine-submenu"
                          hidden={!expanded}
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.key}
                              href={child.href}
                              aria-current={
                                selected(child.href) ? "page" : undefined
                              }
                              onClick={(event) => navigate(event, child.href)}
                            >
                              <span aria-hidden="true" />
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
          </nav>
        </div>
        <div
          ref={footer}
          className="horse-sidebar-footer equine-sidebar-footer"
        >
          {compact ? (
            <button
              className="horse-avatar equine-account-trigger"
              aria-label={`${user.fullName}, ${roleLabels[user.roleName]}`}
              aria-expanded={flyout?.account === true}
              aria-controls={
                flyout?.account ? "sidebar-account-flyout" : undefined
              }
              onMouseEnter={(event) =>
                reveal(
                  { key: "account", label: user.fullName, account: true },
                  event.currentTarget,
                )
              }
              onMouseLeave={delayClose}
              onFocus={(event) =>
                revealOnFocus(
                  { key: "account", label: user.fullName, account: true },
                  event.currentTarget,
                )
              }
              onBlur={blur}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                event.preventDefault();
                reveal({ key: "account", label: user.fullName, account: true }, event.currentTarget);
                requestAnimationFrame(() => flyoutRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
              }}
              onClick={(event) =>
                reveal(
                  { key: "account", label: user.fullName, account: true },
                  event.currentTarget,
                )
              }
            >
              {user.fullName.slice(0, 1).toUpperCase()}
            </button>
          ) : (
            <div className="equine-account-card">
              <span className="horse-avatar">
                {user.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user.fullName}</strong>
                <small>{roleLabels[user.roleName]}</small>
              </div>
              <button
                type="button"
                aria-label="Đăng xuất"
                disabled={signingOut}
                onClick={onSignOut}
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>
      {compact &&
        flyout &&
        createPortal(
          <div
            ref={flyoutRef}
            id={
              flyout.account
                ? "sidebar-account-flyout"
                : `sidebar-flyout-${flyout.key}`
            }
            className="equine-sidebar-flyout"
            style={{ top: flyout.top, left: flyout.left }}
            role={flyout.children || flyout.account ? "group" : "tooltip"}
            aria-label={flyout.label}
            onMouseEnter={cancelClose}
            onMouseLeave={delayClose}
            onFocus={cancelClose}
            onBlur={blur}
            onKeyDown={flyoutKeys}
          >
            <div className="equine-flyout-label">{flyout.label}</div>
            {flyout.children && (
              <div className="equine-flyout-card">
                {flyout.children.map((child) => (
                  <Link
                    key={child.key}
                    href={child.href}
                    aria-current={selected(child.href) ? "page" : undefined}
                    onClick={(event) => navigate(event, child.href)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
            {flyout.account && (
              <div className="equine-flyout-card equine-account-flyout">
                <span>{roleLabels[user.roleName]}</span>
                <button type="button" disabled={signingOut} onClick={onSignOut}>
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
