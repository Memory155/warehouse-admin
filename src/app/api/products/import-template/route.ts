import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { buildProductImportTemplateWorkbook } from "@/lib/products/excel";

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  const workbookBuffer = buildProductImportTemplateWorkbook(categories);

  return new NextResponse(new Uint8Array(workbookBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="warehouse-products-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
