import { Paper, Typography, Box, LinearProgress } from '@mui/material';
import TierBadge from './TierBadge';
import type { RewardsSummary } from '../api/rewards';

interface SummaryCardProps {
  data: RewardsSummary;
}

export default function SummaryCard({ data }: SummaryCardProps) {
  const progress = data.nextTierTarget
    ? Math.min(100, (data.monthlyPoints / data.nextTierTarget) * 100)
    : 100;

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {data.displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.multiplier}x multiplier
          </Typography>
        </Box>
        <TierBadge tier={data.currentTier} />
      </Box>

      <Box mb={2}>
        <Box display="flex" justifyContent="space-between" mb={0.5}>
          <Typography variant="body2" color="text.secondary">
            Monthly Points
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {data.monthlyPoints.toLocaleString()}
            {data.nextTierTarget && ` / ${data.nextTierTarget.toLocaleString()}`}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 10,
            borderRadius: 5,
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': { borderRadius: 5 },
          }}
        />
        {data.nextTierTarget && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {data.pointsToNextTier.toLocaleString()} points to next tier
          </Typography>
        )}
      </Box>

      <Box display="flex" gap={4}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Lifetime Points
          </Typography>
          <Typography variant="h6" fontWeight={600}>
            {data.lifetimePoints.toLocaleString()}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
