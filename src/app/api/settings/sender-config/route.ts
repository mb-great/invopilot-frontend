import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_sender_config')
      .select('method, gmail_email, smtp_host, smtp_port, smtp_user')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || { method: 'system' } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { method, smtp_host, smtp_port, smtp_user, smtp_pass } = body;

    if (!method || !['system', 'gmail', 'smtp'].includes(method)) {
      return NextResponse.json({ error: 'Invalid method' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      method,
      updated_at: new Date().toISOString(),
    };

    if (method === 'smtp') {
      updatePayload.smtp_host = smtp_host || null;
      updatePayload.smtp_port = smtp_port || null;
      updatePayload.smtp_user = smtp_user || null;
      if (smtp_pass) updatePayload.smtp_pass = smtp_pass;
    } else if (method === 'system') {
      updatePayload.smtp_host = null;
      updatePayload.smtp_port = null;
      updatePayload.smtp_user = null;
      updatePayload.smtp_pass = null;
      updatePayload.gmail_access_token = null;
      updatePayload.gmail_refresh_token = null;
      updatePayload.gmail_email = null;
    }

    const { error } = await supabase
      .from('user_sender_config')
      .upsert(
        { user_id: user.id, ...updatePayload },
        { onConflict: 'user_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('user_sender_config')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
