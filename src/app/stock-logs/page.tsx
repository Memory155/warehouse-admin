"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Spinner, Toast } from "@heroui/react";
import AppSelect from "@/components/app-select";

type Product = {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
};

type StockLog = {
  id: string;
  productId: string;
  type: "IN" | "OUT" | "ADJUST" | "DAMAGE" | "MANUAL";
  quantity: string | number;
  beforeStock: string | number;
  afterStock: string | number;
  remark: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    unit: string;
    isActive: boolean;
  };
  operator: {
    id: string;
    username: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
  };
};

type AuthMeResponse = {
  user?: {
    sub: string;
    username: string;
    role: "SUPER_ADMIN" | "ADMIN" | "USER";
  };
};

type CreateForm = {
  productId: string;
  type: "" | "IN" | "OUT" | "ADJUST" | "DAMAGE" | "MANUAL";
  quantity: number;
  targetStock: number;
  remark: string;
};

const initialCreateForm: CreateForm = {
  productId: "",
  type: "",
  quantity: 1,
  targetStock: 0,
  remark: "",
};

function toNumber(value: string | number) {
  return Number(value);
}

function typeLabel(type: StockLog["type"]) {
  if (type === "IN") return "入库";
  if (type === "OUT") return "出库";
  if (type === "ADJUST") return "盘点调整";
  if (type === "DAMAGE") return "报损";
  return "手工修正";
}

export default function StockLogsPage() {
  const [role, setRole] = useState<"SUPER_ADMIN" | "ADMIN" | "USER">("USER");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<StockLog[]>([]);
  const [form, setForm] = useState<CreateForm>(initialCreateForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filterProductId, setFilterProductId] = useState("");
  const [filterType, setFilterType] = useState<
    "" | "IN" | "OUT" | "ADJUST" | "DAMAGE" | "MANUAL"
  >("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";

  useEffect(() => {
    void loadCurrentUser();
    void loadProducts();
    void loadLogs();
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

  async function loadProducts() {
    const response = await fetch("/api/products");
    const data = (await response.json()) as { items?: Product[] };
    setProducts((data.items ?? []).filter((item) => item.isActive));
  }

  async function loadLogs() {
    setLoading(true);

    const params = new URLSearchParams();
    params.set("limit", "100");
    if (filterProductId) params.set("productId", filterProductId);
    if (filterType) params.set("type", filterType);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const response = await fetch(`/api/stock-logs?${params.toString()}`);
      const data = (await response.json()) as {
        items?: StockLog[];
        message?: string;
      };

      if (!response.ok) {
        Toast.toast.danger(data.message ?? "加载库存记录失败");
        return;
      }

      setItems(data.items ?? []);
    } catch {
      Toast.toast.danger("加载库存记录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    if (!form.productId) {
      const message = "请选择商品";
      Toast.toast.danger(message);
      setSaving(false);
      return;
    }

    if (!form.type) {
      const message = "请选择变动类型";
      Toast.toast.danger(message);
      setSaving(false);
      return;
    }

    const payload =
      form.type === "ADJUST"
        ? {
            productId: form.productId,
            type: form.type,
            quantity: 0,
            targetStock: form.targetStock,
            remark: form.remark,
          }
        : {
            productId: form.productId,
            type: form.type,
            quantity: form.quantity,
            remark: form.remark,
          };

    try {
      const response = await fetch("/api/stock-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        const message = data.message ?? "提交失败";
        Toast.toast.danger(message);
        return;
      }

      Toast.toast.success("库存变动已记录");
      setForm((prev) => ({ ...initialCreateForm, productId: prev.productId }));
      await loadLogs();
    } catch {
      const message = "提交失败，请稍后重试";
      Toast.toast.danger(message);
    } finally {
      setSaving(false);
    }
  }

  const lowOrOutCount = useMemo(() => {
    return items.filter((item) => toNumber(item.afterStock) <= 0).length;
  }, [items]);

  return (
    <div className="w-full space-y-4">
        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h1 className="text-2xl font-semibold">库存记录</h1>
          <p className="mt-1 text-sm text-zinc-600">
            最近记录 {items.length} 条，变动后库存为 0 的记录 {lowOrOutCount} 条
          </p>
          </Card.Header>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">新增库存变动</h2>
          </Card.Header>
          <Card.Content>
          {!isAdmin ? (
            <p className="mt-2 text-sm text-zinc-500">
              当前账号是 USER，可提交变动；如需限制可在后续收紧权限。
            </p>
          ) : null}

          <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <AppSelect
                value={form.productId}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, productId: value }))
                }
                placeholder="选择商品"
                options={products.map((item) => ({
                  value: item.id,
                  label: `${item.name}（${item.unit}）`,
                }))}
              />
            </div>

            <AppSelect
              value={form.type}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  type: value as CreateForm["type"],
                }))
              }
              placeholder="请选择类型"
              options={[
                { value: "IN", label: "入库" },
                { value: "OUT", label: "出库" },
                { value: "ADJUST", label: "盘点调整" },
                { value: "DAMAGE", label: "报损" },
                { value: "MANUAL", label: "手工修正" },
              ]}
            />

            {form.type === "ADJUST" ? (
              <input
                type="number"
                min={0}
                step="0.01"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                value={form.targetStock}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    targetStock: Number(event.target.value),
                  }))
                }
                placeholder="目标库存"
                required
              />
            ) : (
              <input
                type="number"
                min={0.01}
                step="0.01"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                value={form.quantity}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    quantity: Number(event.target.value),
                  }))
                }
                placeholder="数量"
                required
              />
            )}

            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 sm:col-span-3"
              value={form.remark}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, remark: event.target.value }))
              }
              placeholder="备注（可选）"
            />

            <Button
              type="submit"
              className="bg-zinc-900 text-white hover:bg-zinc-700"
              isDisabled={saving}
            >
              {saving ? "提交中..." : "提交变动"}
            </Button>
          </form>

          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header>
          <h2 className="text-lg font-medium">变动记录筛选</h2>
          </Card.Header>
          <Card.Content>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            <AppSelect
              value={filterProductId || "__all__"}
              onChange={(value) =>
                setFilterProductId(value === "__all__" ? "" : value)
              }
              placeholder="全部商品"
              options={[
                { value: "__all__", label: "全部商品" },
                ...products.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
            <AppSelect
              value={filterType || "__all__"}
              onChange={(value) =>
                setFilterType(
                  value === "__all__"
                    ? ""
                    : (value as "" | "IN" | "OUT" | "ADJUST" | "DAMAGE" | "MANUAL"),
                )
              }
              placeholder="全部类型"
              options={[
                { value: "__all__", label: "全部类型" },
                { value: "IN", label: "入库" },
                { value: "OUT", label: "出库" },
                { value: "ADJUST", label: "盘点调整" },
                { value: "DAMAGE", label: "报损" },
                { value: "MANUAL", label: "手工修正" },
              ]}
            />
            <input
              type="datetime-local"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <input
              type="datetime-local"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <Button
              type="button"
              className="bg-zinc-900 text-white hover:bg-zinc-700"
              onClick={() => void loadLogs()}
            >
              应用筛选
            </Button>
          </div>
          </Card.Content>
        </Card>

        <Card className="border border-zinc-200/70 bg-white/90 shadow-sm">
          <Card.Header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">库存变动列表</h2>
          <Chip size="sm" variant="soft" color="default">
            最近 100 条
          </Chip>
          </Card.Header>
          <Card.Content>
          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
              <Spinner size="sm" />
              加载中...
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">商品</th>
                    <th className="py-2 pr-4">类型</th>
                    <th className="py-2 pr-4">数量</th>
                    <th className="py-2 pr-4">变动前</th>
                    <th className="py-2 pr-4">变动后</th>
                    <th className="py-2 pr-4">操作人</th>
                    <th className="py-2">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-zinc-500" colSpan={8}>
                        暂无库存变动记录。
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80"
                    >
                      <td className="py-2 pr-4">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        {item.product.name}（{item.product.unit}）
                      </td>
                      <td className="py-2 pr-4">{typeLabel(item.type)}</td>
                      <td className="py-2 pr-4">{toNumber(item.quantity)}</td>
                      <td className="py-2 pr-4">{toNumber(item.beforeStock)}</td>
                      <td className="py-2 pr-4">{toNumber(item.afterStock)}</td>
                      <td className="py-2 pr-4">{item.operator.username}</td>
                      <td className="py-2">{item.remark || "-"}</td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          </Card.Content>
        </Card>
      </div>
  );
}
