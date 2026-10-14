import { AdminModerationService } from './admin-moderation.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

describe('AdminModerationService', () => {
    const report = {
        id: 'report-1',
        reporterId: 'reporter-1',
        reportedId: 'reported-1',
    };
    const prisma = {
        report: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        inboxMessage: { create: jest.fn() },
    };
    const push = { sendToUser: jest.fn() };
    const realtime = { emitToUser: jest.fn() };
    let service: AdminModerationService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.report.findUnique.mockResolvedValue(report);
        prisma.report.update.mockResolvedValue({});
        prisma.inboxMessage.create.mockResolvedValue({});
        push.sendToUser.mockResolvedValue(undefined);
        service = new AdminModerationService(
            prisma as unknown as PrismaService,
            push as unknown as PushService,
            realtime as unknown as RealtimeBus,
        );
    });

    it('notifies the reporter when a report is dismissed', async () => {
        await service.resolve(report.id, 'dismissed');

        expect(prisma.report.update).toHaveBeenCalledWith({
            where: { id: report.id },
            data: { status: 'dismissed', resolvedAt: null },
        });
        expect(prisma.inboxMessage.create).toHaveBeenCalledWith({
            data: {
                userId: report.reporterId,
                fromAdmin: true,
                subject: 'Report update',
                body: 'Our team reviewed your report and closed it without further action.',
            },
        });
        expect(realtime.emitToUser).toHaveBeenCalledWith(
            report.reporterId,
            'notification:new',
            { kind: 'report' },
        );
    });

    it('does not send a terminal-status notification while a report is reviewed', async () => {
        await service.resolve(report.id, 'reviewed');

        expect(prisma.inboxMessage.create).not.toHaveBeenCalled();
        expect(realtime.emitToUser).not.toHaveBeenCalled();
    });
});
