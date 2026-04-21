import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { buildProductExportWorkbook } from "@/lib/products/excel";

function getStockStatus(currentStock: number, safetyStock: number) {
  if (currentStock === 0) return "out" as const;
  if (currentStock <= safetyStock) return "low" as const;
  return "normal" as const;
}

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const q = (url.searchParams.get("q") ?? "").trim();
  const categoryId = (url.searchParams.get("categoryId") ?? "").trim();
  const stockStatus = (url.searchParams.get("stockStatus") ?? "").trim();

  const products = await prisma.product.findMany({
    where: {
      isActive: includeInactive ? undefined : true,
      name: q
        ? {
            contains: q,
            mode: "insensitive",
          }
        : undefined,
      categoryId: categoryId || undefined,
    },
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const filtered = products.filter((item) => {
    if (!stockStatus) return true;
    return (
      getStockStatus(Number(item.currentStock), Number(item.safetyStock)) === stockStatus
    );
  });

  const workbookBuffer = await buildProductExportWorkbook(
    filtered.map((item) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      spec: item.spec,
      currentStock: Number(item.currentStock),
      safetyStock: Number(item.safetyStock),
      location: item.location,
      remark: item.remark,
      isActive: item.isActive,
      updatedAt: item.updatedAt,
      category: item.category,
    })),
  );

  return new NextResponse(new Uint8Array(workbookBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="warehouse-products-export.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
