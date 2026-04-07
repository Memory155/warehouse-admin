import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

function toNumber(value: unknown) {
  return Number(value);
}

export async function GET() {
  const { response } = await requireAuth();
  if (response) return response;

  const [activeProducts, categoriesCount, recentLogs] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, currentStock: true, safetyStock: true },
    }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.stockLog.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 10,
      include: {
        product: {
          select: { id: true, name: true, unit: true },
        },
        operator: {
          select: { id: true, username: true },
        },
      },
    }),
  ]);

  const productCount = activeProducts.length;
  const lowStockCount = activeProducts.filter((item) => {
    const current = toNumber(item.currentStock);
    const safety = toNumber(item.safetyStock);
    return current <= safety;
  }).length;
  const outStockCount = activeProducts.filter((item) => {
    return toNumber(item.currentStock) === 0;
  }).length;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayLogCount = await prisma.stockLog.count({
    where: {
      createdAt: { gte: startOfDay },
    },
  });

  return NextResponse.json({
    summary: {
      productCount,
      categoriesCount,
      lowStockCount,
      outStockCount,
      todayLogCount,
    },
    recentLogs,
  });
}
