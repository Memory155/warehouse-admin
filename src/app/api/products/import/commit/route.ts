import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const commitRowSchema = z.object({
  rowNumber: z.number().int().min(2),
  action: z.enum(["create", "update"]),
  name: z.string().trim().min(1).max(100),
  categoryId: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  unit: z.string().trim().min(1).max(20),
  spec: z.string().trim().max(100),
  currentStock: z.number().min(0),
  safetyStock: z.number().min(0),
  location: z.string().trim().max(100),
  remark: z.string().trim().max(300),
  isActive: z.boolean(),
});

const commitBodySchema = z.object({
  rows: z.array(commitRowSchema).min(1, "没有可导入的数据"),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const body = commitBodySchema.parse(await request.json());

    const categoryIds = [...new Set(body.rows.map((item) => item.categoryId))];
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (categories.length !== categoryIds.length) {
      return NextResponse.json({ message: "存在无效或已停用的分类，请重新预校验" }, { status: 400 });
    }

    const existingProducts = await prisma.product.findMany({
      where: {
        OR: body.rows.map((item) => ({
          name: item.name,
          categoryId: item.categoryId,
        })),
      },
      select: {
        id: true,
        name: true,
        categoryId: true,
      },
    });

    const existingMap = new Map(
      existingProducts.map((item) => [`${item.name}::${item.categoryId}`, item.id]),
    );

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of body.rows) {
        const key = `${row.name}::${row.categoryId}`;
        const existingId = existingMap.get(key);

        if (existingId) {
          await tx.product.update({
            where: { id: existingId },
            data: {
              name: row.name,
              categoryId: row.categoryId,
              unit: row.unit,
              spec: row.spec || null,
              currentStock: row.currentStock,
              safetyStock: row.safetyStock,
              location: row.location || null,
              remark: row.remark || null,
              isActive: row.isActive,
              updatedBy: auth.user!.sub,
            },
          });
          updatedCount += 1;
          continue;
        }

        await tx.product.create({
          data: {
            name: row.name,
            categoryId: row.categoryId,
            unit: row.unit,
            spec: row.spec || null,
            currentStock: row.currentStock,
            safetyStock: row.safetyStock,
            location: row.location || null,
            remark: row.remark || null,
            isActive: row.isActive,
            createdBy: auth.user!.sub,
            updatedBy: auth.user!.sub,
          },
        });
        createdCount += 1;
      }
    });

    return NextResponse.json({
      message: `导入完成，新增 ${createdCount} 条，更新 ${updatedCount} 条`,
      summary: {
        createdCount,
        updatedCount,
        total: createdCount + updatedCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "商品导入失败，请稍后重试" }, { status: 500 });
  }
}
