import { useState, useEffect } from 'react';
import {
  Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Box,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TierBadge from './TierBadge';
import { rewardsApi, LeaderboardEntry } from '../api/rewards';

export default function LeaderboardWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rewardsApi
      .getLeaderboard(10)
      .then((data) => {
        setEntries(data.leaderboard);
        setPlayerRank(data.playerRank);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <EmojiEventsIcon sx={{ color: '#FFD700', fontSize: 18 }} />;
    if (rank === 2) return <EmojiEventsIcon sx={{ color: '#C0C0C0', fontSize: 18 }} />;
    if (rank === 3) return <EmojiEventsIcon sx={{ color: '#CD7F32', fontSize: 18 }} />;
    return null;
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Monthly Leaderboard
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={50}>#</TableCell>
              <TableCell>Player</TableCell>
              <TableCell>Tier</TableCell>
              <TableCell align="right">Points</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">Loading...</TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow
                  key={entry.playerId}
                  sx={playerRank?.playerId === entry.playerId ? { bgcolor: 'rgba(108,99,255,0.15)' } : {}}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {getRankIcon(entry.rank)}
                      {entry.rank}
                    </Box>
                  </TableCell>
                  <TableCell>{entry.displayName}</TableCell>
                  <TableCell>
                    <TierBadge tier={entry.tier} size="small" />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {entry.monthlyPoints.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {playerRank && !entries.find((e) => e.playerId === playerRank.playerId) && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(108,99,255,0.1)', borderRadius: 1 }}>
          <Typography variant="body2">
            Your rank: <strong>#{playerRank.rank}</strong> — {playerRank.monthlyPoints.toLocaleString()} pts
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
