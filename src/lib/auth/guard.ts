import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ message: "未登录" }, { status: 401 }),
    };
  }
  return { user, response: null };
}
