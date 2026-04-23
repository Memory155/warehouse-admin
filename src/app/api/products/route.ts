import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const stockStatusEnum = z.enum(["normal", "low", "out"]);
const pageSizeEnum = z.enum(["10", "20", "50", "100"]);
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

const createProductSchema = z.object({
  name: z.string().trim().min(1, "商品名称不能为空").max(100, "商品名称最多 100 字"),
  categoryId: z.string().trim().min(1, "请选择分类"),
  unit: z.string().trim().min(1, "单位不能为空").max(20, "单位最多 20 字"),
  spec: z.string().trim().max(100, "规格最多 100 字").optional().default(""),
  currentStock: z.coerce.number().min(0, "当前库存不能小于 0"),
  safetyStock: z.coerce.number().min(0, "安全库存不能小于 0"),
  location: z.string().trim().max(100, "存放位置最多 100 字").optional().default(""),
  remark: z.string().trim().max(300, "备注最多 300 字").optional().default(""),
}).merge(productImageSchema);

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
  const stockStatusRaw = (url.searchParams.get("stockStatus") ?? "").trim();
  const pageRaw = url.searchParams.get("page") ?? "1";
  const pageSizeRaw = url.searchParams.get("pageSize") ?? "10";

  const stockStatus = stockStatusEnum.safeParse(stockStatusRaw);
  const parsedPage = Number(pageRaw);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = pageSizeEnum.safeParse(pageSizeRaw).success
    ? Number(pageSizeRaw)
    : 10;

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

  const withStatus = products.map((item) => {
    const current = Number(item.currentStock);
    const safety = Number(item.safetyStock);
    return {
      ...item,
      stockStatus: getStockStatus(current, safety),
    };
  });

  const items =
    stockStatus.success && stockStatus.data
      ? withStatus.filter((item) => item.stockStatus === stockStatus.data)
      : withStatus;

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);
  const lowStockCount = items.filter((item) => item.stockStatus === "low").length;
  const outCount = items.filter((item) => item.stockStatus === "out").length;

  return NextResponse.json({
    items: pagedItems,
    pagination: {
      page: currentPage,
      pageSize,
      total,
      totalPages,
    },
    summary: {
      lowStockCount,
      outCount,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const body = createProductSchema.parse(await request.json());

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true, isActive: true },
    });

    if (!category || !category.isActive) {
      return NextResponse.json({ message: "分类不存在或已停用" }, { status: 400 });
    }

    const created = await prisma.product.create({
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
        isActive: true,
        createdBy: auth.user.sub,
        updatedBy: auth.user.sub,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "创建商品失败" }, { status: 500 });
  }
}
