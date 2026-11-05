import { useState } from 'react';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
  sizeClassName?: string;
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (name.trim()[0] || '?').toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  className = '',
  sizeClassName = 'h-8 w-8 text-xs',
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  if (avatarUrl && !imageError) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Avatar pengguna'}
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
        className={`${sizeClassName} rounded-full border border-slate-200 object-cover ${className}`}
      />
    );
  }

  const initials = getInitials(name);

  return (
    <div
      aria-label={name || 'Avatar pengguna'}
      className={`${sizeClassName} flex items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 select-none ${className}`}
    >
      {initials}
    </div>
  );
}
