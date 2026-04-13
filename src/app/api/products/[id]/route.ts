import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { deleteFromSupabaseStorage } from "@/lib/storage/supabase";

const productImageSchema = z.object({
  imageUrl: z.string().trim().max(500, "图片地址过长").optional().default(""),
  imageKey: z.string().trim().max(500, "图片标识过长").optional().default(""),
  imageMimeType: z.string().trim().max(100, "图片类型过长").optional().default(""),
  imageSize: z.coerce.number().int().min(0, "图片大小无效").nullable().optional(),
}).superRefine((data, context) => {
  const hasUrl = Boolean(data.imageUrl);
  const hasKey = Boolean(data.imageKey);

  if (hasUrl !== hasKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "商品图片信息不完整，请重新上传",
      path: ["imageUrl"],
    });
  }
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1, "商品名称不能为空").max(100, "商品名称最多 100 字"),
  categoryId: z.string().trim().min(1, "请选择分类"),
  unit: z.string().trim().min(1, "单位不能为空").max(20, "单位最多 20 字"),
  spec: z.string().trim().max(100, "规格最多 100 字").optional().default(""),
  currentStock: z.coerce.number().min(0, "当前库存不能小于 0"),
  safetyStock: z.coerce.number().min(0, "安全库存不能小于 0"),
  location: z.string().trim().max(100, "存放位置最多 100 字").optional().default(""),
  remark: z.string().trim().max(300, "备注最多 300 字").optional().default(""),
}).merge(productImageSchema);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { response } = await requireAuth();
  if (response) return response;

  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ message: "商品不存在" }, { status: 404 });
  }

  return NextResponse.json({ item: product });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const body = updateProductSchema.parse(await request.json());

    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, imageKey: true },
    });
    if (!product) {
      return NextResponse.json({ message: "商品不存在" }, { status: 404 });
    }

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category || !category.isActive) {
      return NextResponse.json({ message: "分类不存在或已停用" }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        categoryId: body.categoryId,
        imageUrl: body.imageUrl || null,
        imageKey: body.imageKey || null,
        imageMimeType: body.imageMimeType || null,
        imageSize: body.imageKey ? body.imageSize ?? null : null,
        unit: body.unit,
        spec: body.spec || null,
        currentStock: body.currentStock,
        safetyStock: body.safetyStock,
        location: body.location || null,
        remark: body.remark || null,
        updatedBy: auth.user.sub,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (product.imageKey && product.imageKey !== updated.imageKey) {
      try {
        await deleteFromSupabaseStorage(product.imageKey);
      } catch {
        // Ignore cleanup failures so product updates still succeed.
      }
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "更新商品失败" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!product) {
    return NextResponse.json({ message: "商品不存在" }, { status: 404 });
  }

  if (!product.isActive) {
    return NextResponse.json({ message: "商品已停用" }, { status: 409 });
  }

  const disabled = await prisma.product.update({
    where: { id },
    data: {
      isActive: false,
      updatedBy: auth.user.sub,
    },
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ item: disabled });
}
