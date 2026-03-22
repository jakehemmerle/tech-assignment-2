import { Chip } from '@mui/material';

const TIER_COLORS: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: '#FFD700',
  Platinum: '#E5E4E2',
};

interface TierBadgeProps {
  tier: string;
  size?: 'small' | 'medium';
}

export default function TierBadge({ tier, size = 'medium' }: TierBadgeProps) {
  return (
    <Chip
      label={tier}
      size={size}
      sx={{
        bgcolor: TIER_COLORS[tier] || '#666',
        color: tier === 'Gold' || tier === 'Bronze' ? '#000' : '#fff',
        fontWeight: 700,
        fontSize: size === 'medium' ? '0.9rem' : '0.75rem',
      }}
    />
  );
}
