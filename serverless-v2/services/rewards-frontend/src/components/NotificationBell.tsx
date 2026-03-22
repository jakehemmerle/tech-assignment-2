import { useState, useEffect } from 'react';
import {
  IconButton, Badge, Popover, List, ListItem, ListItemText,
  Typography, Box, Button, Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { rewardsApi, Notification } from '../api/rewards';

interface NotificationBellProps {
  unreadCount: number;
}

export default function NotificationBell({ unreadCount: initialCount }: NotificationBellProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(initialCount);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    rewardsApi.getNotifications().then((data) => {
      setNotifications(data.notifications);
    });
  };

  const handleDismiss = async (id: string) => {
    await rewardsApi.dismissNotification(id);
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, dismissed: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  useEffect(() => {
    setUnreadCount(initialCount);
  }, [initialCount]);

  return (
    <>
      <IconButton onClick={handleOpen} sx={{ color: 'text.primary' }}>
        <Badge badgeContent={unreadCount} color="secondary">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 350, maxHeight: 400, overflow: 'auto' }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Notifications
            </Typography>
          </Box>
          <Divider />
          <List dense>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText secondary="No notifications" />
              </ListItem>
            ) : (
              notifications.map((n) => (
                <ListItem
                  key={n.notificationId}
                  sx={{ opacity: n.dismissed ? 0.5 : 1 }}
                  secondaryAction={
                    !n.dismissed ? (
                      <Button size="small" onClick={() => handleDismiss(n.notificationId)}>
                        Dismiss
                      </Button>
                    ) : null
                  }
                >
                  <ListItemText
                    primary={n.title}
                    secondary={
                      <>
                        {n.description}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}
