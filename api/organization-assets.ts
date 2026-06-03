import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './_lib/auth.js';
import { checkRateLimit, getClientIp } from './_lib/rateLimit.js';

const corsHeaders = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;
const DEFAULT_BUCKET = process.env.CATALOG_BRANDING_BUCKET || 'catalog-branding';

const getCorsHeaders = (request: Request) => {
  const origin = request.headers.get('origin');
  if (!origin) return corsHeaders;

  const requestOrigin = new URL(request.url).origin;
  const allowList = (process.env.CATALOG_ALLOWED_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (origin === requestOrigin || allowList.includes('*') || allowList.includes(origin)) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
    };
  }

  return corsHeaders;
};

const sendJson = (statusCode: number, body: unknown, request: Request) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

const sanitizeSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getSupabaseAdmin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase server credentials for organization asset uploads');
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
};

const ensureBucket = async (bucketName: string) => {
  const admin = getSupabaseAdmin();
  const { data: existingBucket } = await admin.storage.getBucket(bucketName);
  if (existingBucket) {
    return admin;
  }

  const { error } = await admin.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: `${MAX_UPLOAD_SIZE_BYTES}`,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
  });

  if (error && !/already exists/i.test(error.message || '')) {
    throw error;
  }

  return admin;
};

export async function POST(request: Request) {
  let authResponse: Response | null = null;
  const fakeRes = {
    status: (code: number) => ({
      json: (body: unknown) => {
        authResponse = sendJson(code, body, request);
        return authResponse;
      },
    }),
  };

  const auth = await requireAuth(request, fakeRes);
  if (!auth) {
    return authResponse ?? sendJson(401, { error: 'Authentication required' }, request);
  }

  if (!checkRateLimit(`${getClientIp(request)}:org-assets`, 20, 60_000)) {
    return sendJson(429, { error: 'Too many requests' }, request);
  }

  try {
    const formData = await request.formData();
    const tenantId = sanitizeSegment(String(formData.get('tenantId') || 'default'));
    const kind = sanitizeSegment(String(formData.get('kind') || 'asset'));
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return sendJson(400, { error: 'Missing file upload' }, request);
    }

    if (!file.type.startsWith('image/')) {
      return sendJson(400, { error: 'Only image uploads are supported' }, request);
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return sendJson(413, { error: 'Image exceeds the 2 MB upload limit' }, request);
    }

    const extension = sanitizeSegment(file.name.split('.').pop() || 'bin') || 'bin';
    const fileName = `${Date.now()}-${sanitizeSegment(file.name.replace(/\.[^.]+$/, '')) || 'asset'}.${extension}`;
    const objectPath = `${tenantId}/${kind}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = await ensureBucket(DEFAULT_BUCKET);

    const { error: uploadError } = await admin.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = admin.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath);
    return sendJson(200, { url: data.publicUrl, path: objectPath, uploadedBy: auth.userId }, request);
  } catch (error) {
    console.error('[organization-assets] upload failed', error);
    return sendJson(500, { error: error instanceof Error ? error.message : 'Upload failed' }, request);
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
