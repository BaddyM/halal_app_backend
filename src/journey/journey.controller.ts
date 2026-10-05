import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/admin/admin.guard';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { JourneyService } from './journey.service';

@Controller('journey')
@UseGuards(AuthGuard)
export class JourneyController {
	constructor(private readonly journey: JourneyService) {}

	@Get()
	get(@Req() req: AuthedRequest) {
		return this.journey.getProgress(req.user.userId);
	}

	@Post()
	update(@Req() req: AuthedRequest, @Body() body: { stepId: string; completed: boolean }) {
		return this.journey.updateStep(req.user.userId, body.stepId, body.completed);
	}
}

@Controller('admin/journey')
@UseGuards(AuthGuard, AdminGuard)
export class JourneyAdminController {
	constructor(private readonly journey: JourneyService) {}

	@Get('summary')
	summary() {
		return this.journey.adminSummary();
	}
}