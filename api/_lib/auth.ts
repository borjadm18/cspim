import { createClient } from '@supabase/supabase-js';

interface AuthContext {
  userId: string;
}

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns the auth context if valid, or writes a 401 response and returns null.
 * If SUPABASE_URL/SUPABASE_ANON_KEY are not configured, logs a warning and passes through.
 */
export async function requireAuth(req: any, res: any): Promise<AuthContext | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[auth] SUPABASE_URL or SUPABASE_ANON_KEY not set — authentication not enforced');
    return { userId: 'unauthenticated-dev' };
  }

  const authHeader: string | undefined =
    typeof req.headers?.get === 'function'
      ? req.headers.get('authorization')
      : req.headers?.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return null;
    }

    return { userId: data.user.id };
  } catch {
    res.status(401).json({ error: 'Authentication check failed' });
    return null;
  }
}
