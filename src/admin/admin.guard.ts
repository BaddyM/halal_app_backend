import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthedRequest } from 'src/auth/auth.guard';

/// Requires the requester to be an admin. Always used *after* AuthGuard, which
/// populates `req.user.role` — i.e. `@UseGuards(AuthGuard, AdminGuard)`.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
