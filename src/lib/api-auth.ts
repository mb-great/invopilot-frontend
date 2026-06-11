import { headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { resolvePlanAccess } from './billing/tiers';

export async function verifyApiKey() {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return { error: 'Missing token', status: 401 };
  }

  // Hash the token to look it up securely
  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      get() { return ''; },
      set() {},
      remove() {}
    }
  });

  const { data: apiKeyData, error: keyError } = await supabaseAdmin
    .from('api_keys')
    .select('workspace_id, user_id, workspaces(businesses, profiles!workspaces_owner_id_fkey(role, tier, subscription_status, subscription_period_end))')
    .eq('key_hash', keyHash)
    .single();

  if (keyError || !apiKeyData) {
    return { error: 'Invalid API key', status: 401 };
  }

  // Update last used
  await supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash);

  const workspace = apiKeyData.workspaces as any;
  const profile = workspace?.profiles;

  const access = resolvePlanAccess(profile);
  
  if (access.effectiveTier !== 'business' && !access.isAdmin) {
    return { error: 'API access requires the Business plan.', status: 402 };
  }

  return {
    workspaceId: apiKeyData.workspace_id,
    userId: apiKeyData.user_id,
    businesses: workspace?.businesses || [],
    profile
  };
}
