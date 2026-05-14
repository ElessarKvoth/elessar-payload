import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_records_format" AS ENUM('lp', 'ep', 'single_7', 'compacto_10', 'single_12', 'cd', 'cd_duplo', 'box_set', 'cassete');
  CREATE TYPE "public"."enum_records_condition" AS ENUM('new', 'used', 'sealed', 'rare', 'imported', 'collectible');
  CREATE TYPE "public"."enum_apparel_variants_size" AS ENUM('PP', 'P', 'M', 'G', 'GG', 'GGG', 'unico');
  CREATE TYPE "public"."enum_apparel_apparel_type" AS ENUM('tshirt', 'hoodie', 'jacket', 'cap', 'belt', 'poster', 'patch', 'accessory');
  CREATE TYPE "public"."enum_apparel_condition" AS ENUM('new', 'used', 'rare', 'collectible');
  CREATE TABLE "genres" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "records_tracklist" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"position" varchar,
  	"title" varchar NOT NULL,
  	"duration" varchar
  );
  
  CREATE TABLE "records_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"alt_text" varchar
  );
  
  CREATE TABLE "records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short_description" varchar NOT NULL,
  	"description" jsonb NOT NULL,
  	"price" numeric NOT NULL,
  	"sale_price" numeric,
  	"stock" numeric DEFAULT 0 NOT NULL,
  	"sku" varchar NOT NULL,
  	"format" "enum_records_format" NOT NULL,
  	"condition" "enum_records_condition" NOT NULL,
  	"artist_id" integer NOT NULL,
  	"category_id" integer NOT NULL,
  	"genre_id" integer,
  	"release_year" numeric,
  	"record_label" varchar,
  	"featured" boolean DEFAULT false,
  	"is_rare" boolean DEFAULT false,
  	"active" boolean DEFAULT true,
  	"weight" numeric,
  	"dimensions_height" numeric,
  	"dimensions_width" numeric,
  	"dimensions_depth" numeric,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "apparel_variants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"size" "enum_apparel_variants_size" NOT NULL,
  	"color" varchar,
  	"sku" varchar,
  	"stock" numeric DEFAULT 0 NOT NULL
  );
  
  CREATE TABLE "apparel_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"alt_text" varchar
  );
  
  CREATE TABLE "apparel" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"short_description" varchar NOT NULL,
  	"description" jsonb NOT NULL,
  	"price" numeric NOT NULL,
  	"sale_price" numeric,
  	"sku" varchar NOT NULL,
  	"apparel_type" "enum_apparel_apparel_type" NOT NULL,
  	"condition" "enum_apparel_condition" DEFAULT 'new' NOT NULL,
  	"artist_id" integer,
  	"category_id" integer NOT NULL,
  	"total_stock" numeric DEFAULT 0,
  	"featured" boolean DEFAULT false,
  	"is_rare" boolean DEFAULT false,
  	"active" boolean DEFAULT true,
  	"weight" numeric,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"records_id" integer,
  	"apparel_id" integer
  );
  
  ALTER TABLE "orders_items" DROP CONSTRAINT "orders_items_product_id_products_id_fk";
  
  DROP INDEX "orders_items_product_idx";
  ALTER TABLE "orders_items" ADD COLUMN "variant_size" varchar;
  ALTER TABLE "orders_items" ADD COLUMN "variant_color" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "genres_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "apparel_id" integer;
  ALTER TABLE "records_tracklist" ADD CONSTRAINT "records_tracklist_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "records_images" ADD CONSTRAINT "records_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "records_images" ADD CONSTRAINT "records_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "records" ADD CONSTRAINT "records_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "records" ADD CONSTRAINT "records_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "records" ADD CONSTRAINT "records_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "records" ADD CONSTRAINT "records_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "apparel_variants" ADD CONSTRAINT "apparel_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."apparel"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "apparel_images" ADD CONSTRAINT "apparel_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "apparel_images" ADD CONSTRAINT "apparel_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."apparel"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "apparel" ADD CONSTRAINT "apparel_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "apparel" ADD CONSTRAINT "apparel_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "apparel" ADD CONSTRAINT "apparel_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_records_fk" FOREIGN KEY ("records_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_rels" ADD CONSTRAINT "orders_rels_apparel_fk" FOREIGN KEY ("apparel_id") REFERENCES "public"."apparel"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "genres_slug_idx" ON "genres" USING btree ("slug");
  CREATE INDEX "genres_updated_at_idx" ON "genres" USING btree ("updated_at");
  CREATE INDEX "genres_created_at_idx" ON "genres" USING btree ("created_at");
  CREATE INDEX "records_tracklist_order_idx" ON "records_tracklist" USING btree ("_order");
  CREATE INDEX "records_tracklist_parent_id_idx" ON "records_tracklist" USING btree ("_parent_id");
  CREATE INDEX "records_images_order_idx" ON "records_images" USING btree ("_order");
  CREATE INDEX "records_images_parent_id_idx" ON "records_images" USING btree ("_parent_id");
  CREATE INDEX "records_images_image_idx" ON "records_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "records_slug_idx" ON "records" USING btree ("slug");
  CREATE UNIQUE INDEX "records_sku_idx" ON "records" USING btree ("sku");
  CREATE INDEX "records_artist_idx" ON "records" USING btree ("artist_id");
  CREATE INDEX "records_category_idx" ON "records" USING btree ("category_id");
  CREATE INDEX "records_genre_idx" ON "records" USING btree ("genre_id");
  CREATE INDEX "records_seo_seo_og_image_idx" ON "records" USING btree ("seo_og_image_id");
  CREATE INDEX "records_updated_at_idx" ON "records" USING btree ("updated_at");
  CREATE INDEX "records_created_at_idx" ON "records" USING btree ("created_at");
  CREATE INDEX "apparel_variants_order_idx" ON "apparel_variants" USING btree ("_order");
  CREATE INDEX "apparel_variants_parent_id_idx" ON "apparel_variants" USING btree ("_parent_id");
  CREATE INDEX "apparel_images_order_idx" ON "apparel_images" USING btree ("_order");
  CREATE INDEX "apparel_images_parent_id_idx" ON "apparel_images" USING btree ("_parent_id");
  CREATE INDEX "apparel_images_image_idx" ON "apparel_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "apparel_slug_idx" ON "apparel" USING btree ("slug");
  CREATE UNIQUE INDEX "apparel_sku_idx" ON "apparel" USING btree ("sku");
  CREATE INDEX "apparel_artist_idx" ON "apparel" USING btree ("artist_id");
  CREATE INDEX "apparel_category_idx" ON "apparel" USING btree ("category_id");
  CREATE INDEX "apparel_seo_seo_og_image_idx" ON "apparel" USING btree ("seo_og_image_id");
  CREATE INDEX "apparel_updated_at_idx" ON "apparel" USING btree ("updated_at");
  CREATE INDEX "apparel_created_at_idx" ON "apparel" USING btree ("created_at");
  CREATE INDEX "orders_rels_order_idx" ON "orders_rels" USING btree ("order");
  CREATE INDEX "orders_rels_parent_idx" ON "orders_rels" USING btree ("parent_id");
  CREATE INDEX "orders_rels_path_idx" ON "orders_rels" USING btree ("path");
  CREATE INDEX "orders_rels_records_id_idx" ON "orders_rels" USING btree ("records_id");
  CREATE INDEX "orders_rels_apparel_id_idx" ON "orders_rels" USING btree ("apparel_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_genres_fk" FOREIGN KEY ("genres_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_records_fk" FOREIGN KEY ("records_id") REFERENCES "public"."records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_apparel_fk" FOREIGN KEY ("apparel_id") REFERENCES "public"."apparel"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_genres_id_idx" ON "payload_locked_documents_rels" USING btree ("genres_id");
  CREATE INDEX "payload_locked_documents_rels_records_id_idx" ON "payload_locked_documents_rels" USING btree ("records_id");
  CREATE INDEX "payload_locked_documents_rels_apparel_id_idx" ON "payload_locked_documents_rels" USING btree ("apparel_id");
  ALTER TABLE "orders_items" DROP COLUMN "product_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "genres" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "records_tracklist" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "records_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "records" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "apparel_variants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "apparel_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "apparel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "genres" CASCADE;
  DROP TABLE "records_tracklist" CASCADE;
  DROP TABLE "records_images" CASCADE;
  DROP TABLE "records" CASCADE;
  DROP TABLE "apparel_variants" CASCADE;
  DROP TABLE "apparel_images" CASCADE;
  DROP TABLE "apparel" CASCADE;
  DROP TABLE "orders_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_genres_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_records_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_apparel_fk";
  
  DROP INDEX "payload_locked_documents_rels_genres_id_idx";
  DROP INDEX "payload_locked_documents_rels_records_id_idx";
  DROP INDEX "payload_locked_documents_rels_apparel_id_idx";
  ALTER TABLE "orders_items" ADD COLUMN "product_id" integer NOT NULL;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  ALTER TABLE "orders_items" DROP COLUMN "variant_size";
  ALTER TABLE "orders_items" DROP COLUMN "variant_color";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "genres_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "apparel_id";
  DROP TYPE "public"."enum_records_format";
  DROP TYPE "public"."enum_records_condition";
  DROP TYPE "public"."enum_apparel_variants_size";
  DROP TYPE "public"."enum_apparel_apparel_type";
  DROP TYPE "public"."enum_apparel_condition";`)
}
