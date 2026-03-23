import { Paper, Typography, Box } from '@mui/material';
import TierBadge from './TierBadge';
import type { TimelineMonth } from '../api/rewards';

const TIER_LEVELS: Record<string, number> = { Bronze: 1, Silver: 2, Gold: 3, Platinum: 4 };

interface TierTimelineProps {
  months: TimelineMonth[];
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export default function TierTimeline({ months }: TierTimelineProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Tier Timeline
      </Typography>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end" gap={1} mt={2}>
        {months.map((m) => (
          <Box key={m.monthKey} textAlign="center" flex={1}>
            <Box
              sx={{
                height: (TIER_LEVELS[m.tier] ?? 1) * 20 + 20,
                bgcolor: 'primary.main',
                borderRadius: 1,
                opacity: m.isCurrentMonth ? 1 : 0.5,
                mb: 1,
                transition: 'height 0.3s',
              }}
            />
            <TierBadge tier={m.tier} size="small" />
            <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
              {formatMonthLabel(m.monthKey)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
