import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s — InvoPilot Free Tools',
    default: 'Free Tools — InvoPilot',
  },
  description: 'Free business tools for Indian freelancers, agencies and MSMEs by InvoPilot.',
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
