"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import giCharactersMapping from "@/public/gi/gi_characters.json";
import giWeaponsMapping from "@/public/gi/gi_weapons.json";
import hsrCharactersMapping from "@/public/hsr/hsr_characters.json";
import hsrLightconesMapping from "@/public/hsr/hsr_lightcones.json";
import zzzAgentsMapping from "@/public/zzz/zzz_agents_en-us.json";
import zzzWenginesMapping from "@/public/zzz/zzz_wengines_en-us.json";
import zzzBangboosMapping from "@/public/zzz/zzz_bangboos_en-us.json";

type GameState = {
  [key: string]: string;
};

type PullDataState = {
  [key: string]: any[];
};

const getPityCardStyle = (pity: number) => {
  if (pity >= 0 && pity <= 20) {
    return {
      bg: "bg-green-500",
      text: "text-white",
      border: "border-green-500",
    };
  } else if (pity >= 21 && pity <= 40) {
    return { bg: "bg-lime-500", text: "text-white", border: "border-lime-500" };
  } else if (pity >= 41 && pity <= 60) {
    return {
      bg: "bg-yellow-400",
      text: "text-black",
      border: "border-yellow-400",
    };
  } else if (pity >= 61 && pity <= 74) {
    return {
      bg: "bg-orange-500",
      text: "text-white",
      border: "border-orange-500",
    };
  } else if (pity >= 75) {
    return { bg: "bg-red-600", text: "text-white", border: "border-red-600" };
  }
  return { bg: "bg-gray-500", text: "text-white", border: "border-gray-500" };
};

export default function Home() {
  const [isClient, setIsClient] = useState(false); // ป้องกัน Hydration Error ของ Next.js
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"welcome" | "import" | "history">(
    "welcome",
  );

  useEffect(() => {
    setIsClient(true); // ยืนยันว่าฝั่ง Client โหลดเสร็จแล้ว

    // กู้คืนสถานะ User และข้อมูลประวัติจาก Local Storage ทันทีเพื่อป้องการ Flicker ตอนกด Refresh
    const savedUser = localStorage.getItem("gacha_user");
    if (savedUser) setCurrentUser(savedUser);

    const savedPullMap = localStorage.getItem("gacha_pull_map");
    if (savedPullMap) {
      try {
        setPullDataMap(JSON.parse(savedPullMap));
      } catch (e) {}
    }

    const savedGame = sessionStorage.getItem("activeGame");
    const savedTab = sessionStorage.getItem("activeTab") as
      | "welcome"
      | "import"
      | "history"
      | null;

    if (savedGame && savedTab && savedTab !== "welcome") {
      setActiveGame(savedGame);
      setActiveTab(savedTab === "import" ? "history" : savedTab);
    }
  }, []);

  // --- 2. Effect สำหรับอัปเดต Session Storage เมื่อผู้ใช้เปลี่ยน Tab หรือเกม ---
  useEffect(() => {
    if (activeGame) sessionStorage.setItem("activeGame", activeGame);
    if (activeTab) sessionStorage.setItem("activeTab", activeTab);
  }, [activeGame, activeTab]);

  const [apiUrls, setApiUrls] = useState<GameState>({
    genshin: "",
    hsr: "",
    zzz: "",
    wuwa: "",
    ark9: "",
  });
  const [pullDataMap, setPullDataMap] = useState<PullDataState>({
    genshin: [],
    hsr: [],
    zzz: [],
    wuwa: [],
    ark9: [],
  });

  // --- กำหนดข้อความแนะนำและชื่อไฟล์ตามแต่ละเกม ---
  const getGameImportGuide = () => {
    switch (activeGame) {
      case "genshin":
        return {
          title: 'เลือกไฟล์ "data_2" ของ Genshin Impact',
          path: "[Drive]:\\HoYoPlay\\games\\Genshin Impact game\\GenshinImpact_Data\\webCaches\\[version]\\Cache\\Cache_Data\\data_2",
        };
      case "hsr":
        return {
          title: 'เลือกไฟล์ "data_2" ของ Honkai: Star Rail',
          path: "[Drive]:\\HoYoPlay\\games\\Honkai Star Rail game\\StarRail_Data\\webCaches\\[version]\\Cache\\Cache_Data\\data_2",
        };
      case "zzz":
        return {
          title: "เลือกไฟล์แคชของ Zenless Zone Zero",
          path: "[Drive]:\\HoYoPlay\\games\\ZenlessZoneZero_Data\\webCaches\\[version]\\Cache\\Cache_Data\\data_2",
        };
      case "wuwa":
        return {
          title: "เลือกไฟล์แคชของ Wuthering Waves",
          path: "TBA",
        };
      case "ark9":
        return {
          title: "ระบบ Import ของ Ark9 (TBA)",
          path: "TBA",
        };
      default:
        return {
          title: "เลือกไฟล์แคชของเกม",
          path: "ระบุพาร์ทไฟล์...",
        };
    }
  };

  const importGuide = getGameImportGuide();

  const [isLoading, setIsLoading] = useState(false); // ใช้สำหรับ Import action เท่านั้น
  const [isFetchingHistory, setIsFetchingHistory] = useState(false); // ใช้สำหรับ fetch ข้อมูลจาก Supabase
  const [isSearchingUrl, setIsSearchingUrl] = useState(false); // State ใหม่สำหรับตอนค้นหา URL ในไฟล์
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [closingModal, setClosingModal] = useState<"login" | "signup" | null>(
    null,
  );

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success"); // 👈 เพิ่ม State ควบคุมประเภท

  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type); // 👈 อัปเดตประเภท
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // ─── ZZZ icon/name map (keyed by item_id) ───────────────────────────
  const zzzIconMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    const allMappings = [
      ...(Object.values(zzzAgentsMapping) as any[]),
      ...(Object.values(zzzWenginesMapping) as any[]),
      ...(Object.values(zzzBangboosMapping) as any[]),
    ];
    allMappings.forEach((entry: any) => {
      if (entry.item_id) map[String(entry.item_id)] = entry.icon_url || null;
    });
    return map;
  }, []);

  const zzzNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    const allMappings = [
      ...(Object.values(zzzAgentsMapping) as any[]),
      ...(Object.values(zzzWenginesMapping) as any[]),
      ...(Object.values(zzzBangboosMapping) as any[]),
    ];
    allMappings.forEach((entry: any) => {
      if (entry.item_id && entry.name) map[String(entry.item_id)] = entry.name;
    });
    return map;
  }, []);

  const zzzCategoryMap = useMemo(() => {
    const map: Record<string, "agent" | "wengine" | "bangboo"> = {};
    Object.values(zzzAgentsMapping as any).forEach((entry: any) => {
      if (entry.item_id) map[String(entry.item_id)] = "agent";
    });
    Object.values(zzzWenginesMapping as any).forEach((entry: any) => {
      if (entry.item_id) map[String(entry.item_id)] = "wengine";
    });
    Object.values(zzzBangboosMapping as any).forEach((entry: any) => {
      if (entry.item_id) map[String(entry.item_id)] = "bangboo";
    });
    return map;
  }, []);

  // แยก Map ของแต่ละเกมออกจากกัน ป้องกันชื่อซ้ำข้ามเกม (เช่น HSR มี Lightcone ชื่อ "Amber" ทับตัวละคร GI)
  const giIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (giCharactersMapping) {
      Object.values(giCharactersMapping).forEach((char: any) => {
        if (char.name) map[char.name] = char.icon_name;
      });
    }
    if (giWeaponsMapping) {
      Object.values(giWeaponsMapping).forEach((weapon: any) => {
        if (weapon.name) map[weapon.name] = weapon.icon_name;
      });
    }
    return map;
  }, []);

  const hsrIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (hsrCharactersMapping) {
      Object.values(hsrCharactersMapping).forEach((char: any) => {
        if (char.name?.en) map[char.name.en] = char.icon_name;
        if (char.name?.th) map[char.name.th] = char.icon_name;
        if (typeof char.name === "string") map[char.name] = char.icon_name;
      });
    }
    if (hsrLightconesMapping) {
      Object.values(hsrLightconesMapping).forEach((lightcone: any) => {
        if (lightcone.name) map[lightcone.name] = lightcone.icon_name;
      });
    }
    return map;
  }, []);

  const getIconUrl = (item: any) => {
    // ─── ZZZ: lookup by item_id ──────────────────────────────
    if (activeGame === "zzz") {
      const icon = zzzIconMap[String(item.item_id)];
      return icon ?? "/icons/Zenless_Zone_Zero_App_Icon.webp";
    }

    if (activeGame === "genshin") {
      const iconName = giIconMap[item.name];
      if (!iconName) return "/icons/Genshin_Impact.webp";
      // ใช้ gi.yatta.moe แทน enka.network เพราะ enka มี hotlink protection (บล็อกการโหลดจากเว็บอื่น)
      return `https://gi.yatta.moe/assets/UI/${iconName}.png`;
    }

    if (activeGame === "hsr") {
      const iconName = hsrIconMap[item.name];
      if (!iconName) return "/icons/Honkai_Star_Rail_App.webp";
      const finalIconName = iconName.endsWith(".png")
        ? iconName
        : `${iconName}.png`;
      if (item.item_type === "Light Cone") {
        return `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/light_cone/${finalIconName}`;
      } else {
        return `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/character/${finalIconName}`;
      }
    }

    return "/icons/Genshin_Impact.webp";
  };

  // ฟังก์ชันสำหรับคำนวณ Pity
  const calculatePityForData = (rawData: any[]) => {
    // 1. สร้าง Object สำหรับเก็บตัวนับ Pity และ Roll Number แยกตามประเภทตู้
    const pityTrackers: Record<string, number> = {};
    const pullCounters: Record<string, number> = {};
    let globalCounter = 1; // 👉 เพิ่มตัวนับรวมทุกตู้ตรงนี้

    // 2. กลับด้านข้อมูลเพื่อนับจาก "การกดครั้งเก่าสุด" มาหา "ใหม่สุด"
    const reversedData = [...rawData].reverse();

    // 3. วนลูปนับเลขทีละรายการ
    const dataWithStats = reversedData.map((item) => {
      // ดึงประเภทตู้ (ถ้าไม่มีให้ถือเป็น unknown กันเหนียว)
      const type = item.gacha_type || "unknown";

      // ถ้าเพิ่งเคยกดตู้นี้ครั้งแรก ให้ตั้งค่าเริ่มต้นเป็น 1
      if (!pityTrackers[type]) pityTrackers[type] = 1;
      if (!pullCounters[type]) pullCounters[type] = 1;

      // ดึงค่าปัจจุบันมาใช้กับไอเทมชิ้นนี้
      const currentPity = pityTrackers[type];
      const currentPullNumber = pullCounters[type];
      const currentGlobalNumber = globalCounter; // 👉 เก็บค่าตัวนับรวมของชิ้นนี้

      // อัปเดตตัวนับเตรียมไว้สำหรับรอบถัดไป
      // ZZZ ใช้ rank_type "4" สำหรับ S-rank, Genshin/HSR ใช้ "5"
      const sRankType = activeGame === "zzz" ? "4" : "5";
      if (item.rank_type === sRankType) {
        pityTrackers[type] = 1;
      } else {
        pityTrackers[type]++;
      }
      pullCounters[type]++;
      globalCounter++; // 👉 บวกตัวนับรวมขึ้น 1 เสมอไม่ว่าจะตู้ไหน

      // คืนค่าออบเจกต์เดิม พร้อมยัดค่า pity, pull_number และ global_pull_number
      return {
        ...item,
        pity: currentPity,
        pull_number: currentPullNumber,
        global_pull_number: currentGlobalNumber, // 👉 ส่งค่าตัวนับรวมออกไปใช้งาน
      };
    });

    // 4. กลับด้านข้อมูลให้เป็น "ใหม่สุด -> เก่าสุด" เหมือนเดิม
    return dataWithStats.reverse();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); // สั่งจบ Session กับ Supabase
    setCurrentUser(null); // ล้างชื่อ User ออกจากหน้าจอ
    localStorage.removeItem("gacha_user");
    localStorage.removeItem("gacha_pull_map");

    // [ส่วนที่เพิ่มใหม่] ล้างข้อมูลประวัติกาชาทุกเกมออก เพื่อให้กลับไปเป็นหน้า "ยังไม่มีประวัติ"
    setPullDataMap({
      genshin: [],
      hsr: [],
      zzz: [],
      wuwa: [],
      ark9: [],
    });

    triggerToast("ออกจากระบบเรียบร้อยแล้ว"); // โชว์ Popup
  };

  // ฟังก์ชันสั่งเล่น Animation ปิด แล้วค่อยเคลียร์ State
  const handleCloseModal = (type: "login" | "signup") => {
    setClosingModal(type);
    setTimeout(() => {
      if (type === "login") setIsLoginModalOpen(false);
      if (type === "signup") setIsSignUpModalOpen(false);
      setClosingModal(null);
      // เคลียร์ค่าในช่องกรอกข้อมูลเมื่อปิดหน้าต่าง
      setAuthEmail("");
      setAuthPassword("");
      setAuthUsername("");
      setAuthError(null);
    }, 250);
  };

  // --- ฟังก์ชันสมัครสมาชิก ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            username: authUsername, // แอบเก็บ username ไว้ในข้อมูลพ่วงของ Supabase
          },
        },
      });

      if (error) throw error;

      triggerToast("สมัครสมาชิกสำเร็จ!");
      handleCloseModal("signup");
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- ฟังก์ชันเข้าสู่ระบบ ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      // Step 1: ค้นหาอีเมลที่ผูกกับ Username นี้ในตาราง profiles
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", authUsername) // ใช้ State authUsername ที่ผู้ใช้กรอก
        .single();

      if (fetchError || !profile) {
        throw new Error("ไม่พบชื่อผู้ใช้นี้ในระบบ");
      }

      // Step 2: เอา Email ที่ค้นเจอไปส่งล็อกอินกับระบบ Auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: authPassword,
      });

      if (signInError) throw new Error("รหัสผ่านไม่ถูกต้อง");

      setCurrentUser(authUsername);
      triggerToast(`ยินดีต้อนรับคุณ ${authUsername}`);
      handleCloseModal("login");
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // --- Effect สำหรับหลอดโหลด ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      setIsComplete(false);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 1));
      }, 40);
    } else if (isComplete) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLoading, isComplete]);

  useEffect(() => {
    let dotInterval: NodeJS.Timeout;
    if (isLoading || isSearchingUrl) {
      dotInterval = setInterval(() => {
        setDotCount((prev) => (prev >= 3 ? 0 : prev + 1));
      }, 400);
    } else {
      setDotCount(0);
    }
    return () => clearInterval(dotInterval);
  }, [isLoading, isSearchingUrl]);

  // --- ตรวจสอบ Session ตอนโหลดหน้าเว็บ (แก้ปัญหา Refresh แล้วหลุด) ---
  useEffect(() => {
    // 1. ฟังก์ชันเช็กสถานะล็อกอินปัจจุบัน
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // ดึง username จาก user_metadata ที่เราแอบเก็บไว้ตอน Sign Up
        const username = session.user.user_metadata?.username;
        if (username) {
          setCurrentUser(username);
          localStorage.setItem("gacha_user", username);
        }
      }
    };

    // เรียกทำงานทันทีที่โหลดหน้าเว็บ
    checkSession();

    // 2. ดักฟัง Event การเปลี่ยนสถานะ (เช่น ล็อกอินจากแท็บอื่น หรือล็อกเอาท์)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const username = session.user.user_metadata?.username;
          if (username) {
            setCurrentUser(username);
            localStorage.setItem("gacha_user", username);
          }
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
          localStorage.removeItem("gacha_user");
          localStorage.removeItem("gacha_pull_map");
        }
      },
    );

    // Cleanup listener เมื่อปิดหน้าเว็บ
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- โหลดข้อมูลประวัติทุกเกมจาก Database พร้อมกันทันทีที่ล็อกอิน ---
  useEffect(() => {
    const fetchAllHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setIsFetchingHistory(true);

        try {
          // ดึงข้อมูลประวัติทุกเกมพร้อมกัน (Parallel) เพื่อให้สลับเกมได้ทันทีโดยไม่ต้องรอโหลดทีละเกม
          const [giRes, hsrRes, zzzRes] = await Promise.all([
            supabase
              .from("gacha_history_gi")
              .select("*")
              .eq("user_id", user.id)
              .order("time", { ascending: false }),
            supabase
              .from("gacha_history_hsr")
              .select("*")
              .eq("user_id", user.id)
              .order("time", { ascending: false }),
            supabase
              .from("gacha_history_zzz")
              .select("*")
              .eq("user_id", user.id)
              .order("time", { ascending: false }),
          ]);

          const giData = giRes.data || [];
          const hsrData = hsrRes.data || [];
          const zzzData = zzzRes.data || [];

          const newMap = {
            genshin: giData,
            hsr: hsrData,
            zzz: zzzData,
            wuwa: [],
            ark9: [],
          };

          setPullDataMap(newMap);
          localStorage.setItem("gacha_pull_map", JSON.stringify(newMap));

          // ถ้ามี activeGame และประวัติของเกมนั้นมีข้อมูล ให้เลือกแท็บ History
          if (activeGame) {
            const currentPulls =
              activeGame === "genshin"
                ? giData
                : activeGame === "hsr"
                  ? hsrData
                  : activeGame === "zzz"
                    ? zzzData
                    : [];
            if (currentPulls.length > 0) {
              setActiveTab("history");
            } else {
              setActiveTab("import");
            }
          }
        } catch (err) {
          console.error("Error fetching all history:", err);
        } finally {
          setIsFetchingHistory(false);
        }
      } else {
        setPullDataMap({
          genshin: [],
          hsr: [],
          zzz: [],
          wuwa: [],
          ark9: [],
        });
        localStorage.removeItem("gacha_pull_map");
      }
    };

    fetchAllHistory();
  }, [currentUser]);

  // ฟังก์ชันเลือกเกม: เช็กว่ามีประวัติการกดกาชาหรือไม่ เพื่อเลือกแท็บเริ่มต้นที่เหมาะสม
  const handleSelectGame = (gameId: string) => {
    setActiveGame(gameId);
    const existingPulls = pullDataMap[gameId] || [];
    if (existingPulls.length > 0) {
      setActiveTab("history");
    } else {
      setActiveTab("import");
    }
  };

  const [rankFilter, setRankFilter] = useState<"all" | "5" | "4" | "3">("all");
  const [gachaTypeFilter, setGachaTypeFilter] = useState<string>("all");
  const [zzzFilter, setZzzFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 100;
  const historyGridRef = useRef<HTMLDivElement>(null);

  // รีเซ็ตหน้ากลับเป็น 1 ทุกครั้งที่เปลี่ยนเกมหรือเปลี่ยนตัวกรอง
  useEffect(() => {
    setCurrentPage(1);
  }, [activeGame, rankFilter, gachaTypeFilter, zzzFilter]);

  // เลื่อน scrollbar ภายในตารางประวัติกลับขึ้นด้านบนสุดทุกครั้งที่เปลี่ยนหน้า (currentPage เปลี่ยน)
  useEffect(() => {
    if (historyGridRef.current) {
      historyGridRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  // --- ฟังก์ชันใหม่: อ่านไฟล์ และค้นหา URL ---
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSearchingUrl(true);
    setApiUrls((prev) => ({ ...prev, [activeGame!]: "" })); // ล้าง URL เดิมก่อน

    try {
      const text = await file.text();

      // 1. ตั้งค่าตัวแปรตามเกมที่เลือก (activeGame)
      let gameBiz = "";
      let apiBase = "";
      let defaultGachaType = "";

      if (activeGame === "genshin") {
        gameBiz = "hk4e_global";
        apiBase =
          "https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog";
        defaultGachaType = "301";
      } else if (activeGame === "hsr") {
        gameBiz = "hkrpg_global";
        apiBase =
          "https://public-operation-hkrpg-sg.hoyoverse.com/common/hkrpg_gacha_record/api/getGachaLog";
        defaultGachaType = "11";
      } else if (activeGame === "zzz") {
        gameBiz = "nap_global";
        apiBase =
          "https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog";
        defaultGachaType = "2";
      }

      // 2. สร้าง Regex แบบ Dynamic ตาม gameBiz ของแต่ละเกม
      const urlRegex = new RegExp(
        `https:\\/\\/[^\\s"'\\0]+game_biz=${gameBiz}[^\\s"'\\0]*`,
        "gi",
      );

      const matches = [...text.matchAll(urlRegex)];

      if (matches.length > 0) {
        // เลือก URL ที่มี timestamp ล่าสุด (authkey ที่ใหม่ที่สุด)
        const rawUrl = matches.reduce((best, current) => {
          const getTimestamp = (url: string) => {
            const m = url.match(/[?&]timestamp=(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
          };
          return getTimestamp(current[0]) >= getTimestamp(best[0])
            ? current
            : best;
        })[0];

        // ดึงส่วน query string จาก URL ที่พบในไฟล์ cache
        const queryStart = rawUrl.indexOf("?");
        const queryString =
          queryStart !== -1 ? rawUrl.slice(queryStart + 1) : rawUrl;

        // 3. ประกอบ API endpoint ที่ถูกต้อง (ใช้ apiBase ตามเกม) + query string เดิม
        let foundUrl = `${apiBase}?${queryString}`;

        // 4. ถ้าใน query string ยังไม่มี gacha_type ให้เติมไปด้วย (ใช้รหัสตามเกม)
        if (!foundUrl.includes("gacha_type")) {
          foundUrl += `&page=1&size=5&gacha_type=${defaultGachaType}`;
        }

        // เก็บชื่อไฟล์ลงใน state หรือเก็บ URL เพื่อให้กล่องเขียวแสดงผล
        setApiUrls((prev) => ({ ...prev, [activeGame!]: foundUrl }));
      } else {
        // 🌟 [แก้ไข 1] เปลี่ยนจาก alert เป็น triggerToast แบบ error
        triggerToast(
          `ไม่พบ URL สำหรับเกม ${activeGame === "genshin" ? "Genshin Impact" : "Honkai: Star Rail"} ในไฟล์นี้`,
          "error",
        );
      }
    } catch (error) {
      console.error("Error reading file:", error);
      // 🌟 [แก้ไข 2] เปลี่ยนจาก alert เป็น triggerToast แบบ error
      triggerToast("เกิดข้อผิดพลาดในการอ่านไฟล์", "error");
    } finally {
      setIsSearchingUrl(false);
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    const currentUrl = apiUrls[activeGame!];
    if (!currentUrl) return;

    setIsLoading(true);
    setPullDataMap((prev) => ({ ...prev, [activeGame!]: [] }));

    try {
      const response = await fetch("/api/gacha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: activeGame, apiUrl: currentUrl }),
      });

      const data = await response.json();

      if (data.error) {
        triggerToast(`เกิดข้อผิดพลาด: ${data.error}`, "error");
        setIsLoading(false);
        return;
      }

      if (data.pulls && data.pulls.length > 0) {
        // 1. อัปเดตข้อมูลขึ้นแสดงบนหน้าจอตามปกติ
        setPullDataMap((prev) => {
          const updated = { ...prev, [activeGame!]: data.pulls };
          localStorage.setItem("gacha_pull_map", JSON.stringify(updated));
          return updated;
        });

        // ==========================================
        // 2. บันทึกข้อมูลลง Database
        // ==========================================
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          triggerToast("กำลังซิงค์ข้อมูลลงระบบ...");

          // 🌟 เช็กชื่อเกมเพื่อเลือก Table ที่ถูกต้อง
          const tableName =
            activeGame === "zzz"
              ? "gacha_history_zzz"
              : activeGame === "hsr"
                ? "gacha_history_hsr"
                : "gacha_history_gi";

          // เตรียมข้อมูลให้คอลัมน์ตรงกับตาราง
          const insertData = data.pulls.map((pull: any) => {
            const baseData = {
              user_id: user.id,
              game: activeGame,
              gacha_id: pull.id,
              item_type: pull.item_type,
              name: pull.name,
              rank_type: pull.rank_type,
              time: pull.time,
              gacha_type: pull.gacha_type,
            };

            // แนบ item_id เฉพาะเกม ZZZ (ตารางอื่นไม่ได้สร้างคอลัมน์นี้ไว้ จะทำให้ Insert Error)
            if (activeGame === "zzz") {
              return { ...baseData, item_id: pull.item_id };
            }
            return baseData;
          });

          // 🌟 ใช้ tableName แทนการฟิกซ์ชื่อตาราง
          // ลบประวัติ "เก่า" ของเกมนี้สำหรับ User คนนี้ทิ้งก่อน
          await supabase
            .from(tableName)
            .delete()
            .eq("user_id", user.id)
            .eq("game", activeGame);

          // 🌟 ใช้ tableName นำข้อมูล "ใหม่" ใส่เข้าไป
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(insertData);

          if (insertError) {
            console.error("Error saving data:", insertError);
            triggerToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
          } else {
            triggerToast("บันทึกประวัติการกดเรียบร้อยแล้ว!");
          }
        } else {
          // ถ้าไม่ได้ล็อกอิน
          triggerToast("Import สำเร็จ! (ข้อมูลชั่วคราว)");
        }
        // ==========================================
      }

      setIsLoading(false);
      setIsComplete(true);

      triggerToast("Import complete");

      setTimeout(() => {
        setApiUrls((prev) => ({ ...prev, [activeGame!]: "" }));
        setIsComplete(false);
        setProgress(0);
        setActiveTab("history");
      }, 1000);
    } catch (error) {
      console.error("เกิดข้อผิดพลาด:", error);
      setIsLoading(false);
    }
  };

  const gameList = [
    {
      id: "genshin",
      name: "Genshin Impact",
      icon: (
        <img
          src="/icons/Genshin_Impact.webp"
          alt="Genshin"
          className="w-6 h-6 rounded-md object-cover"
        />
      ),
    },
    {
      id: "hsr",
      name: "Honkai: Star Rail",
      icon: (
        <img
          src="/icons/Honkai_Star_Rail_App.webp"
          alt="HSR"
          className="w-6 h-6 rounded-md object-cover"
        />
      ),
    },
    {
      id: "zzz",
      name: "Zenless Zone Zero",
      icon: (
        <img
          src="/icons/Zenless_Zone_Zero_App_Icon.webp"
          alt="ZZZ"
          className="w-6 h-6 rounded-md object-cover"
        />
      ),
    },
    {
      id: "wuwa",
      name: "Wuthering Waves",
      disabled: true,
      icon: (
        <img
          src="/icons/Wuthering_Waves.webp"
          alt="WuWa"
          className="w-6 h-6 rounded-md object-cover"
        />
      ),
    },
    {
      id: "ark9",
      name: "Arknights Endfield (TBA)",
      disabled: true,
      icon: (
        <img
          src="/icons/ark9.webp"
          alt="Arknights Endfield"
          className="w-6 h-6 rounded-md object-cover"
        />
      ),
    },
  ];

  // นำข้อมูลดิบมาผ่านฟังก์ชันคำนวณ Pity ก่อนนำไปใช้งานต่อ
  const currentPullData = useMemo(() => {
    if (!activeGame) return []; // 👉 [เพิ่มบรรทัดนี้]
    const rawData = pullDataMap[activeGame];
    if (!rawData || rawData.length === 0) return [];

    return calculatePityForData(rawData);
  }, [pullDataMap, activeGame]);

  const filteredPullData = useMemo(() => {
    if (!currentPullData) return [];

    let result = currentPullData;

    // 1. กรองตามประเภทตู้ (Gacha Type) - ใช้ได้กับทุกเกม (Genshin, HSR, ZZZ)
    if (gachaTypeFilter !== "all") {
      result = result.filter(
        (item) => String(item.gacha_type) === String(gachaTypeFilter),
      );
    }

    // 2. กรองตามระดับดาว/Rank
    if (rankFilter !== "all") {
      result = result.filter((item) => {
        const itemRank = String(item.rank_type);
        if (activeGame === "zzz") {
          // ZZZ: "4" = S-Rank, "3" = A-Rank, "2" = B-Rank
          if (rankFilter === "5") return itemRank === "4";
          if (rankFilter === "4") return itemRank === "3";
          if (rankFilter === "3") return itemRank === "2";
          return true;
        }
        return itemRank === String(rankFilter);
      });
    }

    return result;
  }, [currentPullData, activeGame, rankFilter, gachaTypeFilter]);

  // คำนวณจำนวนหน้าทั้งหมด (แบ่งหน้าละ 100 รายการ)
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredPullData.length / itemsPerPage));
  }, [filteredPullData.length, itemsPerPage]);

  // ดึงรายการประวัติเฉพาะของหน้าที่เลือกอยู่
  const paginatedPullData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPullData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPullData, currentPage, itemsPerPage]);

  // สร้างอาร์เรย์ตัวเลขหน้าสำหรับแสดงในปุ่มเลือกหน้า
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    // ถ้าไม่มีข้อมูลเกมนี้เลย ให้คืนค่า null เพื่อซ่อนกล่องสถิติ
    if (!currentPullData || currentPullData.length === 0) return null;

    // กรองข้อมูลแยกตามตู้ (Gacha Type) ก่อนนำมาคำนวณสถิติ
    let dataForStats = currentPullData;

    if (gachaTypeFilter !== "all") {
      dataForStats = currentPullData.filter(
        (item) => String(item.gacha_type) === String(gachaTypeFilter),
      );
    }

    const totalPulls = dataForStats.length;
    const totalGems = (totalPulls * 160).toLocaleString();

    // แยกกลุ่ม Rank (S/5★, A/4★, B/3★)
    const sRankVal = activeGame === "zzz" ? "4" : "5";
    const aRankVal = activeGame === "zzz" ? "3" : "4";
    const bRankVal = activeGame === "zzz" ? "2" : "3";

    const fiveStars = dataForStats.filter(
      (item) => String(item.rank_type) === sRankVal,
    );
    const fourStars = dataForStats.filter(
      (item) => String(item.rank_type) === aRankVal,
    );
    const threeStars = dataForStats.filter(
      (item) => String(item.rank_type) === bRankVal,
    );

    const getItemName = (item: any) => {
      if (!item) return "-";
      return activeGame === "zzz"
        ? zzzNameMap[String(item.item_id)] || item.name
        : item.name;
    };

    const latestFive = fiveStars.length > 0 ? getItemName(fiveStars[0]) : "-";
    const latestFour = fourStars.length > 0 ? getItemName(fourStars[0]) : "-";
    const latestThree =
      threeStars.length > 0 ? getItemName(threeStars[0]) : "-";

    return {
      totalPulls: totalPulls.toLocaleString(),
      totalGems,
      fiveStarCount: fiveStars.length.toLocaleString(),
      fourStarCount: fourStars.length.toLocaleString(),
      threeStarCount: threeStars.length.toLocaleString(),
      latestFive,
      latestFour,
      latestThree,
    };
  }, [currentPullData, activeGame, gachaTypeFilter, zzzNameMap]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans transition-colors duration-300">
      {/* --- Header --- */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30 flex justify-between items-center transition-all duration-300">
        <button
          onClick={() => {
            setActiveTab("welcome"); // สั่งให้กลับไปหน้า Welcome
            setActiveGame(null); // (ใส่หรือไม่ใส่ก็ได้) ถ้าลบ Comment บรรทัดนี้ออก ระบบจะล้างค่าเกมที่เลือกไว้ด้วย เหมือนรีเซ็ตใหม่หมด
          }}
          className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer flex items-center"
        >
          Gacha Tracker
        </button>

        {/* --- โซนเมนูด้านขวา --- */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* 👉 [เพิ่มใหม่] ตรวจสอบว่ามีผู้ใช้ล็อกอินหรือไม่ */}
          {currentUser ? (
            <>
              <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full">
                Hi, {currentUser}
              </span>
              <button
                onClick={handleLogout}
                className="cursor-pointer text-sm font-medium text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-200 hover:bg-red-500 hover:border-red-500 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              {/* ปุ่มเดิมตอนยังไม่ล็อกอิน */}
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="cursor-pointer text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Login
              </button>
              <button
                onClick={() => setIsSignUpModalOpen(true)}
                className="cursor-pointer text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
              >
                Sign Up
              </button>
            </>
          )}

          {/* --- ปุ่มเปิด/ปิดเมนูมือถือ --- */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="cursor-pointer md:hidden text-gray-600 hover:text-gray-900 focus:outline-none p-1 ml-1"
          >
            <div
              className={`transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "rotate-90" : "rotate-0"}`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </div>
          </button>
        </div>
      </header>

      {/* --- Login Modal --- */}
      {isLoginModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${closingModal === "login" ? "animate-fade-out" : "animate-fade-in"}`}
        >
          <div
            className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden ${closingModal === "login" ? "animate-slide-down" : "animate-slide-up"}`}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
              <button
                onClick={() => handleCloseModal("login")}
                className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* ผูก onSubmit กับ handleLogin */}
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {/* โชว์ Error ถ้ามี */}
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-4 py-2 text-gray-900 bg-white placeholder-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-2 text-gray-900 bg-white placeholder-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="password"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4 disabled:bg-blue-400 cursor-pointer flex justify-center items-center"
              >
                {authLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  "Login"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Sign Up Modal --- */}
      {isSignUpModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${closingModal === "signup" ? "animate-fade-out" : "animate-fade-in"}`}
        >
          <div
            className={`bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden ${closingModal === "signup" ? "animate-slide-down" : "animate-slide-up"}`}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                สร้างบัญชีใหม่
              </h2>
              <button
                onClick={() => handleCloseModal("signup")}
                className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* ผูก onSubmit กับ handleSignUp */}
            <form onSubmit={handleSignUp} className="p-6 space-y-4">
              {/* โชว์ Error ถ้ามี */}
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-4 py-2 text-gray-900 bg-white placeholder-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ตั้งชื่อผู้ใช้"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-2 text-gray-900 bg-white placeholder-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-2 text-gray-900 bg-white placeholder-gray-400 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-4 disabled:bg-blue-400 cursor-pointer flex justify-center items-center"
              >
                {authLoading ? (
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  "Sign Up"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Mobile Menu --- */}
      <div
        className={`md:hidden bg-white border-b border-gray-200 shadow-md absolute w-full z-20 overflow-hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "max-h-[800px] opacity-100 top-[60px]"
            : "max-h-0 opacity-0 top-[50px] pointer-events-none"
        }`}
      >
        <div className="px-4 py-3 font-semibold text-gray-500 text-xs tracking-wider uppercase bg-gray-50">
          เลือกเกม
        </div>
        <nav className="flex flex-col">
          {gameList.map((g) => (
            <div
              key={g.id}
              className="border-b border-gray-100 last:border-none"
            >
              <button
                onClick={() => {
                  if (g.disabled) return;
                  handleSelectGame(g.id);
                }}
                disabled={isLoading || g.disabled}
                className={`flex items-center w-full px-6 py-4 transition-colors duration-200 ${
                  g.disabled
                    ? "opacity-50 cursor-not-allowed text-gray-400"
                    : activeGame === g.id
                      ? "bg-blue-50 text-blue-700 font-semibold cursor-pointer"
                      : "text-gray-700 hover:bg-gray-50 cursor-pointer"
                }`}
              >
                <span className="mr-3 text-lg">{g.icon}</span>
                {g.name}
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 bg-gray-50 ${activeGame === g.id ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <div className="flex flex-col pl-14 pr-6 py-2 gap-1">
                  <button
                    onClick={() => {
                      setActiveTab("import");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`cursor-pointer text-left py-2 px-3 rounded-md text-sm transition-colors ${activeTab === "import" ? "bg-blue-100 text-blue-800 font-medium" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    📥 Import
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("history");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`cursor-pointer text-left py-2 px-3 rounded-md text-sm transition-colors ${activeTab === "history" ? "bg-blue-100 text-blue-800 font-medium" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    📜 History
                  </button>
                </div>
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* --- Layout หลัก --- */}
      <div className="flex flex-1 relative z-0 transition-all duration-300">
        {/* --- Sidebar (Desktop) --- */}
        <aside className="hidden md:flex flex-col w-72 bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300">
          <div className="p-4 font-semibold text-gray-500 text-xs tracking-wider uppercase mt-2">
            เลือกเกม
          </div>
          <nav className="flex-1 px-3 space-y-2 overflow-y-auto custom-scrollbar">
            {gameList.map((g) => (
              <div key={g.id} className="flex flex-col">
                <button
                  onClick={() => {
                    if (g.disabled) return;
                    handleSelectGame(g.id);
                  }}
                  disabled={isLoading || g.disabled}
                  className={`flex items-center w-full px-3 py-3 rounded-lg transition-all duration-200 ${
                    g.disabled
                      ? "opacity-50 cursor-not-allowed text-gray-400"
                      : activeGame === g.id
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-sm cursor-pointer"
                        : "text-gray-700 hover:bg-gray-100 cursor-pointer"
                  }`}
                >
                  <span className="mr-3 text-lg flex-shrink-0 flex items-center justify-center">
                    {g.icon}
                  </span>
                  {g.name}
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out pl-11 pr-2 ${
                    activeGame === g.id
                      ? "max-h-40 opacity-100 mt-1"
                      : "max-h-0 opacity-0 mt-0"
                  }`}
                >
                  <div className="flex flex-col gap-1 border-l-2 border-gray-200 pl-3 py-1">
                    <button
                      onClick={() => setActiveTab("import")}
                      className={`cursor-pointer text-left py-2 px-3 rounded-md text-sm transition-all duration-200 ${
                        activeTab === "import"
                          ? "bg-blue-100 text-blue-800 font-medium"
                          : "text-gray-500 hover:text-blue-600 hover:bg-gray-100"
                      }`}
                    >
                      Import
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className={`cursor-pointer text-left py-2 px-3 rounded-md text-sm transition-all duration-200 flex justify-between items-center ${
                        activeTab === "history"
                          ? "bg-blue-100 text-blue-800 font-medium"
                          : "text-gray-500 hover:text-blue-600 hover:bg-gray-100"
                      }`}
                    >
                      <span>History</span>
                      {pullDataMap[g.id].length > 0 && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                          {pullDataMap[g.id].length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* --- Main Content --- */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden transition-all duration-300">
          <div className="max-w-auto mx-auto md:mx-35 transition-all duration-300">
            {/* ---------------- แท็บ WELCOME (เพิ่มใหม่) ---------------- */}
            {isClient && (activeTab === "welcome" || !activeGame) && (
              <div className="bg-white p-10 md:p-16 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center min-h-[50vh] transition-all duration-500 animate-fade-in-up">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                  Welcome to Gacha Tracker
                </h2>
                <p className="text-gray-500 mb-8 max-w-md">
                  เลือกเกมที่คุณต้องการจัดการประวัติการเปิดกาชา
                  เพื่อเริ่มต้นใช้งาน
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {gameList.map((g) => (
                    <button
                      key={`welcome-${g.id}`}
                      onClick={() => {
                        if (g.disabled) return;
                        handleSelectGame(g.id);
                      }}
                      disabled={g.disabled}
                      className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all shadow-sm ${
                        g.disabled
                          ? "opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400"
                          : "bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border-gray-200 hover:border-blue-300 cursor-pointer hover:shadow-md hover:-translate-y-1"
                      }`}
                    >
                      {g.icon}
                      <span className="font-semibold">{g.name}</span>
                      {!g.disabled && pullDataMap[g.id]?.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full">
                          {pullDataMap[g.id].length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* ---------------- แท็บ IMPORT ---------------- */}
            {isClient && activeTab === "import" && activeGame && (
              <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-200 mb-8 transition-all duration-500 animate-fade-in-up">
                <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-3">
                  <span className="flex items-center justify-center">
                    {gameList.find((g) => g.id === activeGame)?.icon}
                  </span>
                  Import ประวัติ -{" "}
                  {gameList.find((g) => g.id === activeGame)?.name}
                </h2>

                {/* --- โซนอัปโหลดไฟล์ --- */}
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-blue-50 hover:border-blue-300 transition-colors duration-300 relative">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    {importGuide.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all text-pink-600">
                      {importGuide.path}
                    </code>
                  </p>

                  {/* ปุ่ม Input File (ถูกทำให้โปร่งใสแล้วซ้อนทับกรอบทั้งหมดเพื่อให้กดง่ายๆ) */}
                  <div className="flex justify-center">
                    <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-6 rounded-md shadow-sm hover:bg-gray-50 transition-colors">
                      {isSearchingUrl ? (
                        <div className="flex items-center">
                          <span>กำลังสแกนหา URL</span>
                          <span
                            className={`transition-opacity duration-300 ${dotCount >= 1 ? "opacity-100" : "opacity-0"}`}
                          >
                            .
                          </span>
                          <span
                            className={`transition-opacity duration-300 ${dotCount >= 2 ? "opacity-100" : "opacity-0"}`}
                          >
                            .
                          </span>
                          <span
                            className={`transition-opacity duration-300 ${dotCount >= 3 ? "opacity-100" : "opacity-0"}`}
                          >
                            .
                          </span>
                        </div>
                      ) : (
                        "คลิกเพื่อเลือกไฟล์"
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isSearchingUrl || isLoading}
                      />
                    </label>
                  </div>
                </div>

                {/* โชว์ URL ที่สแกนเจอ (แก้ไขไม่ได้) เพื่อให้ User รู้สึกอุ่นใจว่าระบบเจอของจริง */}
                {apiUrls[activeGame] && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in-up">
                    <div className="flex items-center gap-2 text-green-700 font-semibold">
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Select file{" "}
                      {gameList.find((g) => g.id === activeGame)?.name}{" "}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    // 1. ถ้ายังไม่ได้เลือกไฟล์ (ไม่มี URL) ให้แสดง Toast และหยุดการทำงาน
                    if (!apiUrls[activeGame]) {
                      triggerToast("กรุณา import file ก่อน", "error");
                      return;
                    }
                    // ถ้ามีไฟล์แล้วค่อยเรียกฟังก์ชัน Import จริง
                    handleImport();
                  }}
                  // 2. ให้ปุ่ม disable จริงๆ แค่ตอนที่กำลังโหลดเท่านั้น เพื่อป้องกันการกดซ้ำ
                  disabled={isLoading}
                  className={`w-full font-semibold p-4 rounded-xl mt-6 transition-all duration-200 shadow-sm
                    ${
                      isLoading
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed" // สถานะตอนกำลังโหลด (Disable จริง)
                        : apiUrls[activeGame]
                          ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98] cursor-pointer" // สถานะพร้อมกด (มีไฟล์)
                          : "bg-gray-300 text-gray-500 cursor-pointer active:scale-[0.98]" // สถานะสีเทา (ยังไม่มีไฟล์ แต่กดเพื่อดู Toast ได้)
                    }`}
                >
                  Import
                </button>
                {/* --- หลอดโหลดพร้อมตัวหนังสือ Loading... --- */}
                <div
                  className={`mt-4 overflow-hidden transition-all duration-500 ease-in-out ${isLoading || isComplete ? "max-h-24 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <div className="flex justify-between items-end mb-2 px-1">
                    <span className="text-sm font-medium text-gray-600">
                      {isComplete ? "ดึงข้อมูลสำเร็จ!" : "กำลังดึงข้อมูล"}
                    </span>
                    <div className="text-xl md:text-2xl font-bold text-blue-600 flex items-center">
                      {isComplete ? (
                        <span className="text-green-500">Success!</span>
                      ) : (
                        <div className="flex">
                          <span>Loading</span>
                          <div className="flex w-8 justify-start tracking-widest text-blue-600">
                            <span
                              className={`transition-opacity duration-300 ${dotCount >= 1 ? "opacity-100" : "opacity-0"}`}
                            >
                              .
                            </span>
                            <span
                              className={`transition-opacity duration-300 ${dotCount >= 2 ? "opacity-100" : "opacity-0"}`}
                            >
                              .
                            </span>
                            <span
                              className={`transition-opacity duration-300 ${dotCount >= 3 ? "opacity-100" : "opacity-0"}`}
                            >
                              .
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all duration-100 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- แท็บ HISTORY ---------------- */}
            {activeTab === "history" && (
              <div className="transition-all duration-500 animate-fade-in-up">
                {currentPullData.length > 0 ? (
                  <div>
                    {/* --- กล่องแสดงสถิติ (Dashboard Cards 8 กล่อง) --- */}
                    {stats && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {/* 2. เพชรที่ใช้ไป */}
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center shadow-sm">
                          <div className="text-emerald-600 text-xs md:text-sm font-semibold mb-1">
                            เพชรที่ใช้ไป
                          </div>
                          <div className="text-emerald-700 text-2xl md:text-3xl font-bold">
                            {stats.totalGems}
                          </div>
                        </div>

                        {/* 3. S-Rank ที่ได้ / ทองที่ได้ */}
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center shadow-sm">
                          <div className="text-amber-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "S-Rank ที่ได้"
                              : "ทองที่ได้ (5★)"}
                          </div>
                          <div className="text-amber-700 text-2xl md:text-3xl font-bold">
                            {stats.fiveStarCount}
                          </div>
                        </div>

                        {/* 4. A-Rank ที่ได้ / ม่วงที่ได้ (ย้ายขึ้นมาข้าง S-Rank) */}
                        <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-center shadow-sm">
                          <div className="text-purple-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "A-Rank ที่ได้"
                              : "ม่วงที่ได้ (4★)"}
                          </div>
                          <div className="text-purple-700 text-2xl md:text-3xl font-bold">
                            {stats.fourStarCount}
                          </div>
                        </div>

                        {/* 5. B-Rank ที่ได้ / ฟ้าที่ได้ (เพิ่มใหม่) */}
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center shadow-sm">
                          <div className="text-blue-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "B-Rank ที่ได้"
                              : "ฟ้าที่ได้ (3★)"}
                          </div>
                          <div className="text-blue-700 text-2xl md:text-3xl font-bold">
                            {stats.threeStarCount}
                          </div>
                        </div>

                        {/* 1. เปิดไปทั้งหมด */}
                        <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl text-center shadow-sm">
                          <div className="text-sky-600 text-xs md:text-sm font-semibold mb-1">
                            เปิดไปทั้งหมด (ครั้ง)
                          </div>
                          <div className="text-sky-700 text-2xl md:text-3xl font-bold">
                            {stats.totalPulls}
                          </div>
                        </div>

                        {/* 6. S-Rank ล่าสุด / 5★ ล่าสุด */}
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-center shadow-sm flex flex-col justify-center">
                          <div className="text-orange-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "S-Rank ล่าสุด"
                              : "5★ ล่าสุด"}
                          </div>
                          <div
                            className="text-orange-700 text-sm md:text-lg font-bold truncate px-2"
                            title={stats.latestFive}
                          >
                            {stats.latestFive}
                          </div>
                        </div>

                        {/* 7. A-Rank ล่าสุด / 4★ ล่าสุด */}
                        <div className="bg-fuchsia-50 border border-fuchsia-100 p-4 rounded-xl text-center shadow-sm flex flex-col justify-center">
                          <div className="text-fuchsia-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "A-Rank ล่าสุด"
                              : "4★ ล่าสุด"}
                          </div>
                          <div
                            className="text-fuchsia-700 text-sm md:text-lg font-bold truncate px-2"
                            title={stats.latestFour}
                          >
                            {stats.latestFour}
                          </div>
                        </div>

                        {/* 8. B-Rank ล่าสุด / 3★ ล่าสุด (เพิ่มใหม่) */}
                        <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-xl text-center shadow-sm flex flex-col justify-center">
                          <div className="text-cyan-600 text-xs md:text-sm font-semibold mb-1">
                            {activeGame === "zzz"
                              ? "B-Rank ล่าสุด"
                              : "3★ ล่าสุด"}
                          </div>
                          <div
                            className="text-cyan-700 text-sm md:text-lg font-bold truncate px-2"
                            title={stats.latestThree}
                          >
                            {stats.latestThree}
                          </div>
                        </div>

                        {/* --- ส่วนหัวของ History Grid (เพิ่มปุ่มกรอง) --- */}
                        <div className="w-full col-span-full flex justify-between items-end mt-6 mb-2 px-1">
                          <h3 className="text-sm md:text-base font-bold text-gray-700">
                            ประวัติการกด (History)
                          </h3>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* ปุ่มกรองประเภทตู้ (แสดงเฉพาะ Genshin) */}
                            {activeGame === "genshin" && (
                              <div className="flex bg-gray-200 p-1 rounded-lg gap-1 overflow-x-auto">
                                <button
                                  onClick={() => setGachaTypeFilter("all")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "all" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ทุกตู้
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("301")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "301" ? "bg-pink-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ตัวละคร
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("302")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "302" ? "bg-blue-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้อาวุธ
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("200")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "200" ? "bg-gray-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ถาวร
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("500")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "500" ? "bg-teal-600 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้รวมพร
                                </button>
                              </div>
                            )}

                            {/* ปุ่มกรองประเภทตู้ (แสดงเฉพาะ Honkai Star Rail) */}
                            {activeGame === "hsr" && (
                              <div className="flex bg-gray-200 p-1 rounded-lg gap-1 overflow-x-auto">
                                <button
                                  onClick={() => setGachaTypeFilter("all")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "all" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ทุกตู้
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("11")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "11" ? "bg-pink-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ตัวละคร
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("12")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "12" ? "bg-blue-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ไลท์โคน
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("1")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "1" ? "bg-gray-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ถาวร
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("21")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "21" ? "bg-purple-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้คอลแลป
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("22")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "22" ? "bg-teal-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้อาวุธคอลแลป
                                </button>
                              </div>
                            )}

                            {/* ปุ่มกรองประเภทตู้ (แสดงเฉพาะ Zenless Zone Zero) */}
                            {activeGame === "zzz" && (
                              <div className="flex bg-gray-200 p-1 rounded-lg gap-1 overflow-x-auto">
                                <button
                                  onClick={() => setGachaTypeFilter("all")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "all" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ทุกตู้
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("2")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "2" ? "bg-pink-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ Agent
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("3")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "3" ? "bg-blue-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ W-Engine
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("1")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "1" ? "bg-gray-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ถาวร
                                </button>
                                <button
                                  onClick={() => setGachaTypeFilter("5")}
                                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${gachaTypeFilter === "5" ? "bg-amber-600 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                  ตู้ Bangboo
                                </button>
                              </div>
                            )}

                            {/* ปุ่มกรองดาว/Rank */}
                            <div className="flex bg-gray-200 p-1 rounded-lg gap-1">
                              <button
                                onClick={() => setRankFilter("all")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${rankFilter === "all" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                ทั้งหมด
                              </button>
                              <button
                                onClick={() => setRankFilter("5")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${rankFilter === "5" ? "bg-orange-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                {activeGame === "zzz" ? "S-Rank" : "5★"}
                              </button>
                              <button
                                onClick={() => setRankFilter("4")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${rankFilter === "4" ? "bg-purple-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                {activeGame === "zzz" ? "A-Rank" : "4★"}
                              </button>
                              <button
                                onClick={() => setRankFilter("3")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${rankFilter === "3" ? "bg-blue-500 shadow-sm text-white" : "text-gray-500 hover:text-gray-700"}`}
                              >
                                {activeGame === "zzz" ? "B-Rank" : "3★"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* --- History Grid --- */}
                        <div className="w-full col-span-full overflow-hidden rounded-xl shadow-sm border border-[#d5c4a1] bg-[#f0ebd9]">
                          {/* 🔝 Pagination Header Bar */}
                          <div className="flex flex-wrap justify-between items-center px-4 py-2 bg-[#e4dcbf] border-b border-[#d5c4a1] text-xs font-semibold text-gray-700 gap-2">
                            <div>
                              แสดง {paginatedPullData.length} จากทั้งหมด{" "}
                              {filteredPullData.length.toLocaleString()} รายการ
                              (หน้า {currentPage} จาก {totalPages})
                            </div>
                          </div>

                          <div
                            ref={historyGridRef}
                            className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar"
                          >
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                              {paginatedPullData.map((item, index) => {
                                const pityStyle = getPityCardStyle(
                                  item.pity || 0,
                                );

                                const displayName =
                                  activeGame === "zzz"
                                    ? zzzNameMap[String(item.item_id)] ||
                                      item.name
                                    : item.name;

                                return (
                                  <div
                                    key={item.id || index}
                                    title={`${displayName} (Pity: ${item.pity || 0})`}
                                    className={`relative w-full aspect-square bg-[#1c1c1e] rounded-xl overflow-hidden border-2 shadow-md hover:scale-105 transition-transform duration-150 cursor-pointer flex items-center justify-center p-1 ${pityStyle.border}`}
                                  >
                                    <img
                                      src={getIconUrl(item)}
                                      alt={displayName}
                                      className={`w-full h-full ${activeGame === "zzz" ? "object-contain drop-shadow-md" : "object-cover rounded-lg"}`}
                                      onError={(e) => {
                                        e.currentTarget.src =
                                          activeGame === "hsr"
                                            ? "/icons/Honkai_Star_Rail_App.webp"
                                            : activeGame === "zzz"
                                              ? "/icons/Zenless_Zone_Zero_App_Icon.webp"
                                              : "/icons/Genshin_Impact.webp";
                                      }}
                                    />

                                    {/* มุมซ้ายบน: Pity */}
                                    <div
                                      className={`absolute top-0 left-0 px-1.5 py-0.5 text-xs font-bold ${pityStyle.bg} ${pityStyle.text} rounded-br-md shadow z-10`}
                                    >
                                      {item.pity || 0}
                                    </div>

                                    {/* มุมขวาล่าง: Roll Number */}
                                    <div className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[10px] font-bold bg-black/80 text-yellow-400 rounded-tl-md z-10">
                                      #
                                      {gachaTypeFilter === "all"
                                        ? item.global_pull_number || 0
                                        : item.pull_number || 0}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 🔻 Pagination Footer Navigation (ตัวเลือกเปลี่ยนหน้า) */}
                          {totalPages > 1 && (
                            <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-[#e4dcbf] border-t border-[#d5c4a1] gap-2">
                              <div className="text-xs font-bold text-gray-700">
                                หน้า {currentPage} จาก {totalPages}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    setCurrentPage((prev) =>
                                      Math.max(1, prev - 1),
                                    )
                                  }
                                  disabled={currentPage === 1}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${currentPage === 1 ? "opacity-40 cursor-not-allowed bg-gray-200 text-gray-400" : "bg-white hover:bg-gray-100 text-gray-800 shadow-sm cursor-pointer"}`}
                                >
                                  ‹ ก่อนหน้า
                                </button>

                                {pageNumbers.map((p, i) =>
                                  typeof p === "number" ? (
                                    <button
                                      key={`page-${p}`}
                                      onClick={() => setCurrentPage(p)}
                                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${currentPage === p ? "bg-amber-600 text-white shadow-md" : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"}`}
                                    >
                                      {p}
                                    </button>
                                  ) : (
                                    <span
                                      key={`ellipsis-${i}`}
                                      className="px-1 text-xs text-gray-500 font-bold"
                                    >
                                      {p}
                                    </span>
                                  ),
                                )}

                                <button
                                  onClick={() =>
                                    setCurrentPage((prev) =>
                                      Math.min(totalPages, prev + 1),
                                    )
                                  }
                                  disabled={currentPage === totalPages}
                                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${currentPage === totalPages ? "opacity-40 cursor-not-allowed bg-gray-200 text-gray-400" : "bg-white hover:bg-gray-100 text-gray-800 shadow-sm cursor-pointer"}`}
                                >
                                  ถัดไป ›
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="text-4xl mb-4 opacity-50 flex justify-center">
                      {gameList.find((g) => g.id === activeGame)?.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      ยังไม่มีประวัติการกดของเกมนี้
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">
                      กรุณา Import ข้อมูลของเกม{" "}
                      {gameList.find((g) => g.id === activeGame)?.name} ก่อน
                    </p>
                    <button
                      onClick={() => setActiveTab("import")}
                      className="cursor-pointer bg-blue-50 text-blue-600 px-6 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                    >
                      ไปที่หน้า Import
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* --- Popup (Toast Notification) --- */}
      <div
        className={`fixed bottom-6 md:bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 transition-all duration-500 ease-in-out ${showToast ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}`}
      >
        {/* เช็กเงื่อนไขแสดง Icon */}
        {toastType === "success" ? (
          <svg
            className="w-6 h-6 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}

        <span className="font-semibold tracking-wide text-sm md:text-base">
          {toastMessage}
        </span>
      </div>
    </div>
  );
}
