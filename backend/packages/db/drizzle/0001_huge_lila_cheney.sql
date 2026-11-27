CREATE TABLE "user_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ticket_string" text NOT NULL,
	"normalized_ticket" text NOT NULL,
	"scheme_code" text NOT NULL,
	"series" text NOT NULL,
	"digits" text NOT NULL,
	"draw_code" text NOT NULL,
	"draw_date" date NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cost" integer DEFAULT 40 NOT NULL,
	"won_amount" integer DEFAULT 0 NOT NULL,
	"result" jsonb NOT NULL,
	CONSTRAINT "user_tickets_user_ticket_draw_unique" UNIQUE("user_id","normalized_ticket","draw_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"clerk_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_tickets" ADD CONSTRAINT "user_tickets_user_id_users_clerk_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("clerk_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_tickets_user_checked_at_idx" ON "user_tickets" USING btree ("user_id","checked_at" DESC NULLS LAST);