import { render, screen, waitFor } from '@testing-library/react';

import LeaderboardWidget from './LeaderboardWidget';
import { rewardsApi } from '../api/rewards';

vi.mock('../api/rewards', () => ({
  rewardsApi: {
    getLeaderboard: vi.fn(),
  },
}));

describe('LeaderboardWidget', () => {
  it('renders leaderboard rows and the requesting player rank when outside the top slice', async () => {
    vi.mocked(rewardsApi.getLeaderboard).mockResolvedValue({
      monthKey: '2026-03',
      leaderboard: [
        { rank: 1, playerId: 'p1', displayName: 'Alice', tier: 'Gold', monthlyPoints: 2400 },
        { rank: 2, playerId: 'p2', displayName: 'Bob', tier: 'Silver', monthlyPoints: 1800 },
      ],
      playerRank: {
        rank: 14,
        playerId: 'p9',
        displayName: 'You',
        tier: 'Silver',
        monthlyPoints: 725,
      },
    });

    render(<LeaderboardWidget />);

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Monthly Leaderboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Your rank:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/#14/)).toBeInTheDocument();
    expect(screen.getByText(/725 pts/)).toBeInTheDocument();
  });
});
