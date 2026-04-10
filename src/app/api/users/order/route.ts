import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { getUserManagementActor } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const updateUserOrderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "排序列表不能为空"),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const actor = await getUserManagementActor(auth.user!.sub);
  if (!actor || actor.status !== "ACTIVE" || !(actor.role === "SUPER_ADMIN" || actor.canManageUsers)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const body = updateUserOrderSchema.parse(await request.json());

    const ids = Array.from(new Set(body.ids));
    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: ids },
        role: { not: Role.SUPER_ADMIN },
      },
      select: { id: true },
    });

    if (existingUsers.length !== ids.length) {
      return NextResponse.json(
        { message: "仅支持对非超级管理员账号排序" },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.user.update({
          where: { id },
          data: { sort: (index + 1) * 10 },
        }),
      ),
    );

    return NextResponse.json({ message: "用户排序已更新" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }

    return NextResponse.json({ message: "保存排序失败，请稍后重试" }, { status: 500 });
  }
}
