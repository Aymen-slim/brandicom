# Brandicom Marketing Agency CRM

Internal CRM for a marketing agency: clients, content & engagement, partners, admin-only finance (TND), goals, and a Gemini assistant.

## Stack

- Next.js 14 (App Router)
- Supabase (PostgreSQL + Auth + RLS)
- Gemini (`@google/genai`) for the in-app assistant

## Setup

1. Create a Supabase project and copy URL, anon key, and service role key into `.env` (see `.env.example`).
2. Add `GEMINI_API_KEY` for the assistant (optional until you use Ask AI).
3. Run `supabase/schema.sql` in the Supabase SQL editor (idempotent).
4. `npm install && npm run db:seed && npm run dev`

Demo accounts:

| Role | Email | Password |
| :--- | :--- | :--- |
| Admin | admin@agency.com | admin123 |
| Member | sarah@agency.com | member123 |

## Roles

- **Admin**: sees money (contracts, invoices, payments, expenses, P&L, revenue/profit goals). Nav includes Finance.
- **Member**: sees assigned clients, content, engagement, partners. No fees, invoices, expenses, or profit.

## Features

- Client hub: contacts, socials, tenure, content pipeline, engagement snapshots, booked partners, chat, monthly AI report
- Partners: photographer, videographer, UGC, presenter, influencer, agency, editor, designer, model
- Finance (admin): invoices with 19% TVA, payments, expenses, P&L month/year, per-client profitability
- Goals: month/year targets vs live actuals (revenue = cash received)
- AI drawer (`⌘J`): asks about the current page/client; can **propose** writes you Confirm. Also: content ideas, client health scores, monthly reports
- Search (`⌘K`)

Currency is **Tunisian Dinar (TND)** with 3 decimal places.
