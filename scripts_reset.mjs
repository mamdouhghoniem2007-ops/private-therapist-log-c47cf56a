import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const map = {
  'r3aya.chnnel@gmail.com': 'R3ayaAdmin2026',
  'salmasennara@gmail.com': 'Salma@2026',
  'ayayounis576@gmail.com': 'Aya@2026',
  'ba700894@gmail.com': 'Basant@2026',
  'doniakhalil330@gmail.com': 'Donia@2026',
  'perfectmind58@gmail.com': 'Mamdouh@2026',
};
const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 200 });
for (const [email, pw] of Object.entries(map)) {
  const u = users.find(x => x.email?.toLowerCase() === email);
  if (!u) { console.log('NOT FOUND', email); continue; }
  const { error } = await sb.auth.admin.updateUserById(u.id, { password: pw });
  console.log(email, error ? 'ERR '+error.message : 'OK');
}
