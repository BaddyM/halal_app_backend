import {
    Controller,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthedRequest } from 'src/auth/auth.guard';
import { ContactAccessService } from './contact-access.service';

@UseGuards(AuthGuard)
@Controller('contact-access')
export class ContactAccessController {
    constructor(private readonly contactAccess: ContactAccessService) {}

    @Get('requests')
    list(@Req() req: AuthedRequest) {
        return this.contactAccess.list(req.user.userId);
    }

    @Get('requests/target/:targetId/status')
    status(@Req() req: AuthedRequest, @Param('targetId') targetId: string) {
        return this.contactAccess.status(req.user.userId, targetId);
    }

    @Post('requests/target/:targetId')
    create(@Req() req: AuthedRequest, @Param('targetId') targetId: string) {
        return this.contactAccess.create(req.user.userId, targetId);
    }

    @Post('requests/:requestId/accept')
    accept(@Req() req: AuthedRequest, @Param('requestId') requestId: string) {
        return this.contactAccess.decide(req.user.userId, requestId, true);
    }

    @Post('requests/:requestId/decline')
    decline(@Req() req: AuthedRequest, @Param('requestId') requestId: string) {
        return this.contactAccess.decide(req.user.userId, requestId, false);
    }

    @Post('requests/:requestId/revoke')
    revoke(@Req() req: AuthedRequest, @Param('requestId') requestId: string) {
        return this.contactAccess.revoke(req.user.userId, requestId);
    }

    @Get('requests/:requestId/phone')
    phone(@Req() req: AuthedRequest, @Param('requestId') requestId: string) {
        return this.contactAccess.phone(req.user.userId, requestId);
    }
}
