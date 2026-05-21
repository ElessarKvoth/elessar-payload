import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1. Fix orphaned data so FK constraint can be applied ─────────────────────
  // customer_id is NOT NULL — nullifying would violate that constraint,
  // so we delete orphaned orders (dev data only; no prod loss expected).
  await db.execute(sql`
    DELETE FROM "orders"
    WHERE "customer_id" IS NOT NULL
    AND "customer_id" NOT IN (SELECT "id" FROM "users")
  `)

  // ── 2. Create enum types (PG has no IF NOT EXISTS — check via TypeScript) ─────
  const existingTypes = await db.execute(sql`
    SELECT typname FROM pg_type
    WHERE typname IN (
      'enum_records_situation', 'enum_records_vinyl_model',
      'enum_users_addresses_state', 'enum_users_role'
    )
    AND typnamespace = 'public'::regnamespace
  `)
  const typeSet = new Set((existingTypes.rows as Array<{ typname: string }>).map(r => r.typname))

  if (!typeSet.has('enum_records_situation')) {
    await db.execute(sql`CREATE TYPE "public"."enum_records_situation" AS ENUM('rare', 'imported', 'sealed', 'collectible', 'limited_edition', 'anniversary_edition', 'remastered', 'colored_vinyl')`)
  }
  if (!typeSet.has('enum_records_vinyl_model')) {
    await db.execute(sql`CREATE TYPE "public"."enum_records_vinyl_model" AS ENUM('black', 'clear', 'splatter', 'picture_disc', 'other')`)
  }
  if (!typeSet.has('enum_users_addresses_state')) {
    await db.execute(sql`CREATE TYPE "public"."enum_users_addresses_state" AS ENUM('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')`)
  }
  if (!typeSet.has('enum_users_role')) {
    await db.execute(sql`CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'client')`)
  }

  // ── 3. Create tables (IF NOT EXISTS is safe) ──────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "records_situation" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_records_situation",
      "id" serial PRIMARY KEY NOT NULL
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users_addresses" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar,
      "street" varchar NOT NULL,
      "number" varchar NOT NULL,
      "complement" varchar,
      "neighborhood" varchar NOT NULL,
      "city" varchar NOT NULL,
      "state" "enum_users_addresses_state" NOT NULL,
      "zip_code" varchar NOT NULL,
      "is_default" boolean DEFAULT false
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "records_id" integer,
      "apparel_id" integer
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "homepage" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "homepage_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "banners_id" integer,
      "records_id" integer
    )
  `)

  // ── 4. Drop old tables / constraints / indexes (IF EXISTS is safe) ────────────
  await db.execute(sql`DROP TABLE IF EXISTS "products_images" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "products" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "customers_addresses" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "customers" CASCADE`)
  await db.execute(sql`ALTER TABLE "records" DROP CONSTRAINT IF EXISTS "records_category_id_categories_id_fk"`)
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_id_customers_id_fk"`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_products_fk"`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_customers_fk"`)
  await db.execute(sql`DROP INDEX IF EXISTS "media_sizes_thumbnail_sizes_thumbnail_filename_idx"`)
  await db.execute(sql`DROP INDEX IF EXISTS "media_sizes_card_sizes_card_filename_idx"`)
  await db.execute(sql`DROP INDEX IF EXISTS "records_category_idx"`)
  await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_rels_products_id_idx"`)
  await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_rels_customers_id_idx"`)

  // ── 5. Alter columns ──────────────────────────────────────────────────────────
  await db.execute(sql`ALTER TABLE "banners" ALTER COLUMN "title" DROP NOT NULL`)
  await db.execute(sql`ALTER TABLE "banners" ALTER COLUMN "image_id" DROP NOT NULL`)

  // ── 6. Add columns (IF NOT EXISTS is safe) ────────────────────────────────────
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar NOT NULL DEFAULT ''`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'client' NOT NULL`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verified" boolean`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "_verificationtoken" varchar`)
  await db.execute(sql`ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "cloudinary_u_r_l" varchar`)
  await db.execute(sql`ALTER TABLE "artists" ADD COLUMN IF NOT EXISTS "founded_at" timestamp(3) with time zone`)
  await db.execute(sql`ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "vinyl_model" "enum_records_vinyl_model"`)
  await db.execute(sql`ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "vinyl_model_custom" varchar`)

  // ── 7. Add FK constraints (check via TypeScript to avoid duplicate errors) ─────
  const existingConstraints = await db.execute(sql`
    SELECT conname FROM pg_constraint
    WHERE conname IN (
      'records_situation_parent_fk', 'users_addresses_parent_id_fk',
      'users_rels_parent_fk', 'users_rels_records_fk', 'users_rels_apparel_fk',
      'homepage_rels_parent_fk', 'homepage_rels_banners_fk', 'homepage_rels_records_fk',
      'orders_customer_id_users_id_fk'
    )
  `)
  const constraintSet = new Set((existingConstraints.rows as Array<{ conname: string }>).map(r => r.conname))

  if (!constraintSet.has('records_situation_parent_fk')) {
    await db.execute(sql`ALTER TABLE "records_situation" ADD CONSTRAINT "records_situation_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('users_addresses_parent_id_fk')) {
    await db.execute(sql`ALTER TABLE "users_addresses" ADD CONSTRAINT "users_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('users_rels_parent_fk')) {
    await db.execute(sql`ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('users_rels_records_fk')) {
    await db.execute(sql`ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_records_fk" FOREIGN KEY ("records_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('users_rels_apparel_fk')) {
    await db.execute(sql`ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_apparel_fk" FOREIGN KEY ("apparel_id") REFERENCES "public"."apparel"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('homepage_rels_parent_fk')) {
    await db.execute(sql`ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('homepage_rels_banners_fk')) {
    await db.execute(sql`ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action`)
  }
  if (!constraintSet.has('homepage_rels_records_fk')) {
    await db.execute(sql`ALTER TABLE "homepage_rels" ADD CONSTRAINT "homepage_rels_records_fk" FOREIGN KEY ("records_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action`)
  }
  // DROP + ADD para idempotência garantida — a FK do orders->users é crítica
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_id_users_id_fk"`)
  await db.execute(sql`ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action`)

  // ── 8. Create indexes (IF NOT EXISTS is safe) ─────────────────────────────────
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "records_situation_order_idx" ON "records_situation" USING btree ("order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "records_situation_parent_idx" ON "records_situation" USING btree ("parent_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_addresses_order_idx" ON "users_addresses" USING btree ("_order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_addresses_parent_id_idx" ON "users_addresses" USING btree ("_parent_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "users_rels" USING btree ("order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "users_rels" USING btree ("path")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_records_id_idx" ON "users_rels" USING btree ("records_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_apparel_id_idx" ON "users_rels" USING btree ("apparel_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "homepage_rels_order_idx" ON "homepage_rels" USING btree ("order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "homepage_rels_parent_idx" ON "homepage_rels" USING btree ("parent_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "homepage_rels_path_idx" ON "homepage_rels" USING btree ("path")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "homepage_rels_banners_id_idx" ON "homepage_rels" USING btree ("banners_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "homepage_rels_records_id_idx" ON "homepage_rels" USING btree ("records_id")`)

  // ── 9. Drop old columns / types (IF EXISTS is safe) ───────────────────────────
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_url"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_width"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_height"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_mime_type"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_filesize"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_thumbnail_filename"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_url"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_width"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_height"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_mime_type"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_filesize"`)
  await db.execute(sql`ALTER TABLE "media" DROP COLUMN IF EXISTS "sizes_card_filename"`)
  await db.execute(sql`ALTER TABLE "records" DROP COLUMN IF EXISTS "category_id"`)
  await db.execute(sql`ALTER TABLE "records" DROP COLUMN IF EXISTS "featured"`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "products_id"`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "customers_id"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_products_product_type"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_products_condition"`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverts the structural changes — only useful in a clean dev environment
  await db.execute(sql`DROP TABLE IF EXISTS "records_situation" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "users_addresses" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "users_rels" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "homepage" CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS "homepage_rels" CASCADE`)
  await db.execute(sql`ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_id_users_id_fk"`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "name"`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "_verified"`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "_verificationtoken"`)
  await db.execute(sql`ALTER TABLE "records" DROP COLUMN IF EXISTS "vinyl_model"`)
  await db.execute(sql`ALTER TABLE "records" DROP COLUMN IF EXISTS "vinyl_model_custom"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_records_situation"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_records_vinyl_model"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_users_addresses_state"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_users_role"`)
}
