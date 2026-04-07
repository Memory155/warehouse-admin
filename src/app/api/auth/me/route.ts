import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.sub },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      canManageUsers: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      sub: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      canManageUsers: user.role === "SUPER_ADMIN" ? true : user.canManageUsers,
    },
  });
}
