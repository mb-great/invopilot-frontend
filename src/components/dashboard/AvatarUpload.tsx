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

  const [confirmDelete, setConfirmDelete] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return parts[0].charAt(0).toUpperCase();
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_DIM = 400;
          if (width > height && width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get canvas context'));
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Compression failed'));
          }, 'image/webp', 0.8);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const compressedBlob = await compressImage(file);
      const fileExt = 'webp';
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedBlob, { contentType: 'image/webp' });

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

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000); // reset after 3 seconds
      return;
    }

    try {
      setUploading(true);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;
      setUrl(null);
      setConfirmDelete(false);
      toast.success('Profile picture removed successfully');
    } catch (error) {
      toast.error('Failed to remove profile picture');
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
            <img src={url} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
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
        <p className="text-xs text-ink-500 mt-1 max-w-xs leading-relaxed">
          PNG, JPG or WEBP. Image will be compressed before upload to save space.
        </p>
        {uploading ? (
          <p className="text-xs text-brand-500 mt-3 animate-pulse font-bold uppercase tracking-widest">Processing...</p>
        ) : url ? (
          <button
            onClick={handleDelete}
            className={`mt-3 text-xs font-bold transition-colors ${confirmDelete ? 'text-red-600 bg-red-50 px-2 py-1 rounded-md' : 'text-red-500 hover:text-red-600'}`}
          >
            {confirmDelete ? 'Are you sure? Click again' : 'Delete Picture'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
