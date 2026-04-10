"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Spinner, Toast } from "@heroui/react";
import AppSelect from "@/components/app-select";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  unit: string;
  spec: string | null;
  currentStock: string | number;
  safetyStock: string | number;
  location: string | null;
  remark: string | null;
  isActive: boolean;
  updatedAt: string;
  stockStatus: "normal" | "low" | "out";
};

type AuthMeResponse = {
  user?: {
    sub: string;
    username: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
  };
};

type ProductForm = {
  name: string;
  categoryId: string;
  unit: string;
  spec: string;
  currentStock: number;
  safetyStock: number;
  location: string;
  remark: string;
};

const initialForm: ProductForm = {
  name: "",
  categoryId: "",
  unit: "",
  spec: "",
  currentStock: 0,
  safetyStock: 0,
  location: "",
  remark: "",
};

function toNumber(value: string | number) {
  return Number(value);
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [role, setRole] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("USER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(initialForm);
  const [disableTarget, setDisableTarget] = useState<Product | null>(null);
  const [disableSaving, setDisableSaving] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState<"" | "normal" | "low" | "out">(
    "",
  );
  const [includeInactive, setIncludeInactive] = useState(true);

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  useEffect(() => {
    void loadCurrentUser();
    void loadCategories();
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCurrentUser() {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return;
    const data = (await response.json()) as AuthMeResponse;
    if (data.user?.role) {
      setRole(data.user.role);
    }
  }

  async function loadCategories() {
    const response = await fetch("/api/categories");
    const data = (await response.json()) as {
      items?: Category[];
    };
    setCategories(data.items ?? []);
  }

  async function loadProducts() {
    setLoading(true);

    const params = new URLSearchParams();
    if (keyword.trim()) params.set("q", keyword.trim());
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (stockStatus) params.set("stockStatus", stockStatus);
    if (includeInactive) params.set("includeInactive", "true");

    try {
      const response = await fetch(`/api/products?${params.toString()}`);
      const data = (await response.json()) as {
        items?: Product[];
        message?: string;
      };

      if (!response.ok) {
        Toast.toast.danger(data.message ?? "加载商品失败");
        return;
      }

      setItems(data.items ?? []);
    } catch {
      Toast.toast.danger("加载商品失败，请检查网络");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        const message = data.message ?? "保存失败";
        Toast.toast.danger(message);
        return;
      }

      Toast.toast.success("商品创建成功");
      setForm(initialForm);
      await loadProducts();
    } catch {
      const message = "保存失败，请稍后重试";
      Toast.toast.danger(message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Product) {
    setEditId(item.id);
    setEditForm({
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      spec: item.spec ?? "",
      currentStock: toNumber(item.currentStock),
      safetyStock: toNumber(item.safetyStock),
      location: item.location ?? "",
      remark: item.remark ?? "",
    });
    setEditOpen(true);
  }

  function closeEditModal() {
    setEditOpen(false);
    setEditId(null);
    setEditForm(initialForm);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editId) return;

    setEditSaving(true);
    try {
      const response = await fetch(`/api/products/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        Toast.toast.danger(data.message ?? "更新商品失败");
        return;
      }
      Toast.toast.success("商品更新成功");
      closeEditModal();
      await loadProducts();
    } catch {
      Toast.toast.danger("更新商品失败，请稍后重试");
    } finally {
      setEditSaving(false);
    }
  }

  function askDisableProduct(item: Product) {
    setDisableTarget(item);
  }

  function closeDisableModal() {
    setDisableTarget(null);
  }

  async function confirmDisableProduct() {
    if (!disableTarget) return;
    setDisableSaving(true);
    try {
      const response = await fetch(`/api/products/${disableTarget.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        const message = data.message ?? "停用失败";
        Toast.toast.danger(message);
        return;
      }

      Toast.toast.success("商品已停用");
      closeDisableModal();
      await loadProducts();
    } catch {
      const message = "停用失败，请稍后重试";
      Toast.toast.danger(message);
    } finally {
      setDisableSaving(false);
    }
  }

  const lowStockCount = useMemo(
    () => items.filter((item) => item.stockStatus === "low").length,
    [items],
  );
  const outCount = useMemo(
    () => items.filter((item) => item.stockStatus === "out").length,
    [items],
  );

  return (
    <div className="w-full space-y-4">
        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h1 className="text-xl font-semibold sm:text-2xl">商品管理</h1>
          <p className="mt-1 text-sm text-zinc-600">
            共 {items.length} 个商品，低库存 {lowStockCount} 个，缺货 {outCount} 个
          </p>
          </Card.Header>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">筛选</h2>
          </Card.Header>
          <Card.Content>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              placeholder="搜索商品名称"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <AppSelect
              value={filterCategoryId || "__all__"}
              onChange={(value) =>
                setFilterCategoryId(value === "__all__" ? "" : value)
              }
              placeholder="全部分类"
              options={[
                { value: "__all__", label: "全部分类" },
                ...categories.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <AppSelect
              value={stockStatus || "__all__"}
              onChange={(value) =>
                setStockStatus(
                  value === "__all__" ? "" : (value as "" | "normal" | "low" | "out"),
                )
              }
              placeholder="全部库存状态"
              options={[
                { value: "__all__", label: "全部库存状态" },
                { value: "normal", label: "正常" },
                { value: "low", label: "低库存" },
                { value: "out", label: "缺货" },
              ]}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              包含停用商品
            </label>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              className="w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto"
              onClick={() => void loadProducts()}
            >
              应用筛选
            </Button>
          </div>
          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">新增商品</h2>
          </Card.Header>
          <Card.Content>
          {!isAdmin ? (
            <p className="mt-2 text-sm text-zinc-500">
              当前账号是 USER，仅可查看，不能新增/编辑/停用。
            </p>
          ) : null}

          <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateSubmit}>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 md:col-span-2 disabled:bg-zinc-100"
              placeholder="商品名称"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              disabled={!isAdmin || saving}
              required
            />
            <AppSelect
              value={form.categoryId}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, categoryId: value }))
              }
              placeholder="选择分类"
              disabled={!isAdmin || saving}
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
            />
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100"
              placeholder="单位（个/包/瓶）"
              value={form.unit}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, unit: event.target.value }))
              }
              disabled={!isAdmin || saving}
              required
            />
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100"
              placeholder="规格（可选）"
              value={form.spec}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, spec: event.target.value }))
              }
              disabled={!isAdmin || saving}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100"
              placeholder="当前库存"
              value={form.currentStock}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  currentStock: Number(event.target.value),
                }))
              }
              disabled={!isAdmin || saving}
              required
            />
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100"
              placeholder="安全库存"
              value={form.safetyStock}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  safetyStock: Number(event.target.value),
                }))
              }
              disabled={!isAdmin || saving}
              required
            />
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100 md:col-span-2"
              placeholder="存放位置（可选）"
              value={form.location}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, location: event.target.value }))
              }
              disabled={!isAdmin || saving}
            />
            <textarea
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-100 md:col-span-2 xl:col-span-4"
              placeholder="备注（可选）"
              rows={3}
              value={form.remark}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, remark: event.target.value }))
              }
              disabled={!isAdmin || saving}
            />
            <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4 sm:flex-row">
              <Button
                type="submit"
                className="w-full bg-zinc-900 text-white hover:bg-zinc-700 sm:w-auto"
                isDisabled={!isAdmin || saving}
              >
                {saving ? "保存中..." : "创建商品"}
              </Button>
            </div>
          </form>
          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">商品列表</h2>
          </Card.Header>
          <Card.Content>
          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
              <Spinner size="sm" />
              加载中...
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-4">商品</th>
                    <th className="py-2 pr-4">分类</th>
                    <th className="py-2 pr-4">库存</th>
                    <th className="py-2 pr-4">安全库存</th>
                    <th className="py-2 pr-4">单位</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">更新时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-zinc-500" colSpan={8}>
                        没有匹配的商品，试试调整筛选条件。
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                    >
                      <td className="py-2 pr-4">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-zinc-500">
                          {item.spec || "-"} | {item.location || "-"}
                        </div>
                      </td>
                      <td className="py-2 pr-4">{item.category.name}</td>
                      <td className="py-2 pr-4">{toNumber(item.currentStock)}</td>
                      <td className="py-2 pr-4">{toNumber(item.safetyStock)}</td>
                      <td className="py-2 pr-4">{item.unit}</td>
                      <td className="py-2 pr-4">
                        {!item.isActive ? (
                          <Chip size="sm" variant="soft" color="default">
                            停用
                          </Chip>
                        ) : item.stockStatus === "out" ? (
                          <Chip size="sm" variant="soft" color="danger">
                            缺货
                          </Chip>
                        ) : item.stockStatus === "low" ? (
                          <Chip size="sm" variant="soft" color="warning">
                            低库存
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft" color="success">
                            正常
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
                              onClick={() => askDisableProduct(item)}
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
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold">编辑商品</h3>
              <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={submitEdit}>
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 md:col-span-2"
                  placeholder="商品名称"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
                <AppSelect
                  value={editForm.categoryId}
                  onChange={(value) =>
                    setEditForm((prev) => ({ ...prev, categoryId: value }))
                  }
                  placeholder="选择分类"
                  options={categories.map((item) => ({ value: item.id, label: item.name }))}
                />
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="单位（个/包/瓶）"
                  value={editForm.unit}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, unit: event.target.value }))
                  }
                  required
                />
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="规格（可选）"
                  value={editForm.spec}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, spec: event.target.value }))
                  }
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="当前库存"
                  value={editForm.currentStock}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      currentStock: Number(event.target.value),
                    }))
                  }
                  required
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="安全库存"
                  value={editForm.safetyStock}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      safetyStock: Number(event.target.value),
                    }))
                  }
                  required
                />
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 md:col-span-2"
                  placeholder="存放位置（可选）"
                  value={editForm.location}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
                <textarea
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 md:col-span-2 xl:col-span-4"
                  placeholder="备注（可选）"
                  rows={3}
                  value={editForm.remark}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, remark: event.target.value }))
                  }
                />
                <div className="flex flex-col-reverse justify-end gap-2 md:col-span-2 xl:col-span-4 sm:flex-row">
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
              <h3 className="text-lg font-semibold">确认停用商品</h3>
              <p className="mt-2 text-sm text-zinc-600">
                确认停用商品「{disableTarget.name}」吗？停用后该商品不会在常规列表中显示。
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
                  onPress={confirmDisableProduct}
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
