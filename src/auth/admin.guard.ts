import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Injectable()
export class AdminGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First check if user is authenticated
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Get the request object
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if user has admin role
    if (!user || user.role !== "admin") {
      throw new ForbiddenException(
        "Access denied. Admin privileges required."
      );
    }

    return true;
  }
}

