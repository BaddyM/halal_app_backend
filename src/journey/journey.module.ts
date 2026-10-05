import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AdminGuard } from 'src/admin/admin.guard';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JourneyAdminController, JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [JourneyController, JourneyAdminController],
	providers: [JourneyService, AdminGuard],
})
export class JourneyModule {}