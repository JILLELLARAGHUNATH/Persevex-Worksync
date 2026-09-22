-- Enable Row Level Security (RLS) on public tables: CompanyCalendar, SalaryRecord, PayrollRecord
-- Remediation for Supabase Security Advisor findings.
-- Application access is strictly mediated by server-side Prisma (Node.js backend role),
-- so no public/anonymous PostgREST policies are created.

ALTER TABLE public."CompanyCalendar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SalaryRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PayrollRecord" ENABLE ROW LEVEL SECURITY;
