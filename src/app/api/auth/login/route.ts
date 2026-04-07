import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, AUTH_EXPIRES_IN } from "@/lib/auth/constants";
import { signAuthToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";

const loginBodySchema = z.object({
  username: z.string().trim().min(1, "用户名不能为空"),
  password: z.string().min(6, "密码至少 6 位"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const body = loginBodySchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { username: body.username },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    const token = await signAuthToken(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
      },
      AUTH_EXPIRES_IN,
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

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
    return NextResponse.json({ message: "登录失败，请稍后重试" }, { status: 500 });
  }
}
