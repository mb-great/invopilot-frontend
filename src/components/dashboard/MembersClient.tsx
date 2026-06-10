'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, UserMinus, Shield, ShieldAlert, Mail, Trash2, Clock, CheckCircle2, User, FileText } from 'lucide-react';
import Image from 'next/image';
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
}

export default function MembersClient({ workspaceId, workspaceName, userRole, members, recentInvoices }: Props) {
  const router = useRouter();
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canManage = userRole === 'owner' || userRole === 'admin';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setIsInviting(true);
      const res = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, email: inviteEmail, role: inviteRole }),
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
          <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm">
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
              <div className="w-full sm:w-40">
                <label className="block text-sm font-semibold text-ink-700 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-11 px-4 bg-ink-50 border border-ink-200 rounded-xl focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm font-medium"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
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
          </div>
        )}

        <div className="glass-card p-6 bg-white border border-ink-100 rounded-3xl shadow-sm">
          <h3 className="font-bold text-ink-900 mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-500" />
            Current Members
          </h3>
          <div className="space-y-4">
            {members.map((member) => {
              const name = member.profiles?.full_name || 'Unknown User';
              const email = member.profiles?.email || member.invited_email;
              const avatar = member.profiles?.avatar_url;
              const isPending = member.status === 'pending';
              const isOwner = member.role === 'owner';

              return (
                <div key={member.id} className="flex items-center justify-between p-4 rounded-2xl border border-ink-100 hover:border-ink-200 transition-colors bg-ink-50/50 group">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {avatar ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                          <Image src={avatar} alt={name} width={48} height={48} className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <User className="w-5 h-5 text-brand-600" />
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-100 rounded-full border-2 border-white flex items-center justify-center shadow-sm" title="Pending Invite">
                          <Clock className="w-3 h-3 text-amber-600" />
                        </div>
                      )}
                      {!isPending && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-100 rounded-full border-2 border-white flex items-center justify-center shadow-sm" title="Active">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-ink-900 flex items-center gap-2">
                        {isPending ? member.invited_email : name}
                        {isOwner && (
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-brand-100 text-brand-700 rounded-md">Owner</span>
                        )}
                        {!isOwner && (
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 bg-ink-200 text-ink-700 rounded-md">{member.role}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-ink-500 mt-0.5">
                        {isPending ? 'Pending Invitation' : email}
                      </div>
                    </div>
                  </div>

                  {canManage && !isOwner && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removingId === member.id}
                      className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title={isPending ? "Cancel Invite" : "Remove Member"}
                    >
                      {removingId === member.id ? <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : (
                        isPending ? <Trash2 className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
                        <Image src={creatorAvatar} alt={creatorName} width={32} height={32} className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-4 h-4 text-ink-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900 leading-tight">
                        <span className="font-bold">{creatorName}</span> created invoice{' '}
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
