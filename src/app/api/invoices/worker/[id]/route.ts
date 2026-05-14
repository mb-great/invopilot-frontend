import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  // 1. Mark processing
  await supabase.from('invoices').update({ status: 'processing' }).eq('id', id);

  try {
    // PDF generation goes here (simulated for now)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate upload path
    const storagePath = `invoices/test/${id}.pdf`;

    // 2. Mark done
    await supabase.from('invoices').update({ status: 'done', pdf_url: storagePath }).eq('id', id);
  } catch (error) {
    await supabase.from('invoices').update({ status: 'failed', error_msg: String(error) }).eq('id', id);
  }

  return NextResponse.json({ success: true });
}
