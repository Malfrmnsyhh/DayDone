-- Aktifkan Row Level Security (RLS) pada semua tabel
-- Tanpa policy, akses langsung lewat Supabase PostgREST (anon key) diblokir sepenuhnya.
-- Prisma tetap dapat mengakses data karena terhubung sebagai role postgres (superuser/table owner).

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
