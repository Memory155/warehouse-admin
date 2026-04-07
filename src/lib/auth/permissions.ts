import { prisma } from "@/lib/db";

export function canEditInventory(role: "SUPER_ADMIN" | "ADMIN" | "USER") {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canGrantUserManagement(role: "SUPER_ADMIN" | "ADMIN" | "USER") {
  return role === "SUPER_ADMIN";
}

export async function getUserManagementActor(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      canManageUsers: true,
    },
  });
}

export async function hasUserManagementAccess(userId: string) {
  const actor = await getUserManagementActor(userId);
  if (!actor || actor.status !== "ACTIVE") return false;
  return actor.role === "SUPER_ADMIN" || actor.canManageUsers;
}
