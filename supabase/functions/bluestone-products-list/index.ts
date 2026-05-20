import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BLUESTONE_API_URL = 'https://api.bluestonepim.com/v1';
const API_KEY = '925773a81f624f82886085a6e4d7d1be';

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const products = await fetchProductsList();

    return new Response(
      JSON.stringify(products),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});