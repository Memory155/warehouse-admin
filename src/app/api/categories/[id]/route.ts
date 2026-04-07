import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "分类名称不能为空").max(50, "分类名称最多 50 字"),
  sort: z.number().int().min(0).max(9999).optional().default(0),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = updateCategorySchema.parse(await request.json());

    const category = await prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      return NextResponse.json({ message: "分类不存在" }, { status: 404 });
    }

    const duplicate = await prisma.category.findFirst({
      where: {
        name: body.name,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ message: "分类名称已存在" }, { status: 409 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        sort: body.sort,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "更新分类失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  const { id } = await context.params;

  const category = await prisma.category.findUnique({
    where: { id },
  });

  if (!category) {
    return NextResponse.json({ message: "分类不存在" }, { status: 404 });
  }

  const activeProductsCount = await prisma.product.count({
    where: {
      categoryId: id,
      isActive: true,
    },
  });

  if (activeProductsCount > 0) {
    return NextResponse.json(
      { message: "该分类下还有启用商品，不能停用" },
      { status: 409 },
    );
  }

  const disabled = await prisma.category.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ item: disabled });
}
