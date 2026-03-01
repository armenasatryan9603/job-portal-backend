import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma.service";

/**
 * EmailNotificationService - Single source of truth for sending email notifications.
 * Uses Resend API only. Configure via RESEND_API_KEY and related env vars.
 */
@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private readonly emailEnabled: boolean;

  constructor(private prisma: PrismaService) {
    this.emailEnabled = !!process.env.RESEND_API_KEY;

    if (this.emailEnabled) {
      this.logger.log("✅ Email notification service initialized (Resend)");
    } else {
      this.logger.log(
        "⚠️  Email disabled - set RESEND_API_KEY to enable"
      );
    }
  }

  /**
   * Send email notification to user (single entry point for all app email).
   */
  async sendEmailNotification(
    userId: number,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.log(
        `Email disabled, skipping email for user ${userId}`
      );
      return false;
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        this.logger.error(`❌ [Email] User ${userId} not found`);
        return false;
      }

      if (!user.email) {
        this.logger.warn(
          `⚠️ [Email] No email for user ${userId} (${user.name})`
        );
        return false;
      }

      this.logger.log(
        `📧 [Email] Sending to user ${userId} (${user.email}) - ${subject}`
      );

      const sent = await this.send(
        user.email,
        user.name || "User",
        subject,
        htmlBody,
        textBody
      );

      if (sent) {
        this.logger.log(`✅ [Email] Sent to ${user.email}`);
      } else {
        this.logger.warn(`⚠️ [Email] Failed to send to ${user.email}`);
      }
      return sent;
    } catch (error) {
      this.logger.error(`❌ [Email] Error for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send one email via Resend. When RESEND_API_KEY is missing, logs only (dev mode).
   */
  private async send(
    to: string,
    toName: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
    const fromName = process.env.RESEND_FROM_NAME || "HotWork";
    const isDevelopment = process.env.NODE_ENV !== "production";
    
    if (!apiKey) {
      this.logger.log("═══════════════════════════════════════════════════════");
      this.logger.log("📧 EMAIL (Dev - no RESEND_API_KEY, not sent):");
      this.logger.log(`To: ${toName} <${to}> | Subject: ${subject}`);
      this.logger.log("═══════════════════════════════════════════════════════");
      return true;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [`${toName} <${to}>`],
          subject,
          html: htmlBody,
          text: textBody ?? this.htmlToText(htmlBody),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { message?: string } = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        if (response.status === 403 && errorData.message?.includes("testing emails")) {
          this.logger.warn(
            `⚠️ [Email] Resend 403: testing tier - can only send to verified address. Skipping ${to}`
          );
          if (isDevelopment) return true;
          return false;
        }

        this.logger.error(`Resend API error: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Error sending email:", error);
      return false;
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
