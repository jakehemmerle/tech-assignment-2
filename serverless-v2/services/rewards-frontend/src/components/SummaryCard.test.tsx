import { render, screen } from '@testing-library/react';

import SummaryCard from './SummaryCard';

describe('SummaryCard', () => {
  it('renders the current rewards progress snapshot', () => {
    render(
      <SummaryCard
        data={{
          playerId: 'p1-uuid-0001',
          displayName: 'Alice',
          currentTier: 'Silver',
          tierLevel: 2,
          multiplier: 1.25,
          monthlyPoints: 750,
          lifetimePoints: 8400,
          nextTierTarget: 2000,
          pointsToNextTier: 1250,
          unreadNotifications: 2,
          recentTimeline: [],
        }}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Silver')).toBeInTheDocument();
    expect(screen.getByText('1.25x multiplier')).toBeInTheDocument();
    expect(screen.getByText('750 / 2,000')).toBeInTheDocument();
    expect(screen.getByText('1,250 points to next tier')).toBeInTheDocument();
    expect(screen.getByText('8,400')).toBeInTheDocument();
  });
});
