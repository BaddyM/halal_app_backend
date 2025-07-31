import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DashboardModule } from './dashboard/dashboard.module';
import { OrderModule } from './order/order.module';
import { StockModule } from './stock/stock.module';
import { ServicesModule } from './services/services.module';
import { AttendanceModule } from './attendance/attendance.module';
import { SalaryModule } from './salary/salary.module';
import { StaffModule } from './staff/staff.module';
import { ExpenseModule } from './expense/expense.module';
import { PaymentModule } from './payment/payment.module';
import { PrinterModule } from './printer/printer.module';
import { FirebaseModule } from './firebase/firebase.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      secret: process.env.SYSTEM_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
    UserModule, 
    PrismaModule, 
    AuthModule, 
    DashboardModule, 
    OrderModule, StockModule, 
    ServicesModule, 
    AttendanceModule, 
    SalaryModule, 
    StaffModule, 
    ExpenseModule, 
    PaymentModule, 
    PrinterModule,
    FirebaseModule,
    NotificationsModule,
],
  controllers: [],
  providers: [],
})
export class AppModule {}
