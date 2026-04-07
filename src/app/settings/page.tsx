"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Spinner, Toast } from "@heroui/react";
import { useRouter } from "next/navigation";

type MeUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  canManageUsers?: boolean;
  createdAt: string;
  updatedAt: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const avatarStyles = [
  "adventurer",
  "adventurer-neutral",
  "avataaars",
  "big-ears",
  "bottts",
  "croodles",
  "fun-emoji",
  "icons",
  "identicon",
  "lorelei",
  "micah",
  "pixel-art",
] as const;

type AvatarPreset = {
  value: string;
  label: string;
};

function buildAvatarUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

function createAvatarPresets(batch: number): AvatarPreset[] {
  return Array.from({ length: 12 }, (_, index) => {
    const style = avatarStyles[index % avatarStyles.length];
    const seed = `warehouse-admin-${batch}-${index + 1}`;
    return {
      value: buildAvatarUrl(style, seed),
      label: `${style}-${index + 1}`,
    };
  });
}

const initialPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [user, setUser] = useState<MeUser | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBatch, setAvatarBatch] = useState(0);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(initialPasswordForm);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/me");
      const data = (await response.json()) as { user?: MeUser; message?: string };

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        Toast.toast.danger(data.message ?? "加载设置失败");
        return;
      }

      if (!data.user) {
        Toast.toast.danger("未获取到用户信息");
        return;
      }

      setUser(data.user);
      setUsername(data.user.username);
      setAvatarUrl(data.user.avatarUrl ?? "");
    } catch {
      Toast.toast.danger("加载设置失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const cachedPassword = sessionStorage.getItem("warehouse_last_password");
    if (!cachedPassword) return;
    setPasswordForm((prev) => ({
      ...prev,
      currentPassword: cachedPassword,
    }));
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, avatarUrl }),
      });
      const data = (await response.json()) as { message?: string; user?: MeUser };

      if (!response.ok) {
        Toast.toast.danger(data.message ?? "保存资料失败");
        return;
      }

      const updatedUser = data.user;
      if (updatedUser) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                username: updatedUser.username,
                avatarUrl: updatedUser.avatarUrl,
              }
            : prev,
        );

        window.dispatchEvent(
          new CustomEvent("user-profile-updated", {
            detail: {
              username: updatedUser.username,
              avatarUrl: updatedUser.avatarUrl,
            },
          }),
        );
      }

      Toast.toast.success(data.message ?? "资料已更新");
    } catch {
      Toast.toast.danger("保存资料失败，请稍后重试");
    } finally {
      setSavingProfile(false);
    }
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordForm.currentPassword || passwordForm.currentPassword.length < 6) {
      Toast.toast.danger("当前密码至少 6 位");
      return;
    }

    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      Toast.toast.danger("新密码至少 8 位");
      return;
    }

    if (!passwordForm.confirmPassword || passwordForm.confirmPassword.length < 8) {
      Toast.toast.danger("确认密码至少 8 位");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Toast.toast.danger("两次输入的新密码不一致");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      Toast.toast.danger("新密码不能与当前密码相同");
      return;
    }

    setPasswordConfirmOpen(true);
  }

  function cancelPasswordConfirm() {
    if (savingPassword) return;
    setPasswordConfirmOpen(false);
  }

  async function confirmPasswordUpdate() {
    setSavingPassword(true);

    try {
      const response = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        Toast.toast.danger(data.message ?? "更新密码失败");
        return;
      }

      Toast.toast.success(data.message ?? "密码已更新");
      Toast.toast.warning("密码已变更，请重新登录");
      await fetch("/api/auth/logout", { method: "POST" });
      sessionStorage.removeItem("warehouse_last_password");
      setPasswordForm(initialPasswordForm);
      setPasswordConfirmOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      Toast.toast.danger("更新密码失败，请稍后重试");
    } finally {
      setSavingPassword(false);
    }
  }

  const previewAvatar = useMemo(() => {
    return avatarUrl || null;
  }, [avatarUrl]);

  const avatarPresets = useMemo(() => {
    return createAvatarPresets(avatarBatch);
  }, [avatarBatch]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-600">
        <Spinner size="sm" />
        加载设置中...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h1 className="text-2xl font-semibold">设置</h1>
          <p className="mt-1 text-sm text-zinc-600">管理你的用户名、头像和登录密码</p>
        </Card.Header>
      </Card>

      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">当前账号</h2>
          <Chip size="sm" variant="soft" color="default">
            {user?.role ?? "-"}
          </Chip>
        </Card.Header>
        <Card.Content>
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            {previewAvatar ? (
              <img
                src={previewAvatar}
                alt="用户头像"
                className="h-14 w-14 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white">
                {(username.slice(0, 1) || "U").toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-base font-semibold text-zinc-800">{username || "-"}</p>
              <p className="text-xs text-zinc-500">
                最后更新：{user?.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}
              </p>
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h2 className="text-lg font-medium">个人资料</h2>
        </Card.Header>
        <Card.Content>
          <form className="mt-3 space-y-4" onSubmit={handleProfileSubmit}>
            <div className="space-y-1">
              <p className="text-sm text-zinc-600">用户名</p>
              <input
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-600"
                aria-label="用户名"
                placeholder="请输入用户名"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-zinc-600">头像地址（可选）</p>
              <input
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-600"
                aria-label="头像地址"
                placeholder="https://example.com/avatar.png"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-zinc-600">快速选择头像（默认两行，每批 12 个）</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                    onPress={() => setAvatarBatch((prev) => prev + 1)}
                  >
                    换一批
                  </Button>
                  <Button
                    type="button"
                    className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                    onPress={() => setAvatarUrl("")}
                  >
                    清空头像
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {avatarPresets.map((item) => {
                  const active = avatarUrl === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={
                        active
                          ? "rounded-xl border-2 border-zinc-900 bg-zinc-100 p-1"
                          : "rounded-xl border border-zinc-200 bg-white p-1 hover:border-zinc-400"
                      }
                      onClick={() => setAvatarUrl(item.value)}
                    >
                      <img
                        src={item.value}
                        alt={`头像预设 ${item.label}`}
                        className="h-14 w-full rounded-lg object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                isDisabled={savingProfile}
              >
                {savingProfile ? "保存中..." : "保存资料"}
              </Button>
              <Button
                type="button"
                className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                onClick={() => {
                  setUsername(user?.username ?? "");
                  setAvatarUrl(user?.avatarUrl ?? "");
                }}
              >
                重置
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h2 className="text-lg font-medium">修改密码</h2>
        </Card.Header>
        <Card.Content>
          <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={handlePasswordSubmit}>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-14 text-sm outline-none focus:border-zinc-600"
                aria-label="当前密码"
                placeholder="当前密码"
                type={showCurrentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value.replace(/\s+/g, ""),
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === " ") event.preventDefault();
                }}
                autoComplete="current-password"
                required
              />
              {passwordForm.currentPassword ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                >
                  {showCurrentPassword ? "隐藏" : "查看"}
                </button>
              ) : null}
            </div>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-14 text-sm outline-none focus:border-zinc-600"
                aria-label="新密码"
                placeholder="新密码（至少 8 位）"
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value.replace(/\s+/g, ""),
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === " ") event.preventDefault();
                }}
                autoComplete="new-password"
                required
              />
              {passwordForm.newPassword ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                >
                  {showNewPassword ? "隐藏" : "查看"}
                </button>
              ) : null}
            </div>
            <div className="relative">
              <input
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-14 text-sm outline-none focus:border-zinc-600"
                aria-label="确认新密码"
                placeholder="确认新密码"
                type={showConfirmPassword ? "text" : "password"}
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value.replace(/\s+/g, ""),
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === " ") event.preventDefault();
                }}
                autoComplete="new-password"
                required
              />
              {passwordForm.confirmPassword ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                >
                  {showConfirmPassword ? "隐藏" : "查看"}
                </button>
              ) : null}
            </div>
            <div className="sm:col-span-3">
              <Button
                type="submit"
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                isDisabled={savingPassword}
              >
                {savingPassword ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" color="current" />
                    更新中...
                  </span>
                ) : (
                  "更新密码"
                )}
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      {passwordConfirmOpen ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-zinc-900/35 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">确认修改密码</h3>
            <p className="mt-2 text-sm text-zinc-600">
              修改成功后需要重新登录，确认现在提交修改吗？
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                isDisabled={savingPassword}
                onPress={cancelPasswordConfirm}
              >
                取消
              </Button>
              <Button
                type="button"
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                isDisabled={savingPassword}
                onPress={() => void confirmPasswordUpdate()}
              >
                {savingPassword ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" color="current" />
                    提交中...
                  </span>
                ) : (
                  "确认修改"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
