ALTER TABLE "User"
ADD COLUMN "sort" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN role = 'SUPER_ADMIN' THEN 'SUPER_ADMIN' ELSE 'OTHER' END
      ORDER BY "createdAt" DESC, id ASC
    ) AS rn
  FROM "User"
)
UPDATE "User" AS u
SET "sort" = ranked.rn * 10
FROM ranked
WHERE u.id = ranked.id;
