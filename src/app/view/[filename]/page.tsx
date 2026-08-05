import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ filename: string }>;
};

export default async function LegacyViewRedirect({ params }: Props) {
  const { filename } = await params;
  redirect(`/i/${encodeURIComponent(filename)}?src=legacy`);
}
