import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '';

function getCorsHeaders(origin: string | null) {
  const allowed = ALLOWED_ORIGIN || origin || '';
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

const BLUESTONE_API_URL = 'https://api.bluestonepim.com/v1';
const API_KEY = Deno.env.get('BLUESTONE_API_KEY') ?? '';

function extractEssentialData(product: any) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    type: product.type,
    number: product.number,
  };
}

async function fetchProductsList() {
  const allProducts = [];
  let cursor = null;

  do {
    const body = cursor ? { cursor, limit: 100 } : { limit: 100 };

    const response = await fetch(`${BLUESTONE_API_URL}/products/cursor/all`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Products error:', response.status, errorText);
      throw new Error(`Failed to fetch products: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && Array.isArray(data.results)) {
      allProducts.push(...data.results.map(extractEssentialData));
    }

    cursor = data.nextCursor;
  } while (cursor);

  return allProducts;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify Supabase JWT
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (supabaseUrl && supabaseAnonKey) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }
  }

  try {
    const products = await fetchProductsList();
    return new Response(JSON.stringify(products), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});