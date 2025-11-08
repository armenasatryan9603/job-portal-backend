import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET || "yourSecretKey";

    const jwtFromRequest = (req: any) => {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        return token;
      }

      return null;
    };

    super({
      jwtFromRequest,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      return null;
    }

    const user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return user;
  }
}
