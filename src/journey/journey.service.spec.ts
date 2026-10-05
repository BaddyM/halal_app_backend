import { JourneyService } from './journey.service';

describe('JourneyService admin summary', () => {
  it('returns aggregate completion counts without member identifiers', async () => {
    const prisma = {
      journeyStep: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ userId: 'member-1' }, { userId: 'member-2' }])
          .mockResolvedValueOnce([
            {
              stepKey: 'intentions',
              title: 'Set your marriage intention',
              position: 0,
              _count: { _all: 2 },
            },
            {
              stepKey: 'profile',
              title: 'Complete your profile',
              position: 1,
              _count: { _all: 1 },
            },
          ])
          .mockResolvedValueOnce([
            { stepKey: 'intentions', _count: { _all: 1 } },
          ]),
      },
    };
    const service = new JourneyService(prisma as any);

    const summary = await service.adminSummary();

    expect(summary).toEqual({
      participants: 2,
      totalSteps: 3,
      completedSteps: 1,
      completionRate: 33,
      steps: [
        {
          stepKey: 'intentions',
          title: 'Set your marriage intention',
          position: 0,
          total: 2,
          completed: 1,
          completionRate: 50,
        },
        {
          stepKey: 'profile',
          title: 'Complete your profile',
          position: 1,
          total: 1,
          completed: 0,
          completionRate: 0,
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain('member-1');
  });
});