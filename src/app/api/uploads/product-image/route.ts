import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { canEditInventory } from "@/lib/auth/permissions";
import { uploadToSupabaseStorage } from "@/lib/storage/supabase";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function getFileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;
  if (!auth.user || !canEditInventory(auth.user.role)) {
    return NextResponse.json({ message: "无权限操作" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请选择图片文件" }, { status: 400 });
    }

    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json(
        { message: "仅支持 JPG、PNG、WebP 格式图片" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "图片大小不能超过 2MB" }, { status: 400 });
    }

    const extension = getFileExtension(file);
    const key = `products/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToSupabaseStorage({
      body: buffer,
      contentType: file.type,
      key,
      cacheControl: "3600",
    });

    return NextResponse.json({
      item: {
        imageUrl: uploaded.publicUrl,
        imageKey: uploaded.key,
        imageMimeType: file.type,
        imageSize: file.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传图片失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}
