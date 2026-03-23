import { PlayerEntity } from '../../src/config/rewards.types';
import { RewardsStateService } from '../../src/reconciliation/rewards-state.service';

describe('RewardsStateService monthly reset', () => {
  const dynamoService = {
    getPlayer: jest.fn(),
    putPlayer: jest.fn(),
    updatePlayer: jest.fn(),
    scanPlayers: jest.fn(),
  };
  const identityService = {
    findPlayerIdentity: jest.fn(),
    resolveDisplayName: jest.fn(),
  };
  const notificationsService = {
    createTierDowngrade: jest.fn(),
  };

  let service: RewardsStateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RewardsStateService(
      dynamoService as any,
      identityService as any,
      notificationsService as any
    );
  });

  it('applies one-tier floor protection and creates a downgrade notification', async () => {
    const player: PlayerEntity = {
      playerId: 'p2-uuid-0002',
      displayName: 'Bob',
      currentTier: 4,
      monthlyPoints: 12000,
      lifetimePoints: 14000,
      tierFloor: 1,
      highestTierThisMonth: 4,
      monthKey: '2026-02',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-28T23:59:59.000Z',
    };

    const result = await service.resetPlayer(player, '2026-03');

    expect(dynamoService.updatePlayer).toHaveBeenCalledWith(
      player.playerId,
      expect.objectContaining({
        monthlyPoints: 0,
        monthKey: '2026-03',
        currentTier: 3,
        tierFloor: 3,
        highestTierThisMonth: 3,
      })
    );
    expect(notificationsService.createTierDowngrade).toHaveBeenCalledWith(
      player.playerId,
      'Gold'
    );
    expect(result).toMatchObject({
      playerId: player.playerId,
      currentTier: 3,
      monthlyPoints: 0,
      tierFloor: 3,
      highestTierThisMonth: 3,
      monthKey: '2026-03',
    });
  });

  it('does not create a downgrade notification when the tier stays the same', async () => {
    const player: PlayerEntity = {
      playerId: 'p3-uuid-0003',
      displayName: 'Charlie',
      currentTier: 1,
      monthlyPoints: 10,
      lifetimePoints: 10,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: '2026-02',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-28T23:59:59.000Z',
    };

    const result = await service.resetPlayer(player, '2026-03');

    expect(dynamoService.updatePlayer).toHaveBeenCalledWith(
      player.playerId,
      expect.objectContaining({
        currentTier: 1,
        tierFloor: 1,
        highestTierThisMonth: 1,
        monthKey: '2026-03',
      })
    );
    expect(notificationsService.createTierDowngrade).not.toHaveBeenCalled();
    expect(result.currentTier).toBe(1);
  });
});
