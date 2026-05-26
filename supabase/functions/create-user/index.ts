import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const ALLOWED_ROLES = ['admin', 'content_manager', 'comercial'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify the caller has a valid Supabase JWT and is admin/superadmin
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerToken = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!callerToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (supabaseAnonKey) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data: callerData, error: callerError } = await authClient.auth.getUser(callerToken);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
    }

    // Only superadmin and admin can create users
    const callerRole = callerData.user.app_metadata?.role ?? callerData.user.user_metadata?.role;
    if (callerRole !== 'superadmin' && callerRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { email, password, tenantId, role, fullName } = body;

  // Validate required fields
  if (!email || !password || !tenantId || !role) {
    return new Response(JSON.stringify({ error: 'Missing required fields: email, password, tenantId, role' }), { status: 400 });
  }

  // Validate role — superadmin cannot be assigned via this endpoint
  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return new Response(
      JSON.stringify({ error: `Invalid role. Allowed values: ${ALLOWED_ROLES.join(', ')}` }),
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    return new Response(JSON.stringify({ error: 'Unable to create user' }), { status: 400 });
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.user.id,
    tenant_id: tenantId,
    role: role as AllowedRole,
    full_name: fullName ?? null,
  });

  if (profileError) {
    return new Response(JSON.stringify({ error: 'User created but profile insert failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
