# Gacha Tracker

> [!NOTE]
> **Developer Note:**
> This project represents my initial step into learning Next.js at a foundational level. It reflects my basic understanding of core concepts, project architecture, and web development workflows, created in collaboration with AI technology for personal growth and practical use.
>
> **Project Status:** `Archived`

A modern, responsive web application for tracking and analyzing gacha pull history, pity counters, and statistics across multiple HoYoverse titles (**Genshin Impact**, **Honkai: Star Rail**, and **Zenless Zone Zero**).

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, and **Supabase**.

---

## 🌟 Key Features

- 🎮 **Multi-Game Support**: Seamlessly switch between Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero.
- 📊 **Automated Pity Tracking**: Calculates pity count per banner type (Character, Weapon, Standard, Chronicled) and tracks total roll counters automatically.
- 📄 **100-Item Paginated History Grid**: View up to 100 gacha pulls per page with intuitive page navigation and auto-scroll-to-top on page change.
- ⚡ **Instant Local Storage Caching**: Uses a Stale-While-Revalidate strategy to cache authentication state and pull history locally for zero-latency page loads and smooth transitions.
- 🎨 **Modern Sleek Aesthetics**: Dark-themed item cards with color-coded pity indicators (Green for early pity, Orange/Red for high pity).
- 🔒 **User Authentication & Data Persistence**: Secure sign-up/login powered by Supabase Auth with per-user data isolation.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL & Supabase Auth)
- **Asset CDNs**: `gi.yatta.moe` (Genshin Impact icons), `raw.githubusercontent.com` (StarRailRes for HSR), HoYoWiki (Zenless Zone Zero icons), Enka Network

---

## 🗄️ Backend & Database Setup (Supabase)

This project uses **Supabase** as its backend database and authentication provider. You do **not** need any pre-packaged `.sql` migration files; simply create the required tables in your Supabase SQL Editor or Table Editor as detailed below.

### 1. Database Table Schemas

Create the following tables in your Supabase project:

#### A. Genshin Impact Table (`gacha_history_gi`)

| Column Name  | Data Type            | Constraints / Description                             |
| :----------- | :------------------- | :---------------------------------------------------- |
| `id`         | `uuid`               | Primary Key, Default: `gen_random_uuid()`             |
| `user_id`    | `uuid`               | References `auth.users(id)`                           |
| `game`       | `text`               | e.g. `"genshin"`                                      |
| `gacha_id`   | `text`               | Unique gacha record ID from game API                  |
| `item_type`  | `text`               | `"ตัวละคร"` (Character) or `"อาวุธ"` (Weapon)         |
| `name`       | `text`               | Item name (e.g., `"Amber"`, `"Staff of Homa"`)        |
| `rank_type`  | `text`               | `"3"`, `"4"`, or `"5"`                                |
| `time`       | `timestamp` / `text` | Date and time of pull                                 |
| `gacha_type` | `text`               | Banner type code (`"301"`, `"302"`, `"200"`, `"500"`) |

#### B. Honkai: Star Rail Table (`gacha_history_hsr`)

| Column Name  | Data Type            | Constraints / Description                                |
| :----------- | :------------------- | :------------------------------------------------------- |
| `id`         | `uuid`               | Primary Key, Default: `gen_random_uuid()`                |
| `user_id`    | `uuid`               | References `auth.users(id)`                              |
| `game`       | `text`               | e.g. `"hsr"`                                             |
| `gacha_id`   | `text`               | Unique gacha record ID from game API                     |
| `item_type`  | `text`               | Item type                                                |
| `name`       | `text`               | Character or Light Cone name                             |
| `rank_type`  | `text`               | `"3"`, `"4"`, or `"5"`                                   |
| `time`       | `timestamp` / `text` | Date and time of pull                                    |
| `gacha_type` | `text`               | Banner type code (`"11"`, `"12"`, `"1"`, `"21"`, `"22"`) |

#### C. Zenless Zone Zero Table (`gacha_history_zzz`)

| Column Name  | Data Type            | Constraints / Description                     |
| :----------- | :------------------- | :-------------------------------------------- |
| `id`         | `uuid`               | Primary Key, Default: `gen_random_uuid()`     |
| `user_id`    | `uuid`               | References `auth.users(id)`                   |
| `game`       | `text`               | e.g. `"zzz"`                                  |
| `gacha_id`   | `text`               | Unique gacha record ID from game API          |
| `item_id`    | `text` / `bigint`    | ZZZ Item ID (used for asset lookup)           |
| `item_type`  | `text`               | Item type                                     |
| `name`       | `text`               | Agent, W-Engine, or Bangboo name              |
| `rank_type`  | `text`               | `"2"`, `"3"`, or `"4"` (ZZZ S-Rank is `"4"`)  |
| `time`       | `timestamp` / `text` | Date and time of pull                         |
| `gacha_type` | `text`               | Banner type code (`"1"`, `"2"`, `"3"`, `"5"`) |

#### D. User Profiles Table (`profiles`)

| Column Name | Data Type | Constraints / Description                |
| :---------- | :-------- | :--------------------------------------- |
| `id`        | `uuid`    | Primary Key, References `auth.users(id)` |
| `username`  | `text`    | Unique username for display              |
| `email`     | `text`    | User email address                       |

---

### ✏️ Customizing Database Table Names in Code

If you prefer to customize table names (e.g., changing `gacha_history_gi` to `my_custom_genshin_table`), update the `tableName` variables in [app/page.tsx](file:///c:/Users/7813PN/Desktop/gacha-tracker/app/page.tsx):

> [!WARNING]
> **Note on Line Numbers:** Line numbers below are approximate and may shift slightly as the codebase evolves. Search for the function names `fetchAllHistory` and `handleImport` or the variable name `tableName` in `app/page.tsx`.

1. **Fetching History (`fetchAllHistory`)**:
   Located around lines **486–502** in `app/page.tsx`:

   ```typescript
   const [giRes, hsrRes, zzzRes] = await Promise.all([
     supabase.from("YOUR_GENSHIN_TABLE").select("*").eq("user_id", user.id)...,
     supabase.from("YOUR_HSR_TABLE").select("*").eq("user_id", user.id)...,
     supabase.from("YOUR_ZZZ_TABLE").select("*").eq("user_id", user.id)...,
   ]);
   ```

2. **Saving History (`handleImport`)**:
   Located around lines **729–738** in `app/page.tsx`:
   ```typescript
   const tableName =
     activeGame === "zzz"
       ? "YOUR_ZZZ_TABLE"
       : activeGame === "hsr"
         ? "YOUR_HSR_TABLE"
         : "YOUR_GENSHIN_TABLE";
   ```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) or `pnpm`
- A [Supabase](https://supabase.com/) project

### 1. Environment Variables Setup

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Installation & Running Locally

```bash
# Clone the repository
git clone https://github.com/your-username/gacha-tracker.git
cd gacha-tracker

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open `http://localhost:3000` in your browser to start tracking your gacha history!

---

## 📁 Project Structure

```
gacha-tracker/
├── app/
│   ├── api/
│   │   └── gacha/          # Next.js API route for Hoyoverse Gacha Log API proxy
│   ├── favicon.ico
│   ├── globals.css         # Custom styling and scrollbar utilities
│   ├── layout.tsx          # Root layout and metadata configuration
│   └── page.tsx            # Main application UI and logic
├── lib/
│   └── supabase.ts         # Supabase client configuration with fallbacks
├── public/
│   ├── gi/                 # Genshin Impact mapping data
│   ├── hsr/                # Honkai: Star Rail mapping data
│   ├── zzz/                # Zenless Zone Zero mapping data
│   └── icons/              # Game logos & fallback assets
└── package.json
```

---

## ⚖️ Disclaimer & License

> [!IMPORTANT]
> **Disclaimer:**  
> This repository is created solely for personal portfolio demonstration and skill showcase purposes. It is strictly non-commercial and not intended for commercial monetization or public service distribution.

This project is open-source and intended for personal use and portfolio demonstration. All game assets, character names, logos, and icons are trademarks and copyrights of **Cognosphere / HoYoverse**.
