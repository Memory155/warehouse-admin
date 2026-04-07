import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "当前密码至少 6 位"),
    newPassword: z.string().min(8, "新密码至少 8 位"),
    confirmPassword: z.string().min(8, "确认密码至少 8 位"),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "两次输入的新密码不一致",
      });
    }

    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "新密码不能与当前密码相同",
      });
    }
  });

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const json = await request.json();
    const body = updatePasswordSchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { id: auth.user!.sub },
      select: { id: true, passwordHash: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ message: "用户不存在或已停用" }, { status: 404 });
    }

    const matched = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!matched) {
      return NextResponse.json({ message: "当前密码错误" }, { status: 400 });
    }

    const newHash = await bcrypt.hash(body.newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ message: "密码已更新" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "更新密码失败，请稍后重试" }, { status: 500 });
  }
}
