import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuthedRequest } from 'src/auth/auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';

/// Records every successful admin mutation (non-GET) to the AuditLog, capturing
/// who did what and on which entity. Applied on the admin mutation controllers.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method = req.method;

    if (method === 'GET') return next.handle();

    const routePath = (req.route?.path as string) ?? req.originalUrl;
    const target = JSON.stringify(req.params ?? {});

    return next.handle().pipe(
      tap(() => {
        void this.prisma.auditLog
          .create({
            data: {
              adminId: req.user?.userId ?? null,
              adminEmail: req.user?.email ?? null,
              action: `${method} ${routePath}`,
              target: target === '{}' ? null : target.slice(0, 255),
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
