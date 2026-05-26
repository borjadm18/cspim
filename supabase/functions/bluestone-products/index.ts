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

function mapBluestoneProduct(product: any) {
  const images = [];

  if (product.media && Array.isArray(product.media)) {
    images.push(...product.media
      .filter((item: any) => item.contentType?.startsWith('image/'))
      .map((img: any) => ({
        id: img.id,
        url: img.downloadUri || img.previewUri || img.url || img.path || img.src || img.link,
        alt: img.name || img.fileName || img.alt || img.title || product.name,
        isPrimary: false
      })));
  }

  if (product.media?.images && Array.isArray(product.media.images)) {
    images.push(...product.media.images.map((img: any) => ({
      id: img.id,
      url: img.url || img.path || img.src || img.link,
      alt: img.alt || img.name || img.title || product.name,
      isPrimary: img.isPrimary || img.is_primary || img.primary || false
    })));
  }

  if (product.images && Array.isArray(product.images)) {
    images.push(...product.images.map((img: any) => ({
      id: img.id,
      url: img.url || img.path || img.src || img.link,
      alt: img.alt || img.name || img.title || product.name,
      isPrimary: img.isPrimary || img.is_primary || img.primary || false
    })));
  }

  if (product.image_url || product.imageUrl || product.thumbnail) {
    images.push({
      url: product.image_url || product.imageUrl || product.thumbnail,
      alt: product.name,
      isPrimary: true
    });
  }

  if (images.length > 0) {
    images[0].isPrimary = true;
  }

  const attributes = [];
  if (product.attributes) {
    if (Array.isArray(product.attributes)) {
      attributes.push(...product.attributes.map((attr: any) => ({
        name: attr.name || attr.key || attr.attribute,
        label: attr.label || attr.display_name || attr.name,
        value: attr.value || attr.values
      })));
    } else if (typeof product.attributes === 'object') {
      for (const [key, value] of Object.entries(product.attributes)) {
        attributes.push({
          name: key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: value
        });
      }
    }
  }

  if (product.properties && typeof product.properties === 'object') {
    for (const [key, value] of Object.entries(product.properties)) {
      attributes.push({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value
      });
    }
  }

  if (product.specifications && typeof product.specifications === 'object') {
    for (const [key, value] of Object.entries(product.specifications)) {
      attributes.push({
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: value
      });
    }
  }

  if (product.specs && Array.isArray(product.specs)) {
    attributes.push(...product.specs.map((spec: any) => ({
      name: spec.name || spec.key,
      label: spec.label || spec.name,
      value: spec.value
    })));
  }

  const attachments = [];
  if (product.attachments && Array.isArray(product.attachments)) {
    attachments.push(...product.attachments.map((att: any) => ({
      id: att.id,
      name: att.name || att.filename || att.title || 'Archivo',
      url: att.url || att.path || att.link,
      type: att.type || att.mime_type || att.mimeType || att.file_type,
      size: att.size || att.file_size
    })));
  }

  if (product.media?.documents && Array.isArray(product.media.documents)) {
    attachments.push(...product.media.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name || doc.filename || doc.title || 'Documento',
      url: doc.url || doc.path || doc.link,
      type: doc.type || doc.mime_type || doc.mimeType || doc.file_type,
      size: doc.size || doc.file_size
    })));
  }

  if (product.files && Array.isArray(product.files)) {
    attachments.push(...product.files.map((file: any) => ({
      id: file.id,
      name: file.name || file.filename || file.title || 'Archivo',
      url: file.url || file.path || file.link,
      type: file.type || file.mime_type || file.mimeType,
      size: file.size || file.file_size
    })));
  }

  if (product.documents && Array.isArray(product.documents)) {
    attachments.push(...product.documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name || doc.filename || doc.title || 'Documento',
      url: doc.url || doc.path || doc.link,
      type: doc.type || doc.mime_type || doc.mimeType,
      size: doc.size || doc.file_size
    })));
  }

  return {
    id: product.id || product.sku || product.code || product.product_id,
    name: product.name || product.title || product.product_name || 'Producto sin nombre',
    description: product.description || product.desc || product.long_description || product.summary,
    sku: product.sku || product.code || product.product_code,
    price: product.price || product.base_price || product.retail_price || product.sale_price || product.selling_price,
    currency: product.currency || product.currency_code || '$',
    images: images.length > 0 ? images : undefined,
    attributes: attributes.length > 0 ? attributes : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    category: product.category?.name || product.category_name || product.category,
    brand: product.brand?.name || product.brand_name || product.brand || product.manufacturer,
    stock: product.stock !== undefined ? product.stock : product.quantity !== undefined ? product.quantity : product.available_quantity,
    variants: product.variants,
    relations: product.relations,
    metadata: product.metadata,
    tags: product.tags,
    weight: product.weight,
    dimensions: product.dimensions,
    barcode: product.barcode || product.ean || product.upc,
    ...product
  };
}

async function fetchProducts() {
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
      allProducts.push(...data.results);
    }

    cursor = data.nextCursor;
  } while (cursor);

  return allProducts.map(mapBluestoneProduct);
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
    const products = await fetchProducts();
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