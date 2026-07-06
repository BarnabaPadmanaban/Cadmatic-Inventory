# ☢️ Nuclear Power Plant Equipment Monitoring System

A full-stack web application for monitoring and managing equipment in a nuclear power plant. Built with React, Node.js/Express, and Microsoft SQL Server.

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Recharts, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | Microsoft SQL Server (mssql) |
| Styling | Custom CSS (Cadmatic-inspired dark theme) |
| File Handling | multer + xlsx |

---

## 📁 Project Structure

```
nuclear-ems/
├── backend/
│   ├── src/
│   │   ├── config/       database.js
│   │   ├── controllers/  equipmentController.js
│   │   ├── middleware/   errorHandler.js
│   │   ├── migrations/   runMigrations.js, seed.js
│   │   ├── routes/       equipment.js
│   │   └── server.js
│   ├── uploads/          (auto-created)
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/   Sidebar, Topbar, StatusBadge
    │   ├── pages/        Dashboard, EquipmentList, EquipmentDetail, EquipmentForm, ImportExport, Reports
    │   ├── services/     api.js
    │   ├── utils/        statusUtils.js
    │   ├── App.jsx
    │   ├── index.js
    │   └── index.css
    └── package.json
```

---

## ⚙️ Prerequisites

- Node.js 18+
- Microsoft SQL Server 2019+ (or SQL Server Express)
- npm

---

## 🚀 Setup Instructions

### 1. Database Setup (Microsoft SQL Server)

1. Open SQL Server Management Studio (SSMS)
2. Create a new database:
   ```sql
   CREATE DATABASE NuclearEMS;
   ```
3. Enable SQL Server Authentication (Mixed Mode) if not already done.
4. Create or use the `sa` account (or create a dedicated user).

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

Edit `.env` with your SQL Server details:
```env
PORT=5000
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=NuclearEMS
DB_USER=sa
DB_PASSWORD=YourStrongPassword@123
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
CLIENT_URL=http://localhost:3000
```

```bash
# Run database migrations (creates tables)
npm run migrate

# Start development server
npm run dev
```

Equipment data starts empty and is populated through Excel import or manual entry.

Backend runs at: **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start React app
npm start
```

Frontend runs at: **http://localhost:3000**

---

## 🔐 Authentication & Authorization

The system uses JWT-based authentication with two roles:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access — create/edit/delete equipment, import Excel, export reports, manage users, upload documents, update equipment status, view analytics |
| **Viewer** | Read-only — view dashboard, equipment details, reports, and maintenance records (no create/edit/delete) |

### Default credentials (seeded automatically on first migration / dev fallback)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123` | Admin |
| `viewer` | `Viewer@123` | Viewer |

**⚠️ Change these passwords immediately after first login in any real deployment.**

All `/api/equipment` and `/api/maintenance` routes require a valid JWT (`Authorization: Bearer <token>`); write operations (create/update/delete/import/export/upload) additionally require the `Admin` role. The frontend stores the token in `localStorage` (if "Remember me" is checked) or `sessionStorage`, attaches it to every API call automatically, and redirects to `/login` on 401 responses or session expiry.

Every login, logout, equipment/maintenance create-update-delete, document upload, and user-management action is recorded in the `ActivityLogs` table and viewable from **Admin → Activity Logs**.

### Auth API Endpoints

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | /api/auth/login | Public | Authenticate and receive a JWT |
| POST | /api/auth/logout | Authenticated | Logs the logout event |
| GET | /api/auth/me | Authenticated | Get current user profile |
| GET | /api/auth/users | Admin | List all users |
| POST | /api/auth/users | Admin | Create a new user |
| PUT | /api/auth/users/:id | Admin | Update a user |
| PATCH | /api/auth/users/:id/status | Admin | Activate/deactivate a user |
| DELETE | /api/auth/users/:id | Admin | Delete a user |
| GET | /api/auth/activity-logs | Admin | View the audit trail |

---

## 🔌 API Endpoints

> All endpoints below require a valid JWT unless noted. Write operations require the `Admin` role.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Server health check (public) |
| GET | /api/equipment | List all equipment (with filters) |
| GET | /api/equipment/stats/dashboard | Dashboard statistics |
| GET | /api/equipment/status-lookup | Status code reference |
| GET | /api/equipment/export | Export to Excel (Admin only) |
| GET | /api/equipment/:id | Get single equipment + maintenance |
| POST | /api/equipment | Create new equipment (Admin only) |
| PUT | /api/equipment/:id | Update equipment (Admin only) |
| DELETE | /api/equipment/:id | Soft-delete equipment (Admin only) |
| POST | /api/equipment/import/excel | Import from Excel (Admin only) |
| POST | /api/equipment/:id/maintenance | Add maintenance record (Admin only) |

### Query Parameters (GET /api/equipment)
- `search` — search by position ID, status, vendor, location
- `status` — filter by status code (0–8)
- `package_name` — filter by EPC package name
- `page` / `limit` — pagination

---

## 📊 Equipment Status Codes

| Code | Status |
|------|--------|
| 0 | Order Not Yet Placed |
| 1 | Order Placed |
| 2 | Shipping Release Issued |
| 3 | Received at Site |
| 4 | Erected at Location |
| 5 | Hydro Tested |
| 6 | CCC/STD Released |
| 7 | Handover to O&M |
| 8 | Commissioned |

---

## 📋 Excel Import Format

The Excel file should have these columns (Sheet 1):

| Column | Description |
|--------|-------------|
| `nam Position Id` | Equipment position ID (required) |
| `Storage Number` | Storage/tag number |
| `EPC Purchase Order Number` | EPC PO reference |
| `Sub Purchase Order Number` | Sub-PO reference |
| `Sub PO Vendor Name` | Vendor name |
| `NPCIL Spec Number` | Specification number |
| `NPCIL Spec Status` | Spec Issued / Spec Not Issued |
| `Drawing Number` | Drawing reference |
| `Drawing Status` | Drawing Issued / Drawing Not Issued |
| `Data Sheet Number` | Data sheet reference |
| `Data Sheet Status` | Data Sheet status |
| `EPC Package Name` | Package identifier (e.g. NIMEP) |
| `Equip Status` | Text status (mapped to code automatically) |

---

## 🎨 Features

- **Dashboard** — KPI cards, bar chart, pie chart, status pipeline, recent activity
- **Equipment List** — paginated table, search, filter by status
- **Equipment Detail** — full info, visual status pipeline, maintenance history
- **Add/Edit Equipment** — full form with all fields
- **Import** — upload Excel (.xlsx/.xls), auto-maps status text to codes
- **Export** — download all equipment as formatted Excel
- **Reports** — horizontal bar chart, pie distribution, summary table
- **Maintenance Records** — per-equipment history log

---

## 🛠️ SQL Server Notes

If you get connection errors:
1. Open **SQL Server Configuration Manager**
2. Enable **TCP/IP** under SQL Server Network Configuration
3. Set port to **1433**
4. Restart SQL Server service
5. Check Windows Firewall allows port 1433

For local development with SQL Express, set:
```
DB_SERVER=localhost\SQLEXPRESS
```
