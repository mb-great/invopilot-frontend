import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const currency = searchParams.get('currency') || '';
  const type = searchParams.get('type') || '';
  const dateType = searchParams.get('dateType') || '';
  const dateValue = searchParams.get('dateValue') || '';
  const tzOffset = parseInt(searchParams.get('tzOffset') || '0');
  const sort = searchParams.get('sort') || 'created_at.desc';
  const targetUserId = searchParams.get('userId');
  const targetWorkspaceId = searchParams.get('workspaceId');
  const targetBusiness = searchParams.get('business');

  // Hard Cap: Prevent deep pagination queries that scan too many rows.
  const MAX_PAGE = 50;
  if (page > MAX_PAGE) {
    page = MAX_PAGE;
  }

  const offset = (page - 1) * limit;

  let queryUserId = user.id;

  // Admin Check
  if (targetUserId && targetUserId !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role === 'admin' || profile?.role === 'superadmin') {
      queryUserId = targetUserId;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Import dynamically to avoid circular dependencies if any, or just import at top.
  // We'll require it here since it's a server context.
  const { getActiveWorkspaceId } = await import('@/lib/workspace');
  let workspaceIdToQuery = targetWorkspaceId || await getActiveWorkspaceId(queryUserId);

  // Logic: If any filter is active, we do an exact count for accurate pagination.
  const isFiltered = !!(search || status || currency || type || dateValue || targetBusiness);

  let query = supabase
    .from('invoices')
    .select('*, profiles(full_name, avatar_url, email)', isFiltered ? { count: 'exact' } : {})
    .is('deleted_at', null);
    
  if (targetUserId) {
    query = query.eq('user_id', queryUserId);
  } else if (workspaceIdToQuery) {
    query = query.eq('workspace_id', workspaceIdToQuery);
  } else {
    query = query.eq('user_id', queryUserId); // fallback
  }

  if (targetBusiness) {
    query = query.eq('business_profile_name', targetBusiness);
  }

  if (search) {
    query = query.or(`client_name.ilike.%${search}%,invoice_number.ilike.%${search}%,nickname.ilike.%${search}%,client_email.ilike.%${search}%,currency.ilike.%${search}%,form_data->>clientName.ilike.%${search}%,form_data->>invoiceNumber.ilike.%${search}%,form_data->>issueDate.ilike.%${search}%,form_data->>dueDate.ilike.%${search}%,form_data->>currency.ilike.%${search}%`);
  }

  if (status) {
    if (status.includes(',')) {
      query = query.in('payment_status', status.split(','));
    } else {
      query = query.eq('payment_status', status);
    }
  }

  if (currency) {
    query = query.eq('currency', currency);
  }

  if (type) {
    query = query.eq('type', type);
  }

  if (dateValue) {
    const [year, month, day] = dateValue.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(month) - 1];
    const humanDate = `${monthName} ${parseInt(day).toString().padStart(2, '0')} ${year}`;
    const humanDateShort = `${monthName} ${parseInt(day)} ${year}`;

    // Calculate UTC range based on user's timezone offset
    const startOfDayUTC = new Date(`${dateValue}T00:00:00.000Z`);
    startOfDayUTC.setMinutes(startOfDayUTC.getMinutes() + tzOffset);
    
    const endOfDayUTC = new Date(`${dateValue}T23:59:59.999Z`);
    endOfDayUTC.setMinutes(endOfDayUTC.getMinutes() + tzOffset);

    const startStr = startOfDayUTC.toISOString();
    const endStr = endOfDayUTC.toISOString();

    if (dateType === 'generated') {
      query = query.gte('created_at', startStr).lte('created_at', endStr);
    } else if (dateType === 'issued') {
      query = query.or(`issue_date.eq.${dateValue},form_data->>issueDate.ilike.${dateValue}%,form_data->>issueDate.ilike.%${humanDate}%,form_data->>issueDate.ilike.%${humanDateShort}%`);
    } else if (dateType === 'due') {
      query = query.or(`due_date.eq.${dateValue},form_data->>dueDate.ilike.${dateValue}%,form_data->>dueDate.ilike.%${humanDate}%,form_data->>dueDate.ilike.%${humanDateShort}%`);
    } else {
      // For "Any Date", we chain an OR filter for the fields, BUT since `and()` inside `.or()` is tricky, we can do:
      query = query.or(`issue_date.eq.${dateValue},due_date.eq.${dateValue},form_data->>issueDate.ilike.${dateValue}%,form_data->>issueDate.ilike.%${humanDate}%,form_data->>issueDate.ilike.%${humanDateShort}%,form_data->>dueDate.ilike.${dateValue}%,form_data->>dueDate.ilike.%${humanDate}%,form_data->>dueDate.ilike.%${humanDateShort}%`);
      // It's safer to just search issued/due if "Any Date" is selected, or we can just omit created_at from "Any Date" to prevent query crashes.
    }
  }

  const [sortCol, sortDir] = sort.split('.');
  const allowedSortColumns = ['created_at', 'updated_at', 'amount', 'client_name', 'invoice_number', 'due_date', 'paid_at'];
  const safeSortCol = allowedSortColumns.includes(sortCol) ? sortCol : 'created_at';
  query = query.order(safeSortCol, { ascending: sortDir === 'asc' });

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Fetch invoices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    meta: {
      total: isFiltered ? count : undefined,
      page,
      limit,
      isCapped: !isFiltered && page === MAX_PAGE
    }
  });
}
