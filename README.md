# Web_GA — General Affairs Activity Tracker & Analytics

**Web_GA** is a high-density dashboard and activity tracking platform for company General Affairs (GA) departments. It centralizes GA transaction inputs, manages ongoing payments, schedules recurring bills, tracks company asset inventory, and provides visual reports of monthly expenditures grouped by branches and categories.

---

## 🚀 Key Features

* **Multi-Branch Isolation**: Secure role-based authorization restricting standard users to their home branches while allowing Superadmins to view consolidated aggregate reports.
* **Bulk Imports**: Safe, transaction-atomic spreadsheet imports (.xlsx, .xls, .csv) for both financial transactions and inventory assets, featuring client-side spreadsheet parsing and live table preview validations.
* **Ongoing & Recurring Payments**: Automatic spawning of recurring utilities (Internet, electricity, water) alongside real-time funding status and receipt validations.
* **Visual Reports**: High-density interactive Recharts panels showing expenditure trends, branch comparison bars, and categories proportional donut breakdowns.
* **Audit Logging**: Traceable record log tracking all administrator actions (CREATE, UPDATE, DELETE).

---

## 🛠️ Tech Stack

* **Framework**: Next.js 16+ (App Router, TypeScript)
* **Database**: PostgreSQL 16+
* **ORM**: Prisma (using strict type constraints)
* **Charts**: Recharts (fully responsive wrappers)
* **Auth**: Custom JWT (via HTTP-Only Cookies + Edge Middleware)
* **Icons**: Lucide React SVG

---

## 🏁 Getting Started

### 1. Prerequisites
* **Node.js** v18.0 or higher
* **PostgreSQL** 15+ database instance

### 2. Environment Setup
Create a `.env` file in the root directory of the `web-ga` project:

```ini
# Database Connection
DATABASE_URL="postgresql://<db_user>:<db_pass>@localhost:5432/<db_name>?schema=public"

# Authentication Security keys
JWT_SECRET="--generate-a-secure-32-byte-hex-key--"
INITIAL_SUPERADMIN_PASSWORD="--use-a-strong-custom-superadmin-password--"

# Server config
PORT=3000
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> *Tip: Generate a jwt secret key running:* `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Database Initialization & Seeding
Create database tables, run migrations, and seed company defaults (categories, subcategories, default branches, and the superadmin user):

```bash
# Apply database schemas
npx prisma migrate dev

# Seed defaults data
npx prisma db seed
```

### 4. Running the Application
Launch the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the dashboard.

---

## 📦 Project Scripts

* `npm run dev`: Launch hot-reloading development server.
* `npm run build`: Compile Next.js production build and check type safety.
* `npm run start`: Launch optimized production server.
* `npm run lint`: Run ESLint code quality checks.
* `npm run db:migrate`: Create database migrations.
* `npm run db:seed`: Trigger db seed script manually.
* `npm run db:studio`: Launch graphical database manager interface.

---

## 🌐 Deployment
For VPS configuration instructions (such as co-hosting with Python platforms using PM2, virtual domains mapping via Nginx reverse proxies, and Certbot SSL setup), refer to [DEPLOYMENT.md](file:///d:/Kerja/Web_GA/web-ga/DEPLOYMENT.md).
