import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

/// Records every successful admin mutation (non-GET) to the AuditLog.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method = req.method;
    const requestPath = (req.originalUrl ?? '').split('?')[0];
    const locallyAudited =
      /^\/api\/admin\/verifications?\//.test(requestPath) ||
      /^\/api\/admin\/photos\/[^/]+$/.test(requestPath) ||
      /^\/api\/admin\/photo-requests\/[^/]+$/.test(requestPath) ||
      /^\/api\/admin\/account-deletion-requests(?:\/|$)/.test(requestPath);

    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(method) ||
      locallyAudited ||
      !(requestPath.startsWith('/api/admin/') || requestPath.startsWith('/admin/'))
    ) {
      return next.handle();
    }

    const target = JSON.stringify(req.params ?? {});

    return next.handle().pipe(
      mergeMap(async (response) => {
        await this.prisma.auditLog.create({
          data: {
            adminId: req.user?.userId ?? null,
            adminEmail: req.user?.email ?? null,
            action: `${method} ${requestPath}`.slice(0, 255),
            target: target === '{}' ? null : target.slice(0, 255),
          },
        });
        return response;
      }),
    );
  }
}
