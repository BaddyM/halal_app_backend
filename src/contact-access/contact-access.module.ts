import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ContactAccessController } from './contact-access.controller';
import { ContactAccessService } from './contact-access.service';

@Module({
    imports: [AuthModule],
    controllers: [ContactAccessController],
    providers: [ContactAccessService],
})
export class ContactAccessModule {}
