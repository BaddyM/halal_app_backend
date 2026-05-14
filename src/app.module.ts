import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { BranchModule } from './branch/branch.module';
import { DailyReportModule } from './daily_report/daily_report.module';
import { ProductModule } from './product/product.module';
import { SalesModule } from './sales/sales.module';
import { ExpenseModule } from './expense/expense.module';
import { StaffModule } from './staff/staff.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SupplierModule } from './supplier/supplier.module';
import { ProductionModule } from './production/production.module';
import { AuditModule } from './audit/audit.module';
import { InvoiceModule } from './invoice/invoice.module';
import { BranchPayablesModule } from './branch-payables/branch-payables.module';
import { UploadModule } from './upload/upload.module';
import { WebsiteModule } from './website/website.module';
import { CmsModule } from './cms/cms.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const redisUrl = configService.get('REDIS_URL') || 'redis://localhost:6379';

                return {
                    stores: [createKeyv(redisUrl)],
                    ttl: 60000,
                };
            },
            inject: [ConfigService],
        }),
        JwtModule.register({
            secret: process.env.SYSTEM_SECRET,
            signOptions: { expiresIn: '30s' },
        }),
        ServeStaticModule.forRoot({
            rootPath: join(process.cwd(), 'uploads'),
            serveRoot: '/uploads/',
        }),
        UserModule,
        PrismaModule,
        AuthModule,
        BranchModule,
        DailyReportModule,
        ProductModule,
        SalesModule,
        ExpenseModule,
        StaffModule,
        DashboardModule,
        SupplierModule,
        ProductionModule,
        AuditModule,
        InvoiceModule,
        // Branch payables (admin)
        BranchPayablesModule,
        // Website CMS for jubra-edutech-portal
        UploadModule,
        WebsiteModule,
        CmsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
