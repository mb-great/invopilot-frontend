'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function AvatarUpload({ 
  initialUrl, 
  userId, 
  userName 
}: { 
  initialUrl?: string | null, 
  userId: string, 
  userName?: string 
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setUrl(publicUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      toast.error('Error uploading avatar: ' + message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-6 mb-10">
      <div className="relative group">
        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-brand-500 border border-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white uppercase tracking-tighter">{getInitials(userName)}</span>
          )}
        </div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
          <label htmlFor="avatar-input" className="cursor-pointer text-xs font-bold text-white w-full h-full flex items-center justify-center">
            CHANGE
            <input 
              id="avatar-input"
              type="file" 
              className="hidden" 
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>
      <div>
        <h4 className="font-bold text-ink-900">Profile Picture</h4>
        <p className="text-xs text-ink-500 mt-1">PNG, JPG or WEBP. Max 2MB.</p>
        {uploading && <p className="text-xs text-brand-500 mt-2 animate-pulse font-bold uppercase tracking-widest">Uploading...</p>}
      </div>
    </div>
  );
}
