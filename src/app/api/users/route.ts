import bcrypt from "bcryptjs";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canGrantUserManagement, getUserManagementActor, hasUserManagementAccess } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const createUserSchema = z.object({
  username: z.string().trim().min(2, "用户名至少 2 位").max(32, "用户名最多 32 位"),
  password: z.string().min(8, "初始密码至少 8 位"),
  role: z.nativeEnum(Role).default(Role.USER),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  avatarUrl: z.union([z.string().trim().url("头像地址格式不正确"), z.literal("")]).optional(),
  canManageUsers: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const allowed = await hasUserManagementAccess(auth.user!.sub);
  if (!allowed) {
    return NextResponse.json({ message: "无权限访问用户管理" }, { status: 403 });
  }

  const items = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      sort: true,
      role: true,
      canManageUsers: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });

  const sortedItems = items.sort((left, right) => {
    const leftIsSuperAdmin = left.role === Role.SUPER_ADMIN;
    const rightIsSuperAdmin = right.role === Role.SUPER_ADMIN;

    if (leftIsSuperAdmin && !rightIsSuperAdmin) return -1;
    if (!leftIsSuperAdmin && rightIsSuperAdmin) return 1;

    if (leftIsSuperAdmin && rightIsSuperAdmin) {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (left.sort !== right.sort) {
      return left.sort - right.sort;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  return NextResponse.json({ items: sortedItems });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const actor = await getUserManagementActor(auth.user!.sub);
  if (!actor || actor.status !== "ACTIVE" || !(actor.role === "SUPER_ADMIN" || actor.canManageUsers)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const body = createUserSchema.parse(await request.json());
    const actorCanGrant = canGrantUserManagement(actor.role);

    if (!actorCanGrant && body.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ message: "仅超级管理员可创建超级管理员" }, { status: 403 });
    }

    if (!actorCanGrant && body.canManageUsers === true) {
      return NextResponse.json({ message: "仅超级管理员可下放用户管理权限" }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const nextSortBase = await prisma.user.aggregate({
      _max: { sort: true },
      where: body.role === Role.SUPER_ADMIN ? { role: Role.SUPER_ADMIN } : { role: { not: Role.SUPER_ADMIN } },
    });

    const created = await prisma.user.create({
      data: {
        username: body.username,
        passwordHash,
        role: body.role,
        status: body.status,
        avatarUrl: body.avatarUrl && body.avatarUrl.length > 0 ? body.avatarUrl : null,
        sort: body.role === Role.SUPER_ADMIN ? 0 : (nextSortBase._max.sort ?? 0) + 10,
        canManageUsers:
          body.role === Role.SUPER_ADMIN
            ? true
            : actorCanGrant
              ? (body.canManageUsers ?? false)
              : false,
      },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        sort: true,
        role: true,
        canManageUsers: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ message: "用户创建成功", item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "参数错误" },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) {
      return NextResponse.json({ message: "用户名已存在" }, { status: 409 });
    }

    return NextResponse.json({ message: "创建用户失败，请稍后重试" }, { status: 500 });
  }
}
