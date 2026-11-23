CREATE TABLE "scheme_series" (
	"scheme_code" text NOT NULL,
	"series" text NOT NULL,
	CONSTRAINT "scheme_series_scheme_code_series_pk" PRIMARY KEY("scheme_code","series")
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weekday" smallint,
	"ticket_price" numeric(8, 2),
	"is_bumper" boolean DEFAULT false NOT NULL,
	"structure" jsonb
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_code" text NOT NULL,
	"draw_code" text NOT NULL,
	"draw_date" date NOT NULL,
	"status" text NOT NULL,
	"published_at" timestamp with time zone,
	"fingerprint" text,
	CONSTRAINT "draws_scheme_draw_code_unique" UNIQUE("scheme_code","draw_code")
);
--> statement-breakpoint
CREATE TABLE "prize_entries" (
	"draw_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"entry" text NOT NULL,
	CONSTRAINT "prize_entries_draw_id_tier_entry_pk" PRIMARY KEY("draw_id","tier","entry")
);
--> statement-breakpoint
CREATE TABLE "prize_tiers" (
	"draw_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"amount" bigint NOT NULL,
	"match_type" text NOT NULL,
	CONSTRAINT "prize_tiers_draw_id_tier_pk" PRIMARY KEY("draw_id","tier")
);
--> statement-breakpoint
CREATE TABLE "source_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_id" uuid,
	"source" text NOT NULL,
	"source_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_object_key" text,
	"content_hash" text,
	"parsed" jsonb,
	"fingerprint" text,
	"validation" jsonb,
	CONSTRAINT "source_observations_draw_source_hash_unique" UNIQUE("draw_id","source","content_hash")
);
--> statement-breakpoint
CREATE TABLE "winner_agencies" (
	"draw_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"ticket" text NOT NULL,
	"agency_name" text,
	"agency_code" text,
	"place" text,
	"source" text NOT NULL,
	CONSTRAINT "winner_agencies_draw_id_tier_ticket_source_pk" PRIMARY KEY("draw_id","tier","ticket","source")
);
--> statement-breakpoint
CREATE TABLE "ingest_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"draw_id" uuid,
	"kind" text NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheme_series" ADD CONSTRAINT "scheme_series_scheme_code_schemes_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."schemes"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_scheme_code_schemes_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."schemes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_entries" ADD CONSTRAINT "prize_entries_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tiers" ADD CONSTRAINT "prize_tiers_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_observations" ADD CONSTRAINT "source_observations_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winner_agencies" ADD CONSTRAINT "winner_agencies_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_events" ADD CONSTRAINT "ingest_events_draw_id_draws_id_fk" FOREIGN KEY ("draw_id") REFERENCES "public"."draws"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "draws_draw_date_desc_idx" ON "draws" USING btree ("draw_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prize_entries_draw_id_entry_idx" ON "prize_entries" USING btree ("draw_id","entry");