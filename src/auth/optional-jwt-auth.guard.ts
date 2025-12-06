import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  // Override canActivate to allow requests without authentication
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Try to authenticate, but don't fail if it doesn't work
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      // If authentication fails, allow the request to proceed anyway
      return true;
    }
  }

  // Override handleRequest to allow requests without authentication
  handleRequest(err: any, user: any, info: any) {
    // If there's an error or info, just return null (don't throw)
    // This allows the endpoint to work without authentication
    if (err || info) {
      return null;
    }

    // Return user if available, otherwise null
    return user || null;
  }
}
