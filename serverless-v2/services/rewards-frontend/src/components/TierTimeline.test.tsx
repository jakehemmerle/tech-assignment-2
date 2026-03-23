import { render, screen } from '@testing-library/react';

import TierTimeline from './TierTimeline';

describe('TierTimeline', () => {
  it('renders the six-month tier history from API data', () => {
    render(
      <TierTimeline
        months={[
          { monthKey: '2025-10', tier: 'Bronze', tierLevel: 1, monthlyPoints: 120, isCurrentMonth: false },
          { monthKey: '2025-11', tier: 'Silver', tierLevel: 2, monthlyPoints: 550, isCurrentMonth: false },
          { monthKey: '2025-12', tier: 'Gold', tierLevel: 3, monthlyPoints: 2400, isCurrentMonth: false },
          { monthKey: '2026-01', tier: 'Silver', tierLevel: 2, monthlyPoints: 0, isCurrentMonth: false },
          { monthKey: '2026-02', tier: 'Gold', tierLevel: 3, monthlyPoints: 2200, isCurrentMonth: false },
          { monthKey: '2026-03', tier: 'Gold', tierLevel: 3, monthlyPoints: 2750, isCurrentMonth: true },
        ]}
      />
    );

    expect(screen.getByText('Tier Timeline')).toBeInTheDocument();
    expect(screen.getByText('Oct 25')).toBeInTheDocument();
    expect(screen.getByText('Mar 26')).toBeInTheDocument();
    expect(screen.getAllByText('Gold')).toHaveLength(3);
  });
});
