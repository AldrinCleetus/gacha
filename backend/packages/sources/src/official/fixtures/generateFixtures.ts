import { PDFDocument, StandardFonts } from "pdf-lib";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createSamrudhiSm82Pdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page1 = doc.addPage([595.28, 841.89]); // A4
  let y = 800;

  // Header
  page1.drawText("KERALA STATE LOTTERIES - RESULT", { x: 150, y, size: 14, font: bold });
  y -= 18;
  page1.drawText("www.keralalotteries.com", { x: 220, y, size: 10, font });
  y -= 14;
  page1.drawText("PHONE:- 0471-2305230  DIRECTOR:- 0471-2305193  OFFICE:- 0471-2301740", { x: 100, y, size: 9, font });
  y -= 25;

  page1.drawText("SAMRUDHI LOTTERY NO. SM-82nd DRAW held on 22/11/2026 AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", {
    x: 40,
    y,
    size: 9,
    font: bold,
  });
  y -= 30;

  // 1st Prize
  page1.drawText("1st Prize- Rs :1,00,00,000/-  MO 747323 (KOLLAM)", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("Agent Name: SHAHUL HAMEED", { x: 50, y, size: 9, font });
  y -= 12;
  page1.drawText("Agency No.: Q 5422", { x: 50, y, size: 9, font });
  y -= 25;

  // Consolation
  page1.drawText("Consolation Prize- Rs. 5,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("MN 747323  MP 747323  MR 747323  MS 747323  MT 747323  MU 747323", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("MV 747323  MW 747323  MX 747323  MY 747323  MZ 747323", { x: 50, y, size: 9, font });
  y -= 25;

  // 2nd Prize
  page1.drawText("2nd Prize- Rs :25,00,000/-  MS 263445 (PALAKKAD)", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("Agent Name: RAMESH K", { x: 50, y, size: 9, font });
  y -= 12;
  page1.drawText("Agency No.: P 3190", { x: 50, y, size: 9, font });
  y -= 25;

  // 3rd Prize
  page1.drawText("3rd Prize- Rs :5,00,000/-  MR 317582 (THRISSUR)", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("Agent Name: ANTONY P J", { x: 50, y, size: 9, font });
  y -= 12;
  page1.drawText("Agency No.: R 4812", { x: 50, y, size: 9, font });
  y -= 25;

  // 4th Prize (Last 4)
  page1.drawText("4th Prize- Rs. 5,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("2626  2958  2987  3412  3483  3735  3746  4156  4373  5581", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("5883  6383  6503  7294  7732  8173  8277  9503", { x: 50, y, size: 9, font });
  y -= 25;

  // 5th Prize
  page1.drawText("5th Prize- Rs. 2,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("6706  7671  8383  8543", { x: 50, y, size: 9, font });
  y -= 25;

  // 6th Prize
  page1.drawText("6th Prize- Rs. 1,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("1204  1838  1919  1954  1979  2579  3433  3748  4111  4301", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("4472  5198  5221  5451  5574  5657  5725  6072  6090  6576  7009  7043  8934", { x: 50, y, size: 9, font });
  y -= 25;

  // 7th Prize
  page1.drawText("7th Prize- Rs. 500/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("0312  0337  0494  0692  0757  0836  0844  0857  1110  1220", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("1471  1640  1823  2013  2235  2487  2608  2685  2760  2825", { x: 50, y, size: 9, font });
  y -= 25;

  // 8th Prize
  page1.drawText("8th Prize- Rs. 200/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("0222  0229  0381  0406  0525  0552  0558  0570  1059  1366", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("1489  1501  1587  1631  1738  1800  2045  2118  2228  2341", { x: 50, y, size: 9, font });
  y -= 25;

  // 9th Prize
  page1.drawText("9th Prize- Rs. 100/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page1.drawText("0013  0039  0102  0174  0205  0251  0303  0387  0419  0512", { x: 50, y, size: 9, font });
  y -= 14;
  page1.drawText("0601  0689  0723  0811  0890  0944  1012  1108  1199  1250", { x: 50, y, size: 9, font });
  y -= 40;

  // Footer
  page1.drawText("The prize winners are advised to verify the winning numbers with the results published in the Kerala Government Gazette and surrender the winning tickets within 30 days.", {
    x: 40,
    y,
    size: 7.5,
    font,
  });
  y -= 25;
  page1.drawText("Sd/- Joint Director, Directorate of State Lotteries, Thiruvananthapuram", { x: 130, y, size: 8, font: bold });

  return await doc.save();
}

async function createKarunyaKr762Pdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  let y = 800;

  page.drawText("KERALA STATE LOTTERIES - RESULT", { x: 150, y, size: 14, font: bold });
  y -= 18;
  page.drawText("www.keralalotteries.com", { x: 220, y, size: 10, font });
  y -= 14;
  page.drawText("PHONE:- 0471-2305230  DIRECTOR:- 0471-2305193  OFFICE:- 0471-2301740", { x: 100, y, size: 9, font });
  y -= 25;

  page.drawText("KARUNYA LOTTERY NO. KR-762nd DRAW held on 25/07/2026 AT GORKY BHAVAN, NEAR BAKERY JUNCTION, THIRUVANANTHAPURAM", {
    x: 40,
    y,
    size: 9,
    font: bold,
  });
  y -= 30;

  // 1st Prize
  page.drawText("1st Prize- Rs :1,00,00,000/-  KB 845108 (ATTINGAL)", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("Agent Name: SHINE D T", { x: 50, y, size: 9, font });
  y -= 12;
  page.drawText("Agency No.: T 3795", { x: 50, y, size: 9, font });
  y -= 25;

  // Consolation
  page.drawText("Consolation Prize- Rs. 5,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("KA 845108  KC 845108  KD 845108  KE 845108  KF 845108  KG 845108", { x: 50, y, size: 9, font });
  y -= 14;
  page.drawText("KH 845108  KJ 845108  KK 845108  KL 845108  KM 845108", { x: 50, y, size: 9, font });
  y -= 25;

  // 2nd Prize
  page.drawText("2nd Prize- Rs :25,00,000/-  KJ 772827 (MANANTHAVADY)", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("Agent Name: SREEJITH T", { x: 50, y, size: 9, font });
  y -= 12;
  page.drawText("Agency No.: W 2242", { x: 50, y, size: 9, font });
  y -= 25;

  // 3rd Prize
  page.drawText("3rd Prize- Rs :1,00,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("KA 402287  KB 463953  KC 438171  KD 306029  KE 483321  KF 182765", { x: 50, y, size: 9, font });
  y -= 14;
  page.drawText("KG 704192  KH 770928  KJ 896328  KK 612809  KL 636302  KM 804961", { x: 50, y, size: 9, font });
  y -= 25;

  // 4th Prize
  page.drawText("4th Prize- Rs. 5,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("0068  0279  0337  0494  0692  0757  0836  0844  0857  1110", { x: 50, y, size: 9, font });
  y -= 14;
  page.drawText("1220  1471  1640  1823  2013  2235  2487  2608", { x: 50, y, size: 9, font });
  y -= 25;

  // 5th Prize
  page.drawText("5th Prize- Rs. 2,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("0108  0394  0572  0819  1204  1489  1733  1950  2178  2401", { x: 50, y, size: 9, font });
  y -= 25;

  // 6th Prize
  page.drawText("6th Prize- Rs. 1,000/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("0025  0189  0345  0567  0789  0912  1134  1356  1578  1790", { x: 50, y, size: 9, font });
  y -= 25;

  // 7th Prize
  page.drawText("7th Prize- Rs. 500/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("0012  0134  0256  0378  0490  0612  0734  0856  0978  1090", { x: 50, y, size: 9, font });
  y -= 25;

  // 8th Prize
  page.drawText("8th Prize- Rs. 200/-", { x: 50, y, size: 11, font: bold });
  y -= 14;
  page.drawText("0001  0045  0123  0234  0345  0456  0567  0678  0789  0890", { x: 50, y, size: 9, font });
  y -= 40;

  // Footer
  page.drawText("The prize winners are advised to verify the winning numbers with the results published in the Kerala Government Gazette and surrender the winning tickets within 30 days.", {
    x: 40,
    y,
    size: 7.5,
    font,
  });
  y -= 25;
  page.drawText("Sd/- Joint Director, Directorate of State Lotteries, Thiruvananthapuram", { x: 130, y, size: 8, font: bold });

  return await doc.save();
}

async function createBrokenInvalidPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("This is just an arbitrary government circular document without lottery results.", {
    x: 50,
    y: 700,
    size: 12,
    font,
  });
  return await doc.save();
}

async function main() {
  const fixturesDir = path.join(__dirname);
  await fs.mkdir(fixturesDir, { recursive: true });

  const sm82Bytes = await createSamrudhiSm82Pdf();
  const kr762Bytes = await createKarunyaKr762Pdf();
  const brokenBytes = await createBrokenInvalidPdf();

  await fs.writeFile(path.join(fixturesDir, "samrudhi-sm-82.pdf"), sm82Bytes);
  await fs.writeFile(path.join(fixturesDir, "karunya-kr-762.pdf"), kr762Bytes);
  await fs.writeFile(path.join(fixturesDir, "broken-invalid.pdf"), brokenBytes);

  console.log("✓ Official PDF fixtures generated successfully:");
  console.log("  - samrudhi-sm-82.pdf (" + sm82Bytes.length + " bytes)");
  console.log("  - karunya-kr-762.pdf (" + kr762Bytes.length + " bytes)");
  console.log("  - broken-invalid.pdf (" + brokenBytes.length + " bytes)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
