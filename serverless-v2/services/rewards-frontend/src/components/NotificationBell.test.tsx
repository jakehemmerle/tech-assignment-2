import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NotificationBell from './NotificationBell';
import { rewardsApi } from '../api/rewards';

vi.mock('../api/rewards', () => ({
  rewardsApi: {
    getNotifications: vi.fn(),
    dismissNotification: vi.fn(),
  },
}));

describe('NotificationBell', () => {
  it('loads notifications on open and decrements the unread badge after dismiss', async () => {
    const user = userEvent.setup();
    vi.mocked(rewardsApi.getNotifications).mockResolvedValue({
      total: 2,
      notifications: [
        {
          notificationId: 'notification-1',
          type: 'tier_upgrade',
          title: 'Tier Upgrade: Gold',
          description: "Congratulations! You've reached Gold tier!",
          dismissed: false,
          createdAt: '2026-03-22T00:00:00.000Z',
          dismissedAt: null,
        },
        {
          notificationId: 'notification-2',
          type: 'milestone',
          title: 'Milestone: 1,000 Points',
          description: "You've earned 1,000 lifetime points!",
          dismissed: false,
          createdAt: '2026-03-22T01:00:00.000Z',
          dismissedAt: null,
        },
      ],
    });
    vi.mocked(rewardsApi.dismissNotification).mockResolvedValue({ success: true });

    render(<NotificationBell unreadCount={2} />);

    const trigger = screen.getByRole('button');
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(trigger);

    expect(await screen.findByText('Tier Upgrade: Gold')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Dismiss' })[0]);

    await waitFor(() => {
      expect(rewardsApi.dismissNotification).toHaveBeenCalledWith('notification-1');
    });

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Milestone: 1,000 Points')).toBeInTheDocument();
  });
});
