import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { AUTH_COOKIE_NAME, AUTH_EXPIRES_IN } from "@/lib/auth/constants";
import { signAuthToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

const updateProfileSchema = z.object({
  username: z.string().trim().min(2, "用户名至少 2 位").max(32, "用户名最多 32 位"),
  avatarUrl: z
    .union([z.string().trim().url("头像地址格式不正确"), z.literal("")])
    .optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user!.sub },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      canManageUsers: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ message: "用户不存在或已停用" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  try {
    const json = await request.json();
    const body = updateProfileSchema.parse(json);

    const exists = await prisma.user.findFirst({
      where: {
        username: body.username,
        id: { not: auth.user!.sub },
      },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json({ message: "用户名已存在" }, { status: 409 });
    }

    const user = await prisma.user.update({
      where: { id: auth.user!.sub },
      data: {
        username: body.username,
        avatarUrl: body.avatarUrl && body.avatarUrl.length > 0 ? body.avatarUrl : null,
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        canManageUsers: true,
      },
    });

    const token = await signAuthToken(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
      },
      AUTH_EXPIRES_IN,
    );

    const response = NextResponse.json({ message: "资料已更新", user });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AUTH_EXPIRES_IN,
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "更新失败，请稍后重试" }, { status: 500 });
  }
}
