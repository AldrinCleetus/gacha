import pino from "pino";
import { schemes } from "./schema/schemes.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema/index.js";

const logger = pino({ name: "db-seed" });

export interface SchemeSeedItem {
  code: string;
  name: string;
  weekday: number;
  ticketPrice: string;
  isBumper: boolean;
  structure: {
    confirmed: boolean;
    needsConfirmation?: boolean;
    note?: string;
    dayName: string;
    firstPrizeRupees: number;
    expectedTiers?: string[];
  };
}

export const SEED_SCHEMES: SchemeSeedItem[] = [
  {
    code: "BT",
    name: "Bhagyathara",
    weekday: 1, // Monday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Monday",
      firstPrizeRupees: 7000000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "SS",
    name: "Sthree Sakthi",
    weekday: 2, // Tuesday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Tuesday",
      firstPrizeRupees: 7500000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "DL",
    name: "Dhanalekshmi",
    weekday: 3, // Wednesday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Wednesday",
      firstPrizeRupees: 7000000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "KN",
    name: "Karunya Plus",
    weekday: 4, // Thursday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Thursday",
      firstPrizeRupees: 8000000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "SK",
    name: "Suvarna Keralam",
    weekday: 5, // Friday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: false,
      needsConfirmation: true,
      note: "Scheme code 'SK' needs confirmation from real draw data (e.g. Suvarna Keralam Friday draw)",
      dayName: "Friday",
      firstPrizeRupees: 7000000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "KR",
    name: "Karunya",
    weekday: 6, // Saturday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Saturday",
      firstPrizeRupees: 8000000,
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
  {
    code: "SM",
    name: "Samrudhi",
    weekday: 7, // Sunday
    ticketPrice: "40.00",
    isBumper: false,
    structure: {
      confirmed: true,
      dayName: "Sunday",
      firstPrizeRupees: 10000000, // 1 crore
      expectedTiers: ["1", "consolation", "2", "3", "4", "5", "6", "7", "8"],
    },
  },
];

export async function seedSchemes(db: NodePgDatabase<typeof schema>): Promise<number> {
  logger.info(`Seeding ${SEED_SCHEMES.length} weekly lottery schemes...`);

  let count = 0;
  for (const scheme of SEED_SCHEMES) {
    await db
      .insert(schemes)
      .values(scheme)
      .onConflictDoUpdate({
        target: schemes.code,
        set: {
          name: scheme.name,
          weekday: scheme.weekday,
          ticketPrice: scheme.ticketPrice,
          isBumper: scheme.isBumper,
          structure: scheme.structure,
        },
      });
    count++;
  }

  logger.info(`Successfully seeded ${count} schemes.`);
  return count;
}
