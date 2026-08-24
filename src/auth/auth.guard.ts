import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { RealtimeBus } from 'src/realtime/realtime.bus';

export interface AuthedRequest extends Request {
    user: { userId: string; id: string; email: string; role: string };
}

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly realtime: RealtimeBus,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const header = req.headers['authorization'];
        if (!header || !header.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing bearer token');
        }
        const token = header.slice('Bearer '.length).trim();
        let payload: { sub: string; email: string };
        try {
            payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // Enforce bans/suspensions immediately: a disabled account is rejected
        // on its very next request with a code the app maps to a forced logout.
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { isActive: true, plan: true, planExpiresAt: true, role: true },
        });
        if (!user || !user.isActive) {
            throw new ForbiddenException('account_banned');
        }

        // Lazily lapse an expired subscription: a Premium plan whose
        // planExpiresAt has passed is downgraded to Basic on the next request,
        // so feature-gating (which reads user.plan) reflects reality without a cron.
        if (
            user.plan !== 'basic' &&
            user.planExpiresAt &&
            user.planExpiresAt.getTime() < Date.now()
        ) {
            await this.prisma.user.update({
                where: { id: payload.sub },
                data: { plan: 'basic', planExpiresAt: null },
            });
            await this.prisma.subscription.updateMany({
                where: { userId: payload.sub, status: 'active' },
                data: { status: 'expired' },
            });
            this.realtime.emitToUser(payload.sub, 'subscription:updated', {
                tier: 'basic',
                status: 'expired',
            });
        }

        req.user = { userId: payload.sub, id: payload.sub, email: payload.email, role: user.role };
        return true;
    }
}
