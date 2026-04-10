import bcrypt from "bcryptjs";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/guard";
import { canGrantUserManagement, getUserManagementActor } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const updateUserSchema = z.object({
  username: z.string().trim().min(2, "用户名至少 2 位").max(32, "用户名最多 32 位").optional(),
  avatarUrl: z.union([z.string().trim().url("头像地址格式不正确"), z.literal("")]).optional(),
  sort: z.number().int().min(0).max(999999).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  canManageUsers: z.boolean().optional(),
  resetPassword: z.string().min(8, "重置密码至少 8 位").optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureActorCanManage(authUserId: string) {
  const actor = await getUserManagementActor(authUserId);
  if (!actor || actor.status !== "ACTIVE") return null;
  if (actor.role !== "SUPER_ADMIN" && !actor.canManageUsers) return null;
  return actor;
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const actor = await ensureActorCanManage(auth.user!.sub);
  if (!actor) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "参数错误" }, { status: 400 });
  }

  if (id === actor.id) {
    return NextResponse.json(
      { message: "请在设置页面修改自己的账号信息" },
      { status: 400 },
    );
  }

  try {
    const body = updateUserSchema.parse(await request.json());

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        sort: true,
        role: true,
        status: true,
        canManageUsers: true,
      },
    });

    if (!target) {
      return NextResponse.json({ message: "用户不存在" }, { status: 404 });
    }

    const actorCanGrant = canGrantUserManagement(actor.role);

    if (!actorCanGrant && target.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "仅超级管理员可管理超级管理员" },
        { status: 403 },
      );
    }

    if (!actorCanGrant && body.role === Role.SUPER_ADMIN) {
      return NextResponse.json({ message: "仅超级管理员可设置超级管理员" }, { status: 403 });
    }

    if (!actorCanGrant && body.canManageUsers !== undefined) {
      return NextResponse.json(
        { message: "仅超级管理员可下放用户管理权限" },
        { status: 403 },
      );
    }

    const nextRole = body.role ?? target.role;
    const nextStatus = body.status ?? target.status;
    const isSuperAdminDowngrade =
      target.role === "SUPER_ADMIN"
      && (nextRole !== "SUPER_ADMIN" || nextStatus !== "ACTIVE");

    if (isSuperAdminDowngrade) {
      const activeSuperAdmins = await prisma.user.count({
        where: {
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      });

      if (activeSuperAdmins <= 1) {
        return NextResponse.json(
          { message: "系统至少需要保留一个启用中的超级管理员" },
          { status: 400 },
        );
      }
    }

    if (body.username) {
      const duplicated = await prisma.user.findFirst({
        where: {
          username: body.username,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicated) {
        return NextResponse.json({ message: "用户名已存在" }, { status: 409 });
      }
    }

    const data: Prisma.UserUpdateInput = {
      username: body.username,
      avatarUrl: body.avatarUrl !== undefined
        ? body.avatarUrl
          ? body.avatarUrl
          : null
        : undefined,
      role: body.role,
      status: body.status,
      sort: body.sort,
      canManageUsers: actorCanGrant
        ? (body.role === Role.SUPER_ADMIN
          ? true
          : body.canManageUsers)
        : undefined,
      passwordHash: body.resetPassword
        ? await bcrypt.hash(body.resetPassword, 10)
        : undefined,
    };

    if (body.role && body.role !== Role.SUPER_ADMIN && body.canManageUsers === undefined && target.canManageUsers && actorCanGrant) {
      data.canManageUsers = target.canManageUsers;
    }

    if (body.role === Role.SUPER_ADMIN) {
      data.sort = 0;
    } else if (target.role === Role.SUPER_ADMIN && body.role) {
      const nextSortBase = await prisma.user.aggregate({
        _max: { sort: true },
        where: {
          role: { not: Role.SUPER_ADMIN },
          id: { not: id },
        },
      });
      data.sort = (nextSortBase._max.sort ?? 0) + 10;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
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

    return NextResponse.json({ message: "用户信息已更新", item: updated });
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

    return NextResponse.json({ message: "更新失败，请稍后重试" }, { status: 500 });
  }
}
