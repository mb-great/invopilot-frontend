import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Only pick the keys we care about
    const notification_preferences = {
      promotional: !!body.promotional,
      dues: !!body.dues,
      recurring: !!body.recurring
    };

    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences })
      .eq('id', user.id);

    if (error) {
      logger.error('notifications_api', 'update_failed', { user_id: user.id, err: error.message });
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    logger.info('notifications_api', 'updated', { user_id: user.id });
    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error('Error in notifications route:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
