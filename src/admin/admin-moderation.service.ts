import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushService } from 'src/push/push.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeBus,
  ) {}

  async listReports(status?: string) {
    const reports = await this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
      },
    });
    return reports.map((r) => ({
      id: r.id,
      reportedUser: r.reported.name,
      reportedUserId: r.reportedId,
      reporter: r.reporter.name,
      reporterId: r.reporterId,
      category: r.category ?? r.reason,
      reason: r.reason,
      details: r.details,
      severity: r.severity,
      status: r.status,
      date: r.createdAt,
    }));
  }

  async counts() {
    const [pending, reviewed, resolved] = await Promise.all([
      this.prisma.report.count({ where: { status: { in: ['open', 'pending'] } } }),
      this.prisma.report.count({ where: { status: 'reviewed' } }),
      this.prisma.report.count({ where: { status: 'resolved' } }),
    ]);
    return { pending, reviewed, resolved };
  }

  /// Resolve/review/dismiss a report. On `resolved` the reporter is notified
  /// (notification + inbox), per the dashboard→app control flow.
  async resolve(reportId: string, status: string, note?: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
      },
    });

    if (status === 'resolved') {
      await this.notifyReporter(report.reporterId, note);
    }
    return { id: reportId, status };
  }

  /// Resolve a report AND ban the reported user in one action.
  async resolveAndBan(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'resolved', resolvedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: report.reportedId },
        data: { status: 'banned', isActive: false },
      }),
    ]);

    this.realtime.emitToUser(report.reportedId, 'account:banned', { reason: 'report' });
    await this.notifyReporter(report.reporterId, 'Action has been taken on your report.');
    return { id: reportId, status: 'resolved', bannedUserId: report.reportedId };
  }

  private async notifyReporter(reporterId: string, note?: string) {
    const body = note ?? 'Thank you for your report. Our team has reviewed it.';
    await this.prisma.inboxMessage.create({
      data: { userId: reporterId, fromAdmin: true, subject: 'Report update', body },
    });
    this.realtime.emitToUser(reporterId, 'notification:new', { kind: 'report' });
    void this.push.sendToUser(reporterId, {
      title: 'Report update',
      body,
      data: { type: 'report' },
    });
  }
}
