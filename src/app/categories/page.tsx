"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Spinner, Toast } from "@heroui/react";

type Category = {
  id: string;
  name: string;
  sort: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthMeResponse = {
  user?: {
    sub: string;
    username: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
  };
};

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState<number>(0);
  const [disableTarget, setDisableTarget] = useState<Category | null>(null);
  const [disableSaving, setDisableSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [role, setRole] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("USER");

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  useEffect(() => {
    void loadCurrentUser();
    void loadItems();
  }, []);

  async function loadCurrentUser() {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return;
    const data = (await response.json()) as AuthMeResponse;
    if (data.user?.role) {
      setRole(data.user.role);
    }
  }

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch("/api/categories?includeInactive=true");
      const data = (await response.json()) as {
        items?: Category[];
        message?: string;
      };
      if (!response.ok) {
        Toast.toast.danger(data.message ?? "加载分类失败");
        return;
      }
      setItems(data.items ?? []);
    } catch {
      Toast.toast.danger("加载分类失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const maxSort = items.reduce((max, item) => Math.max(max, item.sort), 0);
    const payload = { name: name.trim(), sort: maxSort + 10 };

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        const message = data.message ?? "保存失败";
        Toast.toast.danger(message);
        return;
      }

      Toast.toast.success("分类创建成功");
      setName("");
      await loadItems();
    } catch {
      const message = "保存失败，请稍后重试";
      Toast.toast.danger(message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Category) {
    setEditId(item.id);
    setEditName(item.name);
    setEditSort(item.sort);
    setEditOpen(true);
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditId(null);
    setEditName("");
    setEditSort(0);
  }

  function moveItem(list: Category[], fromId: string, toId: string) {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  async function persistOrder(nextOrdered: Category[]) {
    setOrdering(true);
    try {
      const updates = nextOrdered.map((item, index) => ({
        id: item.id,
        name: item.name,
        sort: (index + 1) * 10,
      }));

      const responses = await Promise.all(
        updates.map((item) =>
          fetch(`/api/categories/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: item.name, sort: item.sort }),
          }),
        ),
      );

      const failed = responses.find((res) => !res.ok);
      if (failed) {
        const body = (await failed.json()) as { message?: string };
        throw new Error(body.message ?? "拖动排序保存失败");
      }

      setItems(
        nextOrdered.map((item, index) => ({
          ...item,
          sort: (index + 1) * 10,
        })),
      );
      Toast.toast.success("分类排序已更新");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "拖动排序保存失败，请稍后重试";
      Toast.toast.danger(message);
      await loadItems();
    } finally {
      setOrdering(false);
    }
  }

  async function onDropRow(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const next = moveItem(items, draggingId, targetId);
    setDraggingId(null);
    setItems(next);
    await persistOrder(next);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;

    setEditSaving(true);
    const payload = { name: editName.trim(), sort: Number(editSort) || 0 };

    try {
      const response = await fetch(`/api/categories/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        Toast.toast.danger(data.message ?? "更新分类失败");
        return;
      }
      Toast.toast.success("分类更新成功");
      closeEditModal();
      await loadItems();
    } catch {
      Toast.toast.danger("更新分类失败，请稍后重试");
    } finally {
      setEditSaving(false);
    }
  }

  function askDisableCategory(item: Category) {
    setDisableTarget(item);
  }

  function closeDisableModal() {
    setDisableTarget(null);
  }

  async function confirmDisableCategory() {
    if (!disableTarget) return;
    setDisableSaving(true);
    try {
      const response = await fetch(`/api/categories/${disableTarget.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = data.message ?? "停用失败";
        Toast.toast.danger(message);
        return;
      }

      Toast.toast.success("分类已停用");
      closeDisableModal();
      await loadItems();
    } catch {
      const message = "停用失败，请稍后重试";
      Toast.toast.danger(message);
    } finally {
      setDisableSaving(false);
    }
  }

  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items],
  );

  return (
    <div className="w-full space-y-4">
        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h1 className="text-xl font-semibold sm:text-2xl">分类管理</h1>
          <p className="mt-1 text-sm text-zinc-600">
            总计 {items.length} 个分类，启用中 {activeCount} 个
          </p>
          </Card.Header>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">新增分类</h2>
          </Card.Header>
          <Card.Content>
          {!isAdmin ? (
            <p className="mt-2 text-sm text-zinc-500">
              当前账号是 USER，仅可查看，不能新增/编辑/停用。
            </p>
          ) : null}

          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <input
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100"
              placeholder="分类名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!isAdmin || saving}
              required
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                className="w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto"
                isDisabled={!isAdmin || saving}
              >
                {saving ? "保存中..." : "创建分类"}
              </Button>
            </div>
          </form>

          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">分类列表</h2>
          </Card.Header>
          <Card.Content>
          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
              <Spinner size="sm" />
              加载中...
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-4">拖动</th>
                    <th className="py-2 pr-4">名称</th>
                    <th className="py-2 pr-4">顺序</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">更新时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-zinc-500" colSpan={6}>
                        暂无分类，先创建一个吧。
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                    <tr
                      key={item.id}
                      draggable={isAdmin && !ordering}
                      onDragStart={() => setDraggingId(item.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(event) => {
                        if (!isAdmin || ordering) return;
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void onDropRow(item.id);
                      }}
                      className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 ${
                        draggingId === item.id ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-2 pr-4 text-zinc-400">
                        <span className="select-none">⋮⋮</span>
                      </td>
                      <td className="py-2 pr-4">{item.name}</td>
                      <td className="py-2 pr-4">{index + 1}</td>
                      <td className="py-2 pr-4">
                        {item.isActive ? (
                          <Chip size="sm" variant="soft" color="success">
                            启用
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft" color="default">
                            停用
                          </Chip>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {new Date(item.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                            onClick={() => startEdit(item)}
                            isDisabled={!isAdmin}
                          >
                            编辑
                          </Button>
                          {item.isActive ? (
                              <Button
                              type="button"
                              size="sm"
                              className="border border-red-300 bg-white text-red-600 hover:bg-red-50"
                              onClick={() => askDisableCategory(item)}
                              isDisabled={!isAdmin}
                            >
                              停用
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          </Card.Content>
        </Card>

        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 p-4">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold">编辑分类</h3>
              <form className="mt-4 space-y-3" onSubmit={submitEdit}>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="分类名称"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  required
                />
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="w-full border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 sm:w-auto"
                    onPress={closeEditModal}
                    isDisabled={editSaving}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    className="w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto"
                    isDisabled={editSaving}
                  >
                    {editSaving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {disableTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/35 p-4">
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold">确认停用分类</h3>
              <p className="mt-2 text-sm text-zinc-600">
                确认停用分类「{disableTarget.name}」吗？停用后该分类不会在常规列表中显示。
              </p>
              <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="w-full border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 sm:w-auto"
                  onPress={closeDisableModal}
                  isDisabled={disableSaving}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  className="w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto"
                  onPress={confirmDisableCategory}
                  isDisabled={disableSaving}
                >
                  {disableSaving ? "处理中..." : "确认停用"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
  );
}
