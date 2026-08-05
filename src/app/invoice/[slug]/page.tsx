import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyInvoiceSingularRedirect({ params }: Props) {
  const { slug } = await params;
  redirect(`/i/${encodeURIComponent(slug)}?src=legacy`);
}
