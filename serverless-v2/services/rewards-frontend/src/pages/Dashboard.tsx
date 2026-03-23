import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Box, Grid, CircularProgress, Alert } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SummaryCard from '../components/SummaryCard';
import PointsHistory from '../components/PointsHistory';
import LeaderboardWidget from '../components/LeaderboardWidget';
import TierTimeline from '../components/TierTimeline';
import NotificationBell from '../components/NotificationBell';
import { rewardsApi, RewardsSummary, TimelineMonth } from '../api/rewards';

export default function Dashboard() {
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    if (!playerId) {
      navigate('/login');
      return;
    }

    Promise.all([rewardsApi.getSummary(), rewardsApi.getTimeline()])
      .then(([summaryResponse, timelineResponse]) => {
        setSummary(summaryResponse);
        setTimeline(timelineResponse.months);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load rewards data');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!summary) return null;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <EmojiEventsIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight={700}>
            Rewards Dashboard
          </Typography>
        </Box>
        <NotificationBell unreadCount={summary.unreadNotifications} />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <SummaryCard data={summary} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TierTimeline months={timeline} />
        </Grid>
        <Grid item xs={12} md={8}>
          <PointsHistory />
        </Grid>
        <Grid item xs={12} md={4}>
          <LeaderboardWidget />
        </Grid>
      </Grid>
    </Container>
  );
}
