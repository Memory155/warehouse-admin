import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { parseProductImportWorkbook } from "@/lib/products/excel";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请上传 Excel 文件" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ message: "仅支持 .xlsx 文件" }, { status: 400 });
    }

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        select: { id: true, name: true, isActive: true },
      }),
      prisma.product.findMany({
        select: { id: true, name: true, categoryId: true },
      }),
    ]);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const preview = parseProductImportWorkbook(fileBuffer, categories, products);

    return NextResponse.json(preview);
  } catch {
    return NextResponse.json({ message: "解析 Excel 失败，请检查文件格式" }, { status: 400 });
  }
}
