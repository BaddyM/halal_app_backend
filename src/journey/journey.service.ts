import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

const STEPS = [
	{ stepKey: 'intentions', title: 'Set your marriage intention', description: 'Clarify the values and goals guiding your search.', position: 0 },
	{ stepKey: 'profile', title: 'Complete your profile', description: 'Share the information that helps a potential spouse understand you.', position: 1 },
	{ stepKey: 'readiness', title: 'Reflect on readiness', description: 'Consider the practical and personal topics involved in marriage.', position: 2 },
	{ stepKey: 'family', title: 'Plan family involvement', description: 'Decide when and how you want family or a wali involved.', position: 3 },
	{ stepKey: 'conversation', title: 'Prepare for thoughtful conversations', description: 'Discuss expectations respectfully before making a decision.', position: 4 },
];

@Injectable()
export class JourneyService {
	constructor(private readonly prisma: PrismaService) {}

	async getProgress(userId: string) {
		await Promise.all(STEPS.map((step) => this.prisma.journeyStep.upsert({
			where: { userId_stepKey: { userId, stepKey: step.stepKey } },
			create: { userId, ...step },
			update: {},
		})));
		const steps = await this.prisma.journeyStep.findMany({ where: { userId }, orderBy: { position: 'asc' } });
		const completed = steps.filter((step) => step.completed).length;
		return { steps, progress: { completed, total: steps.length, percent: steps.length ? Math.round(completed * 100 / steps.length) : 0 } };
	}

	async updateStep(userId: string, stepId: string, completed: boolean) {
		if (typeof stepId !== 'string' || typeof completed !== 'boolean') {
			throw new BadRequestException('stepId and completed are required');
		}
		await this.getProgress(userId);
		const step = await this.prisma.journeyStep.findUnique({ where: { userId_stepKey: { userId, stepKey: stepId } } });
		if (!step) throw new NotFoundException('Journey step not found');
		await this.prisma.journeyStep.update({
			where: { id: step.id },
			data: { completed, completedAt: completed ? new Date() : null },
		});
		return this.getProgress(userId);
	}

	async adminSummary() {
		const [participants, stepTotals, completedTotals] = await Promise.all([
			this.prisma.journeyStep.groupBy({ by: ['userId'] }),
			this.prisma.journeyStep.groupBy({
				by: ['stepKey', 'title', 'position'],
				_count: { _all: true },
				orderBy: { position: 'asc' },
			}),
			this.prisma.journeyStep.groupBy({
				by: ['stepKey'],
				where: { completed: true },
				_count: { _all: true },
			}),
		]);
		const completedByKey = new Map(
			completedTotals.map((row) => [row.stepKey, row._count._all]),
		);
		const steps = stepTotals.map((row) => {
			const total = row._count._all;
			const completed = completedByKey.get(row.stepKey) ?? 0;
			return {
				stepKey: row.stepKey,
				title: row.title,
				position: row.position,
				total,
				completed,
				completionRate: total ? Math.round((completed / total) * 100) : 0,
			};
		});
		const totalSteps = steps.reduce((sum, step) => sum + step.total, 0);
		const completedSteps = steps.reduce((sum, step) => sum + step.completed, 0);

		return {
			participants: participants.length,
			totalSteps,
			completedSteps,
			completionRate: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
			steps,
		};
	}
}