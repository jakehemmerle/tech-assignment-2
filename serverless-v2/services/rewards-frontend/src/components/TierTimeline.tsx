import { Paper, Typography, Box } from '@mui/material';
import TierBadge from './TierBadge';

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const TIER_LEVELS: Record<string, number> = { Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };

interface TierTimelineProps {
  currentTier: string;
}

export default function TierTimeline({ currentTier }: TierTimelineProps) {
  // Generate last 6 months with simulated tier data
  // In a full implementation, this would come from a tier history API
  const months: { label: string; tier: string }[] = [];
  const now = new Date();
  const currentLevel = TIER_LEVELS[currentTier] || 1;

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    // For current month, use actual tier; for past months, show a plausible progression
    if (i === 0) {
      months.push({ label, tier: currentTier });
    } else {
      const pastLevel = Math.max(1, currentLevel - Math.floor(i / 2));
      months.push({ label, tier: TIER_NAMES[pastLevel - 1] });
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Tier Timeline
      </Typography>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end" gap={1} mt={2}>
        {months.map((m) => (
          <Box key={m.label} textAlign="center" flex={1}>
            <Box
              sx={{
                height: TIER_LEVELS[m.tier] * 20 + 20,
                bgcolor: 'primary.main',
                borderRadius: 1,
                opacity: m.label === months[months.length - 1].label ? 1 : 0.5,
                mb: 1,
                transition: 'height 0.3s',
              }}
            />
            <TierBadge tier={m.tier} size="small" />
            <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
              {m.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
