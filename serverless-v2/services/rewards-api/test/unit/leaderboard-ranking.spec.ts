import { buildCompetitionRanking } from '../../src/leaderboard/leaderboard.service';

describe('buildCompetitionRanking', () => {
  it('uses competition ranking for ties', () => {
    const ranked = buildCompetitionRanking([
      { playerId: 'a', tier: 1, monthlyPoints: 100 },
      { playerId: 'b', tier: 1, monthlyPoints: 80 },
      { playerId: 'c', tier: 1, monthlyPoints: 80 },
      { playerId: 'd', tier: 1, monthlyPoints: 50 },
    ]);

    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 2, 4]);
  });

  it('sorts ties by player id without changing rank numbers', () => {
    const ranked = buildCompetitionRanking([
      { playerId: 'z', tier: 1, monthlyPoints: 10 },
      { playerId: 'a', tier: 1, monthlyPoints: 10 },
    ]);

    expect(ranked.map((entry) => entry.playerId)).toEqual(['a', 'z']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1]);
  });
});
