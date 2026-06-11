import { NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { createServerClient } from '@supabase/ssr';

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bearer',
    },
  });
}

export async function GET(req: Request) {
  const auth = await verifyApiKey();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: { get() { return ''; }, set() {}, remove() {} }
  });

  const { data, error, count } = await supabaseAdmin
    .from('clients')
    .select('id, name, email, address, tax_id, created_at', { count: 'exact' })
    .eq('workspace_id', auth.workspaceId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    meta: {
      total: count,
      page,
      limit
    }
  });
}

export async function POST(req: Request) {
  const auth = await verifyApiKey();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { get() { return ''; }, set() {}, remove() {} }
    });

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({
        workspace_id: auth.workspaceId,
        name: body.name,
        email: body.email,
        address: body.address || null,
        tax_id: body.tax_id || null,
      })
      .select('id, name, email, address, tax_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
