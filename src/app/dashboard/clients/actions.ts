'use server';

import { createClient } from '@/lib/supabase/server';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { revalidatePath } from 'next/cache';
import { getActiveWorkspaceId } from '@/lib/workspace';

export async function getClients() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const workspaceId = await getActiveWorkspaceId(user.id);

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching clients:', error);
    throw new Error('Failed to fetch clients');
  }

  return data;
}

export async function saveClient(clientData: {
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  address?: string | null;
  vat_gstin?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const workspaceId = await getActiveWorkspaceId(user.id);

  // Load active workspace owner profile to check plan access
  const { data: wsData } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single();
  const ownerId = wsData?.owner_id || user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tier, subscription_status, subscription_period_end')
    .eq('id', ownerId)
    .single();

  const access = resolvePlanAccess(profile);

  const maxClients = access.plan.maxClients === 'unlimited' ? Infinity : (access.plan.maxClients as number);



  if (maxClients !== Infinity) {
    const { count } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null);

    if (count !== null && count >= maxClients) {
      throw new Error(`Limit Reached: You have reached the maximum limit of ${maxClients} clients for the ${access.effectiveTier} plan.`);
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert([{
      user_id: user.id,
      workspace_id: workspaceId,
      name: clientData.name,
      email: clientData.email || null,
      phone: clientData.phone || null,
      company_name: clientData.company_name || null,
      address: clientData.address || null,
      vat_gstin: clientData.vat_gstin || null,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error saving client:', error);
    throw new Error('Failed to save client');
  }

  revalidatePath('/dashboard/clients');
  return data;
}

export async function updateClient(
  id: string,
  clientData: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    address?: string | null;
    vat_gstin?: string | null;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: clientData.name,
      email: clientData.email || null,
      phone: clientData.phone || null,
      company_name: clientData.company_name || null,
      address: clientData.address || null,
      vat_gstin: clientData.vat_gstin || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', await getActiveWorkspaceId(user.id))
    .select()
    .single();

  if (error) {
    console.error('Error updating client:', error);
    throw new Error('Failed to update client');
  }

  revalidatePath('/dashboard/clients');
  return data;
}

export async function deleteClient(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('clients')
    .update({
      deleted_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('workspace_id', await getActiveWorkspaceId(user.id));

  if (error) {
    console.error('Error soft-deleting client:', error);
    throw new Error('Failed to delete client');
  }

  revalidatePath('/dashboard/clients');
}

export async function dismissPotentialClient(clientEmailOrName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  // Fetch current profile defaults
  const { data: profile } = await supabase
    .from('profiles')
    .select('defaults')
    .eq('id', user.id)
    .single();

  const currentDefaults = profile?.defaults || {};
  const currentDismissed = currentDefaults.dismissed_clients || [];

  if (!currentDismissed.includes(clientEmailOrName)) {
    const updatedDefaults = {
      ...currentDefaults,
      dismissed_clients: [...currentDismissed, clientEmailOrName],
    };

    const { error } = await supabase
      .from('profiles')
      .update({ defaults: updatedDefaults })
      .eq('id', user.id);

    if (error) {
      console.error('Error dismissing potential client:', error);
      throw new Error('Failed to dismiss potential client');
    }
  }

  revalidatePath('/dashboard/clients');
}

export async function dismissClientUpdate(clientId: string, field: string, newVal: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('defaults')
    .eq('id', user.id)
    .single();

  const currentDefaults = profile?.defaults || {};
  const currentDismissed = currentDefaults.dismissed_updates || [];
  const key = `${clientId}:${field}:${newVal}`;

  if (!currentDismissed.includes(key)) {
    const updatedDefaults = {
      ...currentDefaults,
      dismissed_updates: [...currentDismissed, key],
    };

    const { error } = await supabase
      .from('profiles')
      .update({ defaults: updatedDefaults })
      .eq('id', user.id);

    if (error) {
      console.error('Error dismissing client update:', error);
      throw new Error('Failed to dismiss client update');
    }
  }

  revalidatePath('/dashboard/clients');
}

export async function dismissMultipleClientUpdates(
  mismatches: { clientId: string; field: string; newVal: string }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');
  if (mismatches.length === 0) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('defaults')
    .eq('id', user.id)
    .single();

  const currentDefaults = profile?.defaults || {};
  const currentDismissed = currentDefaults.dismissed_updates || [];
  
  let updated = false;
  const newDismissed = [...currentDismissed];
  mismatches.forEach(m => {
    const key = `${m.clientId}:${m.field}:${m.newVal}`;
    if (!newDismissed.includes(key)) {
      newDismissed.push(key);
      updated = true;
    }
  });

  if (updated) {
    const updatedDefaults = {
      ...currentDefaults,
      dismissed_updates: newDismissed,
    };

    const { error } = await supabase
      .from('profiles')
      .update({ defaults: updatedDefaults })
      .eq('id', user.id);

    if (error) {
      console.error('Error dismissing client updates:', error);
      throw new Error('Failed to dismiss client updates');
    }
  }

  revalidatePath('/dashboard/clients');
}
