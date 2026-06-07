'use server';

import { createClient } from '@/lib/supabase/server';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { revalidatePath } from 'next/cache';

export async function getRecurringTemplates() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    throw new Error('Failed to fetch recurring templates');
  }

  return data;
}

export async function saveRecurringTemplate(templateData: {
  nickname: string;
  form_data: any;
  frequency: string;
  reminder_date: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  // Check caps
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single();

  const access = resolvePlanAccess({
    role: profile?.role,
    tier: profile?.tier,
    subscription_status: profile?.subscription_status,
    subscription_period_end: profile?.subscription_period_end,
  });

  if (!access.plan.canUseRecurring && !access.isAdmin) {
    throw new Error('Please upgrade to Pro or Business to use recurring templates');
  }

  // Enforce caps: Pro (20), Business (Unlimited)
  const maxTemplates = access.effectiveTier === 'pro' ? 20 : (access.effectiveTier === 'business' || access.isAdmin ? Infinity : 0);

  if (maxTemplates !== Infinity) {
    const { count } = await supabase
      .from('recurring_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (count !== null && count >= maxTemplates) {
      throw new Error(`You have reached the maximum limit of ${maxTemplates} recurring templates for your tier.`);
    }
  }

  const { data, error } = await supabase
    .from('recurring_templates')
    .insert([{
      user_id: user.id,
      nickname: templateData.nickname,
      form_data: templateData.form_data,
      frequency: templateData.frequency,
      reminder_date: templateData.reminder_date,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error saving template:', error);
    throw new Error('Failed to save recurring template');
  }

  revalidatePath('/dashboard/recurring');
  return data;
}

export async function deleteRecurringTemplate(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('recurring_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting template:', error);
    throw new Error('Failed to delete template');
  }

  revalidatePath('/dashboard/recurring');
}
