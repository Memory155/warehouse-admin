const DEFAULT_BUCKET = "product-images";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

function getStorageConfig() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET).trim();

  return { url, serviceRoleKey, bucket };
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildSupabasePublicUrl(key: string) {
  const { url, bucket } = getStorageConfig();
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectKey(key)}`;
}

export async function uploadToSupabaseStorage(params: {
  body: BodyInit;
  contentType: string;
  key: string;
  cacheControl?: string;
}) {
  const { url, serviceRoleKey, bucket } = getStorageConfig();
  const objectKey = encodeObjectKey(params.key);

  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": params.contentType,
        "x-upsert": "false",
        ...(params.cacheControl ? { "cache-control": params.cacheControl } : {}),
      },
      body: params.body,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "上传图片失败");
  }

  return {
    key: params.key,
    publicUrl: buildSupabasePublicUrl(params.key),
  };
}

export async function deleteFromSupabaseStorage(key: string) {
  const { url, serviceRoleKey, bucket } = getStorageConfig();
  const objectKey = encodeObjectKey(key);

  const response = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    throw new Error(message || "删除图片失败");
  }
}
