"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Card, Chip, Toast } from "@heroui/react";
import {
  Boxes,
  ChevronLeft,
  FolderOpen,
  History,
  House,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "首页", icon: House },
  { href: "/products", label: "商品管理", icon: Boxes },
  { href: "/categories", label: "分类管理", icon: FolderOpen },
  { href: "/stock-logs", label: "库存记录", icon: History },
];

const publicPaths = ["/login"];

type AppShellProps = {
  children: ReactNode;
};

type MeUser = {
  sub: string;
  username: string;
  avatarUrl?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  canManageUsers?: boolean;
};

type UserProfileUpdatedEvent = CustomEvent<{
  username: string;
  avatarUrl: string | null;
}>;

function isPublicPath(pathname: string) {
  return publicPaths.some((item) => pathname === item || pathname.startsWith(`${item}/`));
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const sidebarCollapsed = collapsed;

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) return;
        const data = (await response.json()) as { user?: MeUser };
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    function handleUserProfileUpdated(event: Event) {
      const customEvent = event as UserProfileUpdatedEvent;
      const detail = customEvent.detail;
      if (!detail) return;

      setUser((prev) =>
        prev
          ? {
              ...prev,
              username: detail.username,
              avatarUrl: detail.avatarUrl,
            }
          : prev,
      );
    }

    window.addEventListener(
      "user-profile-updated",
      handleUserProfileUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        "user-profile-updated",
        handleUserProfileUpdated as EventListener,
      );
    };
  }, []);

  if (!pathname || isPublicPath(pathname)) {
    return (
      <>
        {children}
        <Toast.Provider placement="top end" />
      </>
    );
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        Toast.toast.danger("退出登录失败，请稍后重试");
        return;
      }
      sessionStorage.removeItem("warehouse_last_password");
      Toast.toast.success("已退出登录");
      router.replace("/login");
      router.refresh();
    } catch {
      Toast.toast.danger("网络异常，退出登录失败");
    }
  }

  function askLogout() {
    setLogoutConfirmOpen(true);
  }

  function cancelLogout() {
    setLogoutConfirmOpen(false);
  }

  async function confirmLogout() {
    await handleLogout();
    setLogoutConfirmOpen(false);
  }

  const visibleNavItems = user?.canManageUsers
    ? [...navItems, { href: "/users", label: "用户管理", icon: Users }]
    : navItems;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">仓库后台</p>
            <p className="truncate text-xs text-zinc-500">{user?.username ?? "未登录"}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700"
            onClick={() => {
              setCollapsed(false);
              setMobileNavOpen(true);
            }}
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={
          sidebarCollapsed
            ? `fixed left-0 top-0 z-50 h-screen w-[88px] border-r border-zinc-200 bg-white p-2 transition-all duration-300 ease-in-out md:translate-x-0 ${
                mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              }`
            : `fixed left-0 top-0 z-50 h-screen w-[88vw] max-w-72 border-r border-zinc-200 bg-white p-3 transition-all duration-300 ease-in-out md:w-64 md:max-w-none md:p-4 ${
                mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
              }`
        }
      >
          <Card className="h-full overflow-visible border border-zinc-200 bg-white shadow-sm">
            <div
              className={
                sidebarCollapsed
                  ? "px-2 pt-2 transition-all duration-300 ease-in-out"
                  : "px-3 pt-3 transition-all duration-300 ease-in-out"
              }
            >
              <div
                className={
                  sidebarCollapsed
                    ? "flex items-center justify-center"
                    : "flex items-center justify-between"
                }
              >
                {sidebarCollapsed ? null : (
                  <h1 className="text-lg font-semibold transition-opacity duration-200 ease-in-out">
                    仓库后台
                  </h1>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 md:hidden"
                    onClick={() => setMobileNavOpen(false)}
                    title="关闭菜单"
                    aria-label="关闭菜单"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {sidebarCollapsed ? null : (
                    <Chip size="sm" variant="soft" color="default" className="hidden md:inline-flex">
                      MVP
                    </Chip>
                  )}
                  <button
                    type="button"
                    className="hidden rounded-md border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 md:inline-flex"
                    onClick={() => setCollapsed((prev) => !prev)}
                    title={sidebarCollapsed ? "展开菜单" : "收起菜单"}
                    aria-label={sidebarCollapsed ? "展开菜单" : "收起菜单"}
                  >
                    {sidebarCollapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {sidebarCollapsed ? null : (
                <p className="mt-1 text-xs text-zinc-500 transition-opacity duration-200 ease-in-out">
                  个人仓库管理系统
                </p>
              )}

              <div
                className={
                  sidebarCollapsed
                    ? "mt-3 flex items-center justify-center"
                    : "mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2"
                }
                title={sidebarCollapsed ? user?.username ?? "未登录" : undefined}
              >
                {user?.avatarUrl ? (
                  <div
                    className={
                      sidebarCollapsed
                        ? "h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-zinc-200"
                        : "h-9 w-9 shrink-0 overflow-hidden rounded-full border border-zinc-200"
                    }
                  >
                    <img
                      src={user.avatarUrl}
                      alt={`${user.username}头像`}
                      className="block h-full w-full object-cover"
                      style={{
                        width: sidebarCollapsed ? 40 : 36,
                        height: sidebarCollapsed ? 40 : 36,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className={
                      sidebarCollapsed
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
                    }
                  >
                    {(user?.username?.slice(0, 1) ?? "U").toUpperCase()}
                  </div>
                )}

                {sidebarCollapsed ? null : (
                  <div className="min-w-0 transition-opacity duration-200 ease-in-out">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {user?.username ?? "未登录"}
                    </p>
                    <p className="text-xs text-zinc-500">{user?.role ?? "-"}</p>
                  </div>
                )}
              </div>
            </div>

            <nav
              className={
                sidebarCollapsed
                  ? "mt-4 flex flex-1 flex-col items-center gap-2 px-0 pb-3 transition-all duration-300 ease-in-out"
                  : "mt-4 flex-1 space-y-1 px-2 pb-3 transition-all duration-300 ease-in-out"
              }
            >
              {visibleNavItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={
                      active
                        ? sidebarCollapsed
                          ? "group relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-800/30"
                          : "group relative flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-[15px] font-medium text-white shadow-sm ring-1 ring-zinc-800/30"
                        : sidebarCollapsed
                          ? "group relative flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100"
                          : "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-100"
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {sidebarCollapsed ? null : (
                      <span className="transition-opacity duration-200 ease-in-out">
                        {item.label}
                      </span>
                    )}
                    {sidebarCollapsed ? (
                      <span className="pointer-events-none absolute left-full top-1/2 z-[120] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                        {item.label}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div
              className={
                sidebarCollapsed
                  ? "flex flex-col items-center gap-2 p-2 transition-all duration-300 ease-in-out"
                  : "space-y-2 p-3 transition-all duration-300 ease-in-out"
              }
            >
              <Link
                href="/settings"
                onClick={() => setMobileNavOpen(false)}
                className={
                  pathname === "/settings" || pathname.startsWith("/settings/")
                    ? sidebarCollapsed
                      ? "group relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-800/30"
                      : "group relative flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-[15px] font-medium text-white shadow-sm ring-1 ring-zinc-800/30"
                    : sidebarCollapsed
                      ? "group relative flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100"
                      : "group relative flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-100"
                }
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                {sidebarCollapsed ? null : (
                  <span className="transition-opacity duration-200 ease-in-out">设置</span>
                )}
                {sidebarCollapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-[120] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                    设置
                  </span>
                ) : null}
              </Link>

              <div className={sidebarCollapsed ? "group relative w-10" : ""}>
                <button
                  type="button"
                  className={
                    sidebarCollapsed
                      ? "flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100"
                      : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] text-zinc-700 transition-colors hover:bg-zinc-100"
                  }
                  onClick={askLogout}
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  {sidebarCollapsed ? null : (
                    <span className="transition-opacity duration-200 ease-in-out">退出登录</span>
                  )}
                </button>

                {sidebarCollapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-[120] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                    退出登录
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
      </aside>
      <main
        className={`min-h-[calc(100vh-65px)] bg-zinc-100 px-4 py-4 pb-24 transition-[margin-left] duration-300 ease-in-out md:min-h-screen md:p-6 ${
          sidebarCollapsed ? "md:ml-[88px]" : "md:ml-64"
        }`}
      >
        {children}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        <nav className="grid grid-cols-5 gap-1">
          {visibleNavItems.slice(0, 4).map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-600"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/settings"
            onClick={() => setMobileNavOpen(false)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] ${
              pathname === "/settings" || pathname.startsWith("/settings/")
                ? "bg-zinc-900 text-white"
                : "text-zinc-600"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="truncate">设置</span>
          </Link>
        </nav>
      </div>
      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-900/35 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">确认退出登录</h3>
            <p className="mt-2 text-sm text-zinc-600">退出后需要重新输入账号密码登录系统。</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={cancelLogout}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700"
                onClick={() => void confirmLogout()}
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast.Provider placement="top end" />
    </div>
  );
}
