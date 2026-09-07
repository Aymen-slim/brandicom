-- ============================================================================
-- Brandicom Agency CRM — Performance Indexes
-- Run in the Supabase SQL Editor. Idempotent: safe to run multiple times.
-- ============================================================================

-- Deliverables indexes (high-frequency calendar, client detail, and dashboard queries)
CREATE INDEX IF NOT EXISTS idx_deliverables_client_id ON public.deliverables(client_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_publish_date ON public.deliverables(publish_date);
CREATE INDEX IF NOT EXISTS idx_deliverables_published ON public.deliverables(published);
CREATE INDEX IF NOT EXISTS idx_deliverables_published_date ON public.deliverables(published, publish_date);
CREATE INDEX IF NOT EXISTS idx_deliverables_created_by ON public.deliverables(created_by);

-- Creator assignments indexes
CREATE INDEX IF NOT EXISTS idx_creator_assignments_client_id ON public.creator_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_creator_id ON public.creator_assignments(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_deliverable_id ON public.creator_assignments(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_creator_assignments_scheduled_date ON public.creator_assignments(scheduled_date);

-- Messages indexes (chat and recent activity)
CREATE INDEX IF NOT EXISTS idx_messages_client_created ON public.messages(client_id, created_at DESC);

-- Finance indexes (invoices, payments, expenses)
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- Client assignments & contracts
CREATE INDEX IF NOT EXISTS idx_client_assignments_user_client ON public.client_assignments(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_client_type ON public.client_contracts(client_id, contract_type);

-- Client health snapshots (for cockpit at-risk list and detail page)
CREATE INDEX IF NOT EXISTS idx_client_health_snapshots_client ON public.client_health_snapshots(client_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_health_snapshots_risk ON public.client_health_snapshots(risk, score);

-- Goals index
CREATE INDEX IF NOT EXISTS idx_goals_period_metric ON public.goals(period_value, metric);
