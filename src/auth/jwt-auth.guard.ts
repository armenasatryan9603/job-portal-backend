import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: any, user: any, info: any) {
    if (err) {
      throw err;
    }

    // Handle JWT validation errors
    if (info) {
      if (info.name === "TokenExpiredError") {
        throw new UnauthorizedException(
          "Token has expired. Please log in again."
        );
      }
      if (info.name === "JsonWebTokenError") {
        throw new UnauthorizedException("Invalid token. Please log in again.");
      }
      if (info.name === "NotBeforeError") {
        throw new UnauthorizedException("Token not active yet.");
      }
      throw new UnauthorizedException(
        "Authentication failed. Please log in again."
      );
    }

    // For protected endpoints, require a valid user
    if (!user || !user.userId) {
      throw new UnauthorizedException(
        "Authentication required. Please log in and try again."
      );
    }

    return user;
  }
}
