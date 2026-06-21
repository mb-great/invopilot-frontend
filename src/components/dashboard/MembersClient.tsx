'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserPlus, UserMinus, Shield, ShieldAlert, Mail, Trash2, Clock, CheckCircle2, User, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface Member {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  role: string;
  status: string;
  created_at?: string;
  profiles: Profile | null;
}

interface InvoiceActivity {
  id: string;
  invoice_number: string;
  nickname: string | null;
  created_at: string;
  amount: number | null;
  currency: string | null;
  profiles: Profile | null;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
  userRole: string;
  members: Member[];
  recentInvoices: InvoiceActivity[];
  isBusinessTier: boolean;
}

export default function MembersClient({ workspaceId, workspaceName, userRole, members, recentInvoices, isBusinessTier }: Props) {
  const router = useRouter();
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const canManage = userRole === 'owner' || userRole === 'admin';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setIsInviting(true);
      const res = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, email: inviteEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invite');
      }

      toast.success('Invite sent successfully!');
      setInviteEmail('');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsInviting(false);
    }
  }

  async function handleResend(email: string | null) {
    if (!email) return;
    try {
      setResendingId(email);
      const res = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend invite');
      toast.success('Invite resent successfully!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setResendingId(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      setRemovingId(memberId);
      const res = await fetch(`/api/workspaces/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove member');
      }

      toast.success('Member removed');
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Manage Team */}
      <div className="lg:col-span-2 space-y-8">
        
        {canManage && (
          <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm relative overflow-hidden">
            {!isBusinessTier ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 justify-between text-center sm:text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-ink-900 mb-1">Team Collaboration is a Business feature</h3>
                      <p className="text-sm text-ink-500">Upgrade to the Business plan to invite team members and assign roles.</p>
                    </div>
                  </div>
                  <Link 
                    href="/pricing"
                    className="shrink-0 h-11 px-6 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors flex items-center justify-center"
                  >
                    Upgrade to Business
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-ink-900 mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-500" />
                  Invite New Member
                </h3>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-semibold text-ink-700 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full h-11 px-4 bg-ink-50 border border-ink-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm font-medium"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail}
                    className="w-full sm:w-auto h-11 px-6 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-colors disabled:opacity-50"
                  >
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </form>
                <p className="text-xs text-ink-500 mt-4">
                  Invited users will see a prompt to join this workspace the next time they log in to InvoPilot.
                </p>
              </>
            )}
          </div>
        )}

        {/* Active Members */}
        <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm">
          <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            Active Members
          </h3>
          <div className="space-y-4">
            {members.filter(m => m.status === 'accepted').map((member) => {
              const name = member.profiles?.full_name || 'Unknown User';
              const email = member.profiles?.email || member.invited_email;
              const avatar = member.profiles?.avatar_url;
              const isOwner = member.role === 'owner';

              return (
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-ink-100 hover:border-ink-200 transition-colors bg-ink-50/50 group gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {avatar ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                          <img src={avatar} alt={name} referrerPolicy="no-referrer" width={48} height={48} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <User className="w-5 h-5 text-brand-600" />
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-100 rounded-full border-2 border-white flex items-center justify-center shadow-sm" title="Active">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-ink-900 flex items-center gap-2">
                        {name}
                        {isOwner && (
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-brand-100 text-brand-700 rounded-md">Owner</span>
                        )}
                        {!isOwner && (
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-ink-200 text-ink-700 rounded-md">{member.role}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-ink-500 mt-0.5">
                        {email}
                      </div>
                    </div>
                  </div>

                  {canManage && !isOwner && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removingId === member.id}
                      className="p-2 text-ink-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                      title="Remove Member"
                    >
                      {removingId === member.id ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : (
                        <>
                          <UserMinus className="w-5 h-5" />
                          <span className="text-sm font-semibold">Remove</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            {members.filter(m => m.status === 'accepted').length === 0 && (
              <p className="text-sm text-ink-500 text-center py-4">No active members found.</p>
            )}
          </div>
        </div>

        {/* Pending Invites */}
        {members.some(m => m.status === 'pending') && (
          <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm mt-8">
            <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Invites
            </h3>
            <div className="space-y-4">
              {members.filter(m => m.status === 'pending').map((member) => {
                const email = member.invited_email;
                const createdDate = member.created_at ? new Date(member.created_at) : new Date();
                const isExpired = (new Date().getTime() - createdDate.getTime()) > 7 * 24 * 60 * 60 * 1000;

                return (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-ink-100 bg-amber-50/30 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-amber-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <Mail className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-100 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                          <Clock className="w-3 h-3 text-amber-600" />
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-ink-900 flex items-center gap-2">
                          {email}
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-ink-200 text-ink-700 rounded-md">{member.role}</span>
                          {isExpired && (
                            <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">Expired</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-ink-500 mt-0.5">
                          Invited {formatDistanceToNow(createdDate, { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => handleResend(email)}
                          disabled={resendingId === email}
                          className="px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 border border-brand-100"
                        >
                          {resendingId === email ? 'Sending...' : 'Resend'}
                        </button>
                        <button
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                          className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 border border-red-100"
                        >
                          {removingId === member.id ? 'Canceling...' : 'Cancel'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Team Activity */}
      <div className="lg:col-span-1">
        <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm sticky top-8">
          <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-500" />
            Recent Activity
          </h3>
          {recentInvoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-ink-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-ink-500">No invoices created yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {recentInvoices.map((inv) => {
                const creatorName = inv.profiles?.full_name || 'Unknown';
                const creatorAvatar = inv.profiles?.avatar_url;
                
                return (
                  <div key={inv.id} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-ink-100 bg-ink-50">
                      {creatorAvatar ? (
                        <img src={creatorAvatar} alt={creatorName} referrerPolicy="no-referrer" width={32} height={32} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-ink-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 leading-tight">
                        <span className="font-bold">{creatorName}</span>
                        {inv.profiles?.email && !inv.profiles.email.includes('+deleted') && (
                          <span className="text-xs font-normal text-ink-400 ml-1 truncate inline-block max-w-[180px]">
                            ({inv.profiles.email})
                          </span>
                        )}
                        {' '}created invoice{' '}
                        <span className="text-brand-600 font-bold">{inv.invoice_number}</span>
                      </p>
                      {inv.amount && (
                        <p className="text-xs text-ink-500 mt-1">
                          {inv.currency} {inv.amount.toLocaleString()}
                        </p>
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1.5">
                        {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
