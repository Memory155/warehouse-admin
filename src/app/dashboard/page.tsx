"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Spinner } from "@heroui/react";

type DashboardSummary = {
  productCount: number;
  categoriesCount: number;
  lowStockCount: number;
  outStockCount: number;
  todayLogCount: number;
};

type RecentLog = {
  id: string;
  type: "IN" | "OUT" | "ADJUST" | "DAMAGE" | "MANUAL";
  quantity: string | number;
  beforeStock: string | number;
  afterStock: string | number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    unit: string;
  };
  operator: {
    id: string;
    username: string;
  };
};

type AuthUser = {
  sub: string;
  username: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
};

function typeLabel(type: RecentLog["type"]) {
  if (type === "IN") return "入库";
  if (type === "OUT") return "出库";
  if (type === "ADJUST") return "盘点调整";
  if (type === "DAMAGE") return "报损";
  return "手工修正";
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [meResponse, summaryResponse] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/dashboard/summary"),
      ]);

      if (meResponse.status === 401) {
        router.replace("/login");
        return;
      }

      if (meResponse.ok) {
        const meData = (await meResponse.json()) as { user?: AuthUser };
        setUser(meData.user ?? null);
      } else {
        setError("用户信息加载失败，请刷新重试");
      }

      const summaryData = (await summaryResponse.json()) as {
        message?: string;
        summary?: DashboardSummary;
        recentLogs?: RecentLog[];
      };

      if (!summaryResponse.ok) {
        setError(summaryData.message ?? "加载看板数据失败");
        return;
      }

      setSummary(summaryData.summary ?? null);
      setRecentLogs(summaryData.recentLogs ?? []);
    } catch {
      setError("加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4">
        <Card className="border border-zinc-200/70 shadow-sm">
          <Card.Header>
          <div>
            <h1 className="text-2xl font-semibold">首页</h1>
            <p className="mt-1 text-sm text-zinc-600">
              你好，{user?.username ?? "-"}（{user?.role ?? "-"}）
            </p>
          </div>
          </Card.Header>
        </Card>

        {loading ? (
          <Card className="border border-zinc-200/70 shadow-sm">
            <Card.Content>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Spinner size="sm" />
                加载看板数据中...
              </div>
            </Card.Content>
          </Card>
        ) : null}

        {error ? (
          <Card className="border border-red-200 bg-red-50 shadow-sm">
            <Card.Content>
            <p className="text-sm text-red-600">{error}</p>
            </Card.Content>
          </Card>
        ) : null}

        {summary ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border border-zinc-200/70 shadow-sm">
              <Card.Content>
              <p className="text-xs text-zinc-500">商品总数</p>
              <p className="mt-2 text-2xl font-semibold">{summary.productCount}</p>
              </Card.Content>
            </Card>
            <Card className="border border-zinc-200/70 shadow-sm">
              <Card.Content>
              <p className="text-xs text-zinc-500">分类总数</p>
              <p className="mt-2 text-2xl font-semibold">{summary.categoriesCount}</p>
              </Card.Content>
            </Card>
            <Card className="border border-amber-200/80 bg-amber-50/60 shadow-sm">
              <Card.Content>
              <p className="text-xs text-zinc-500">低库存商品</p>
              <p className="mt-2 text-2xl font-semibold text-amber-700">
                {summary.lowStockCount}
              </p>
              </Card.Content>
            </Card>
            <Card className="border border-red-200/80 bg-red-50/60 shadow-sm">
              <Card.Content>
              <p className="text-xs text-zinc-500">缺货商品</p>
              <p className="mt-2 text-2xl font-semibold text-red-700">
                {summary.outStockCount}
              </p>
              </Card.Content>
            </Card>
            <Card className="border border-zinc-200/70 shadow-sm">
              <Card.Content>
              <p className="text-xs text-zinc-500">今日变动次数</p>
              <p className="mt-2 text-2xl font-semibold">{summary.todayLogCount}</p>
              </Card.Content>
            </Card>
          </section>
        ) : null}

        <Card className="border border-zinc-200/70 shadow-sm">
          <Card.Header className="flex items-center justify-between">
          <h2 className="text-lg font-medium">最近库存变动</h2>
          <Chip size="sm" variant="soft" color="default">
            最近 10 条
          </Chip>
          </Card.Header>
          <Card.Content>
          {recentLogs.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">暂无记录</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-600">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">商品</th>
                    <th className="py-2 pr-4">类型</th>
                    <th className="py-2 pr-4">数量</th>
                    <th className="py-2 pr-4">变动前</th>
                    <th className="py-2 pr-4">变动后</th>
                    <th className="py-2">操作人</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="py-2 pr-4">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        {item.product.name}（{item.product.unit}）
                      </td>
                      <td className="py-2 pr-4">{typeLabel(item.type)}</td>
                      <td className="py-2 pr-4">{Number(item.quantity)}</td>
                      <td className="py-2 pr-4">{Number(item.beforeStock)}</td>
                      <td className="py-2 pr-4">{Number(item.afterStock)}</td>
                      <td className="py-2">{item.operator.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </Card.Content>
        </Card>
      </div>
  );
}
