interface UserAvatarProps {
  email?: string | null;
  fullName?: string | null;
  compact?: boolean;
}

const getInitials = (fullName?: string | null, email?: string | null) => {
  const trimmedName = (fullName || '').trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
    if (initials) return initials;
  }

  const localPart = (email || '').split('@')[0]?.trim() || '';
  if (!localPart) return 'US';

  return localPart
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || localPart.slice(0, 2).toUpperCase();
};

export function UserAvatar({ email, fullName, compact = false }: UserAvatarProps) {
  const initials = getInitials(fullName, email);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700 ${
        compact ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'
      }`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
