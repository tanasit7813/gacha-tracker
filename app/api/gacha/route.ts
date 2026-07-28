import { NextResponse } from "next/server";

// สร้างฟังก์ชันหน่วงเวลา ป้องกันการโดน API เกมแบน (Rate Limit)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// กำหนดประเภทตู้ (Gacha Types) ของแต่ละเกม
const GACHA_TYPES: Record<string, string[]> = {
  // Genshin: 301=ตัวละคร, 302=อาวุธ, 200=ถาวร, 100=ผู้เริ่มต้น, 500=ตู้รวมพร (Chronicled)
  genshin: ["301", "302", "200", "500"],
  // Honkai Star Rail: 11=ตัวละคร, 12=ไลท์โคน(อาวุธ), 1=ถาวร, 21=ตู้ตัวละครคอลแลป, 22=ตู้อาวุธคอลแลป
  hsr: ["11", "12", "1", "21", "22"],
  // Zenless Zone Zero: 1=Stable, 2=Exclusive Character, 3=W-Engine, 5=Bangboo
  zzz: ["2", "3", "1", "5"],
};

export async function POST(request: Request) {
  const body = await request.json();
  const { game, apiUrl } = body;

  if (!apiUrl) {
    return NextResponse.json({ error: "ไม่พบ URL" }, { status: 400 });
  }

  // ปรับชื่อเกมให้เป็นตัวพิมพ์เล็ก และเลือกประเภทตู้ที่จะดึงข้อมูลตามเกม
  const targetGame = (game || "genshin").toLowerCase();
  const gachaTypes = GACHA_TYPES[targetGame] || GACHA_TYPES.genshin;

  try {
    let allPulls: any[] = [];
    const urlObj = new URL(apiUrl);
    urlObj.searchParams.set("size", "20"); // ดึงหน้าละ 20 รายการ

    // 🔄 วนลูปตามประเภทตู้กาชาทั้งหมดของเกมนั้นๆ (ตู้ตัวละคร -> อาวุธ -> ถาวร -> ผู้เริ่มต้น)
    for (const type of gachaTypes) {
      let endId = "0"; // ตัวบอกตำแหน่งหน้าเริ่มต้นสำหรับแต่ละตู้
      let hasMore = true;
      let page = 1;

      urlObj.searchParams.set("gacha_type", type);

      // 🌟 จัดการ URL สำหรับแต่ละเกม
      if (targetGame === "zzz") {
        // ZZZ ใช้ API endpoint ของตัวเอง
        urlObj.hostname = "public-operation-common-sg.hoyoverse.com";
        urlObj.pathname = "/common/gacha_record/api/getGachaLog";
        
        // ZZZ ใช้ real_gacha_type ในการระบุตู้
        urlObj.searchParams.set("real_gacha_type", type);
        urlObj.searchParams.delete("gacha_type");
      } else if (targetGame === "hsr") {
        if (type === "21" || type === "22") {
          urlObj.pathname = urlObj.pathname.replace("getGachaLog", "getLdGachaLog");
        } else {
          urlObj.pathname = urlObj.pathname.replace("getLdGachaLog", "getGachaLog");
        }
      }

      // 🔄 วนลูปดึงข้อมูลย้อนหลังในตู้นี้จนกว่าจะหมดประวัติ
      while (hasMore) {
        console.log(
          `[${targetGame}] กำลังดึงตู้ประเภท ${type} หน้า ${page}... (ใช้ API: ${urlObj.pathname.split("/").pop()})`,
        );

        urlObj.searchParams.set("end_id", endId);

        const response = await fetch(urlObj.toString());
        const json = await response.json();

        // เช็กว่า AuthKey หมดอายุหรือมี Error จากฝั่งเกมหรือไม่
        if (json.retcode !== 0) {
          throw new Error(json.message || "AuthKey อาจจะหมดอายุแล้ว");
        }

        const list = json.data?.list || [];

        if (list.length === 0) {
          // ถ้าหน้านี้ไม่มีข้อมูล แปลว่าประวัติย้อนหลังของตู้นี้หมดแล้ว ให้ไปตู้ถัดไป
          hasMore = false;
        } else {
          // นำข้อมูลตู้ปัจจุบันไปรวมเข้ากับอาร์เรย์หลัก
          allPulls = allPulls.concat(list);

          // จำ ID รายการสุดท้ายไว้ เพื่อเอาไปใช้ดึงหน้าถัดไปของตู้นี้
          endId = list[list.length - 1].id;
          page++;

          // หน่วงเวลาสุ่ม 800 - 1500 มิลลิวินาที พักหายใจก่อนดึงหน้าถัดไป
          const randomDelay =
            Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
          await sleep(randomDelay);
        }
      }
    }

    // ส่งข้อมูลประวัติทั้งหมดทุกตู้รวมกันกลับไปให้หน้าบ้าน
    return NextResponse.json({
      message: "ดึงข้อมูลจากเกมสำเร็จ!",
      game: targetGame,
      totalPulls: allPulls.length,
      pulls: allPulls,
    });
  } catch (error: any) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูล API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
