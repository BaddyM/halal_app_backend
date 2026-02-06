import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (process.env.MODE == 'Dev') {
            console.log('request_url', request.url);
            console.log('request_method', request.method);
            console.log('token', token);
        }

        if (!token) throw new UnauthorizedException('Invalid token');

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.SYSTEM_SECRET,
                clockTolerance: 0,
            });

            const now = Math.floor(Date.now() / 1000);

            if (process.env.MODE == "Dev") {
                console.log(`Token expires at: ${payload.exp}`);
                console.log(`Current time:      ${now}`);
                console.log(`Seconds left:      ${payload.exp - now}`);
            }

            // 1. Check Redis first (The "Fast Path")
            const cacheKey = `auth_session:${token}`;
            let userSession = await this.cacheManager.get(cacheKey);

            if (!userSession) {
                // 2. Cache Miss - Hit Prisma (The "Slow Path")
                const userFromToken = await this.prisma.user.findFirst({
                    where: { accessToken: token, isActive: true },
                    select: { id: true, role: true }, // Only select what you need
                });

                if (!userFromToken) throw new UnauthorizedException();

                // 3. Store in Redis for future requests (e.g., for 5 minutes)
                await this.cacheManager.set(cacheKey, userFromToken, 300000);
                userSession = userFromToken;
            }

            request['user'] = userSession;
        } catch {
            throw new UnauthorizedException({
                success: false,
                location: 'middleware',
                message: 'User not authorized',
            });
        }
        return true;
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
