import { Module } from '@nestjs/common';
import { BranchPayablesService } from './branch-payables.service';
import { BranchPayablesController } from './branch-payables.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BranchPayablesService],
  controllers: [BranchPayablesController],
  exports: [BranchPayablesService],
})
export class BranchPayablesModule {}
