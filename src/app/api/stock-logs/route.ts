import { NextResponse } from "next/server";
import { Prisma, StockLogType } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

const stockTypeSchema = z.enum(["IN", "OUT", "ADJUST", "DAMAGE", "MANUAL"]);

const createStockLogSchema = z
  .object({
    productId: z.string().trim().min(1, "请选择商品"),
    type: stockTypeSchema,
    quantity: z.coerce.number(),
    targetStock: z.coerce.number().optional(),
    remark: z.string().trim().max(300, "备注最多 300 字").optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.type === "ADJUST") {
      if (value.targetStock === undefined || Number.isNaN(value.targetStock)) {
        ctx.addIssue({
          code: "custom",
          message: "盘点调整必须填写目标库存",
          path: ["targetStock"],
        });
      }
      if (value.targetStock !== undefined && value.targetStock < 0) {
        ctx.addIssue({
          code: "custom",
          message: "目标库存不能小于 0",
          path: ["targetStock"],
        });
      }
      return;
    }

    if (value.quantity <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "数量必须大于 0",
        path: ["quantity"],
      });
    }
  });

function toDecimal(input: number) {
  return new Prisma.Decimal(input.toFixed(2));
}

function calcAfterStock(
  type: StockLogType,
  before: Prisma.Decimal,
  quantity: number,
  targetStock?: number,
) {
  if (type === "ADJUST") {
    return toDecimal(targetStock ?? 0);
  }
  const amount = toDecimal(Math.abs(quantity));
  if (type === "IN") return before.plus(amount);
  if (type === "OUT" || type === "DAMAGE") return before.minus(amount);
  if (type === "MANUAL") return before.plus(amount);
  return before;
}

export async function GET(request: Request) {
  const { response } = await requireAuth();
  if (response) return response;

  const url = new URL(request.url);
  const productId = (url.searchParams.get("productId") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "").trim();
  const dateFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const dateTo = (url.searchParams.get("dateTo") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.trunc(limitRaw)))
    : 50;

  const where: Prisma.StockLogWhereInput = {
    productId: productId || undefined,
    type: stockTypeSchema.safeParse(type).success
      ? (type as StockLogType)
      : undefined,
    createdAt:
      dateFrom || dateTo
        ? {
            gte: dateFrom ? new Date(dateFrom) : undefined,
            lte: dateTo ? new Date(dateTo) : undefined,
          }
        : undefined,
  };

  const items = await prisma.stockLog.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          unit: true,
          isActive: true,
        },
      },
      operator: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const body = createStockLogSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: body.productId },
      });

      if (!product || !product.isActive) {
        throw new Error("PRODUCT_NOT_FOUND_OR_DISABLED");
      }

      const before = product.currentStock;
      const after = calcAfterStock(body.type, before, body.quantity, body.targetStock);

      if (after.lessThan(0)) {
        throw new Error("NEGATIVE_STOCK_NOT_ALLOWED");
      }

      let logQuantity = toDecimal(Math.abs(body.quantity));
      if (body.type === "ADJUST") {
        logQuantity = after.minus(before).abs();
      }

      const log = await tx.stockLog.create({
        data: {
          productId: product.id,
          type: body.type,
          quantity: logQuantity,
          beforeStock: before,
          afterStock: after,
          remark: body.remark || null,
          operatorId: auth.user!.sub,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
          operator: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: {
          currentStock: after,
          updatedBy: auth.user!.sub,
        },
      });

      return log;
    });

    return NextResponse.json({ item: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      if (error.message === "PRODUCT_NOT_FOUND_OR_DISABLED") {
        return NextResponse.json(
          { message: "商品不存在或已停用" },
          { status: 404 },
        );
      }
      if (error.message === "NEGATIVE_STOCK_NOT_ALLOWED") {
        return NextResponse.json(
          { message: "操作后库存不能小于 0" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ message: "库存变动提交失败" }, { status: 500 });
  }
}
