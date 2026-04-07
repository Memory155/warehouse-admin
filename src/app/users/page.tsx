"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Spinner, Toast } from "@heroui/react";
import AppSelect from "@/components/app-select";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER";
type UserStatus = "ACTIVE" | "DISABLED";

type CurrentUser = {
  sub: string;
  username: string;
  role: Role;
  canManageUsers: boolean;
};

type ManagedUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: Role;
  canManageUsers: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

type CreateUserForm = {
  username: string;
  password: string;
  role: Role;
  status: UserStatus;
  canManageUsers: boolean;
};

type EditUserForm = {
  id: string;
  username: string;
  role: Role;
  status: UserStatus;
  canManageUsers: boolean;
  resetPassword: string;
};

const initialCreateForm: CreateUserForm = {
  username: "",
  password: "",
  role: "USER",
  status: "ACTIVE",
  canManageUsers: false,
};

function roleLabel(role: Role) {
  if (role === "SUPER_ADMIN") return "超级管理员";
  if (role === "ADMIN") return "管理员";
  return "用户";
}

function statusLabel(status: UserStatus) {
  return status === "ACTIVE" ? "启用" : "停用";
}

export default function UsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateForm);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditUserForm | null>(null);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const roleOptions = isSuperAdmin
    ? [
        { value: "USER", label: "用户" },
        { value: "ADMIN", label: "管理员" },
        { value: "SUPER_ADMIN", label: "超级管理员" },
      ]
    : [
        { value: "USER", label: "用户" },
        { value: "ADMIN", label: "管理员" },
      ];

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const meResponse = await fetch("/api/auth/me");
      const meData = (await meResponse.json()) as {
        user?: CurrentUser;
        message?: string;
      };

      if (meResponse.status === 401) {
        router.replace("/login");
        return;
      }

      if (!meResponse.ok || !meData.user) {
        Toast.toast.danger(meData.message ?? "加载用户信息失败");
        router.replace("/dashboard");
        return;
      }

      if (!meData.user.canManageUsers) {
        Toast.toast.danger("你没有用户管理权限");
        router.replace("/dashboard");
        return;
      }

      setCurrentUser(meData.user);

      const usersResponse = await fetch("/api/users");
      const usersData = (await usersResponse.json()) as {
        items?: ManagedUser[];
        message?: string;
      };

      if (!usersResponse.ok) {
        Toast.toast.danger(usersData.message ?? "加载用户列表失败");
        return;
      }

      setUsers(usersData.items ?? []);
    } catch {
      Toast.toast.danger("加载用户管理数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function validateCreateForm() {
    if (!createForm.username.trim()) {
      Toast.toast.danger("请输入用户名");
      return false;
    }
    if (createForm.username.trim().length < 2) {
      Toast.toast.danger("用户名至少 2 位");
      return false;
    }
    if (createForm.password.length < 8) {
      Toast.toast.danger("初始密码至少 8 位");
      return false;
    }
    return true;
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCreateForm()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createForm.username.trim(),
          password: createForm.password,
          role: createForm.role,
          status: createForm.status,
          canManageUsers: isSuperAdmin ? createForm.canManageUsers : false,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        Toast.toast.danger(data.message ?? "创建用户失败");
        return;
      }

      Toast.toast.success(data.message ?? "用户创建成功");
      setCreateForm(initialCreateForm);
      await loadData();
    } catch {
      Toast.toast.danger("创建用户失败，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(user: ManagedUser) {
    setEditForm({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      canManageUsers: user.canManageUsers,
      resetPassword: "",
    });
    setEditOpen(true);
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditForm(null);
  }

  function validateEditForm() {
    if (!editForm) return false;

    if (!editForm.username.trim()) {
      Toast.toast.danger("请输入用户名");
      return false;
    }
    if (editForm.username.trim().length < 2) {
      Toast.toast.danger("用户名至少 2 位");
      return false;
    }
    if (editForm.resetPassword && editForm.resetPassword.length < 8) {
      Toast.toast.danger("重置密码至少 8 位");
      return false;
    }

    return true;
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm || !validateEditForm()) return;

    setEditing(true);
    try {
      const response = await fetch(`/api/users/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editForm.username.trim(),
          role: editForm.role,
          status: editForm.status,
          canManageUsers: isSuperAdmin ? editForm.canManageUsers : undefined,
          resetPassword: editForm.resetPassword || undefined,
        }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        Toast.toast.danger(data.message ?? "更新用户失败");
        return;
      }

      Toast.toast.success(data.message ?? "用户信息已更新");
      closeEditModal();
      await loadData();
    } catch {
      Toast.toast.danger("更新用户失败，请稍后重试");
    } finally {
      setEditing(false);
    }
  }

  const activeCount = useMemo(
    () => users.filter((item) => item.status === "ACTIVE").length,
    [users],
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-600">
        <Spinner size="sm" />
        加载用户管理中...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h1 className="text-2xl font-semibold">用户管理</h1>
          <p className="mt-1 text-sm text-zinc-600">
            共 {users.length} 个账号，启用中 {activeCount} 个
          </p>
        </Card.Header>
      </Card>

      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h2 className="text-lg font-medium">新增用户</h2>
        </Card.Header>
        <Card.Content>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={handleCreateUser}
            autoComplete="off"
          >
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              placeholder="用户名"
              value={createForm.username}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, username: event.target.value }))
              }
              autoComplete="off"
              required
            />

            <input
              type="password"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              placeholder="初始密码（至少8位）"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, password: event.target.value }))
              }
              autoComplete="new-password"
              required
            />

            <AppSelect
              value={createForm.role}
              onChange={(value) =>
                setCreateForm((prev) => ({
                  ...prev,
                  role: value as Role,
                  canManageUsers:
                    value === "SUPER_ADMIN"
                      ? true
                      : prev.canManageUsers,
                }))
              }
              placeholder="选择角色"
              options={roleOptions}
            />

            <AppSelect
              value={createForm.status}
              onChange={(value) =>
                setCreateForm((prev) => ({
                  ...prev,
                  status: value as UserStatus,
                }))
              }
              placeholder="选择状态"
              options={[
                { value: "ACTIVE", label: "启用" },
                { value: "DISABLED", label: "停用" },
              ]}
            />

            {isSuperAdmin ? (
              <label className="sm:col-span-2 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={createForm.role === "SUPER_ADMIN" ? true : createForm.canManageUsers}
                  disabled={createForm.role === "SUPER_ADMIN"}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      canManageUsers: event.target.checked,
                    }))
                  }
                />
                授予“用户管理”权限（仅超级管理员可下放）
              </label>
            ) : null}

            <div className="sm:col-span-2">
              <Button
                type="submit"
                className="bg-zinc-900 text-white hover:bg-zinc-700"
                isDisabled={creating}
              >
                {creating ? "创建中..." : "创建用户"}
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>

      <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
        <Card.Header>
          <h2 className="text-lg font-medium">用户列表</h2>
        </Card.Header>
        <Card.Content>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">用户名</th>
                  <th className="py-2 pr-4">角色</th>
                  <th className="py-2 pr-4">用户管理权限</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">更新时间</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="py-10 text-center text-zinc-500" colSpan={6}>
                      暂无用户
                    </td>
                  </tr>
                ) : (
                  users.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4">{item.username}</td>
                      <td className="py-2 pr-4">
                        <Chip size="sm" variant="soft" color="default">
                          {roleLabel(item.role)}
                        </Chip>
                      </td>
                      <td className="py-2 pr-4">
                        {item.role === "SUPER_ADMIN" || item.canManageUsers ? "有" : "无"}
                      </td>
                      <td className="py-2 pr-4">
                        {item.status === "ACTIVE" ? (
                          <Chip size="sm" variant="soft" color="success">
                            {statusLabel(item.status)}
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft" color="default">
                            {statusLabel(item.status)}
                          </Chip>
                        )}
                      </td>
                      <td className="py-2 pr-4">{new Date(item.updatedAt).toLocaleString()}</td>
                      <td className="py-2">
                        <Button
                          type="button"
                          size="sm"
                          className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                          onClick={() => openEditModal(item)}
                          isDisabled={
                            currentUser?.sub === item.id
                            || (!isSuperAdmin && item.role === "SUPER_ADMIN")
                          }
                        >
                          编辑
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>

      {editOpen && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">编辑用户</h3>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleUpdateUser}>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="用户名"
                value={editForm.username}
                onChange={(event) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          username: event.target.value,
                        }
                      : prev,
                  )
                }
                required
              />

              <input
                type="password"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="重置密码（可选）"
                value={editForm.resetPassword}
                onChange={(event) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          resetPassword: event.target.value,
                        }
                      : prev,
                  )
                }
              />

              <AppSelect
                value={editForm.role}
                onChange={(value) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          role: value as Role,
                          canManageUsers:
                            value === "SUPER_ADMIN"
                              ? true
                              : prev.canManageUsers,
                        }
                      : prev,
                  )
                }
                placeholder="选择角色"
                options={roleOptions}
              />

              <AppSelect
                value={editForm.status}
                onChange={(value) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: value as UserStatus,
                        }
                      : prev,
                  )
                }
                placeholder="选择状态"
                options={[
                  { value: "ACTIVE", label: "启用" },
                  { value: "DISABLED", label: "停用" },
                ]}
              />

              {isSuperAdmin ? (
                <label className="sm:col-span-2 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={editForm.role === "SUPER_ADMIN" ? true : editForm.canManageUsers}
                    disabled={editForm.role === "SUPER_ADMIN"}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              canManageUsers: event.target.checked,
                            }
                          : prev,
                      )
                    }
                  />
                  授予“用户管理”权限（仅超级管理员可下放）
                </label>
              ) : null}

              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button
                  type="button"
                  className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                  onPress={closeEditModal}
                  isDisabled={editing}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  className="bg-zinc-900 text-white hover:bg-zinc-700"
                  isDisabled={editing}
                >
                  {editing ? "保存中..." : "保存"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
