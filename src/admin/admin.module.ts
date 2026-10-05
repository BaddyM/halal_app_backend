import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminVerificationsController } from './admin-verifications.controller';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';
import { AdminMessagingController } from './admin-messaging.controller';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminInsightsController } from './admin-insights.controller';
import { AdminInsightsService } from './admin-insights.service';
import { AdminGateway } from './admin.gateway';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminVerificationsController,
    AdminModerationController,
    AdminMessagingController,
    AdminCatalogController,
    AdminInsightsController,
  ],
  providers: [
    AdminGuard,
    AuditInterceptor,
    AdminUsersService,
    AdminModerationService,
    AdminMessagingService,
    AdminCatalogService,
    AdminInsightsService,
    AdminGateway,
  ],
})
export class AdminModule {}
