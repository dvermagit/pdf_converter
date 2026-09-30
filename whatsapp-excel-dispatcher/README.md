# WhatsApp Excel Dispatcher

A full-stack web application for automated, scheduled WhatsApp message delivery with personalized Excel attachments.

## Features

- **Campaign Templates** — Reusable messages for Diwali, Holi, New Year, birthdays or any event, with an event date, default send time and `{{name}}`-style placeholders. Built-in presets to start from.
- **Manual Recipient Entry** — Build a campaign from a form instead of an Excel file: pick a template, type (or paste) your contacts, preview the exact messages, and schedule.
- **Assign People Anytime** — Add people to a form-built campaign after it is created; a running campaign schedules them immediately, a draft holds them until you start it.
- **Master Excel Upload** — Upload a single Excel file with all recipient details
- **Column Mapping** — Map arbitrary Excel headers to required fields via the UI
- **Validation** — Phone number normalization, date parsing, duplicate detection
- **Personalized Excel Generation** — Each recipient gets their own tailored workbook
- **Scheduled Delivery** — Messages are sent at the exact time specified per recipient
- **WhatsApp Integration** — Documents + messages sent via Meta WhatsApp Cloud API
- **Delivery Tracking** — Real-time status tracking via Meta webhooks (sent → delivered → read → failed)
- **Retry Logic** — Exponential backoff for transient failures, smart error classification
- **Dashboard** — Stats, recent campaigns, upcoming deliveries
- **Authentication** — JWT-based auth with Argon2 password hashing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Chakra UI v3, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB + Mongoose |
| Scheduling | Agenda.js (persistent) + node-cron (maintenance) |
| Excel | ExcelJS |
| WhatsApp | Meta WhatsApp Cloud API |
| Email | Nodemailer + MJML |
| Auth | JWT + Argon2 |

## Prerequisites

- Node.js ≥ 20
- MongoDB (local or Atlas)
- Meta Business Account with WhatsApp Business API access

## Quick Start

### 1. Backend

```bash
cd whatsapp-excel-dispatcher/backend
cp .env.example .env    # Edit with your credentials
npm install
npm run dev             # Starts on http://localhost:4000
```

### 2. Frontend

```bash
cd whatsapp-excel-dispatcher/frontend
npm install
npm run dev             # Starts on http://localhost:5173
```

### 3. Configure WhatsApp

1. Set `META_WA_PHONE_NUMBER_ID` and `META_WA_ACCESS_TOKEN` in `backend/.env`
2. Configure your Meta webhook URL to point to `https://your-domain/api/webhooks/whatsapp`
3. Set `META_WA_WEBHOOK_VERIFY_TOKEN` to match your Meta webhook configuration

## Project Structure

```
whatsapp-excel-dispatcher/
├── frontend/           # React + Vite + Chakra UI
│   └── src/
│       ├── components/ # UI components (layout, upload, campaign, dashboard)
│       ├── pages/      # Route pages
│       ├── hooks/      # TanStack Query hooks
│       ├── services/   # API client
│       └── types/      # TypeScript interfaces
│
└── backend/            # Node.js + Express + TypeScript
    └── src/
        ├── config/     # DB, Agenda, environment
        ├── models/     # Mongoose schemas
        ├── routes/     # Express route handlers
        ├── services/   # Business logic
        ├── jobs/       # Agenda + cron job definitions
        ├── auth/       # JWT + password utilities
        └── middleware/  # Auth, upload, error handling
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/templates/presets | Built-in festival/event presets |
| GET | /api/templates | List saved templates |
| POST | /api/templates | Create a template (optionally from `presetKey`) |
| PATCH | /api/templates/:id | Update a template |
| DELETE | /api/templates/:id | Delete a template |
| POST | /api/templates/preview | Render a message body with sample values |
| POST | /api/campaigns/manual | Create a campaign from form input (no Excel) |
| POST | /api/campaigns/manual/preview | Validate + render form recipients without saving |
| POST | /api/campaigns/:id/recipients | Add people to a form-built campaign |
| DELETE | /api/campaigns/:id/recipients/:rid | Remove a recipient not yet sent to |
| POST | /api/campaigns/upload | Upload master Excel |
| POST | /api/campaigns/:id/validate | Validate with column mapping |
| POST | /api/campaigns/:id/start | Generate files & schedule jobs |
| GET | /api/campaigns | List campaigns |
| GET | /api/campaigns/:id | Campaign details |
| DELETE | /api/campaigns/:id | Cancel campaign |
| GET | /api/campaigns/:id/recipients | Paginated recipient list |
| POST | /api/campaigns/:id/recipients/:rid/retry | Retry failed delivery |
| GET/POST | /api/webhooks/whatsapp | Meta webhook endpoint |
| GET | /api/dashboard/stats | Dashboard statistics |
| GET | /api/settings | Configuration status |
| POST | /api/settings/test-whatsapp | Test API connection |
