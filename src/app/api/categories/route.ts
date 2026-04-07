import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "分类名称不能为空").max(50, "分类名称最多 50 字"),
  sort: z.number().int().min(0).max(9999).optional().default(0),
});

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const categories = await prisma.category.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sort: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ items: categories });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const body = createCategorySchema.parse(await request.json());
    const existing = await prisma.category.findUnique({
      where: { name: body.name },
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ message: "分类名称已存在" }, { status: 409 });
      }
      const reactivated = await prisma.category.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          sort: body.sort,
        },
      });
      return NextResponse.json({ item: reactivated }, { status: 200 });
    }

    const category = await prisma.category.create({
      data: {
        name: body.name,
        sort: body.sort,
        isActive: true,
      },
    });

    return NextResponse.json({ item: category }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "创建分类失败" }, { status: 500 });
  }
}
