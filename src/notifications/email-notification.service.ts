import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

/**
 * EmailNotificationService - Email Notifications
 *
 * This service handles sending email notifications to users.
 * It uses a simple SMTP-based approach that can be configured via environment variables.
 * For production, consider using services like SendGrid, Resend, or AWS SES.
 */
@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private emailEnabled: boolean = false;

  constructor(private prisma: PrismaService) {
    // Check if email is enabled via environment variables
    this.emailEnabled =
      process.env.EMAIL_ENABLED === "true" ||
      process.env.SMTP_HOST !== undefined;

    if (this.emailEnabled) {
      this.logger.log("✅ Email notification service initialized");
    } else {
      this.logger.log(
        "⚠️  Email notifications disabled - set EMAIL_ENABLED=true or SMTP_HOST to enable"
      );
    }
  }

  /**
   * Send email notification to user
   * @param userId - User ID to send email to
   * @param subject - Email subject
   * @param htmlBody - Email HTML body
   * @param textBody - Email plain text body (optional)
   */
  async sendEmailNotification(
    userId: number,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    if (!this.emailEnabled) {
      this.logger.log(
        `Email notifications disabled, skipping email for user ${userId}`
      );
      return false;
    }

    try {
      // Get user's email from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (!user) {
        this.logger.error(`❌ [Email] User ${userId} not found in database`);
        return false;
      }

      if (!user.email) {
        this.logger.warn(
          `⚠️ [Email] No email address found for user ${userId} (${user.name})`
        );
        return false;
      }

      this.logger.log(
        `📧 [Email] Attempting to send email to user ${userId} (${user.email})`
      );
      this.logger.log(`   Subject: ${subject}`);

      // Try to send email using configured method
      const emailSent = await this.sendEmail(
        user.email,
        user.name || "User",
        subject,
        htmlBody,
        textBody
      );

      if (emailSent) {
        this.logger.log(
          `✅ [Email] Email sent successfully to ${user.email}`
        );
        return true;
      } else {
        this.logger.warn(
          `⚠️ [Email] Failed to send email to ${user.email}`
        );
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ [Email] Error sending email to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Send email using configured SMTP or email service
   */
  private async sendEmail(
    to: string,
    toName: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    try {
      // Check if using a service like Resend, SendGrid, etc.
      const resendApiKey = process.env.RESEND_API_KEY;
      const sendgridApiKey = process.env.SENDGRID_API_KEY;

      if (resendApiKey) {
        return await this.sendViaResend(
          to,
          toName,
          subject,
          htmlBody,
          textBody
        );
      } else if (sendgridApiKey) {
        return await this.sendViaSendGrid(
          to,
          toName,
          subject,
          htmlBody,
          textBody
        );
      } else if (process.env.SMTP_HOST) {
        return await this.sendViaSMTP(
          to,
          toName,
          subject,
          htmlBody,
          textBody
        );
      } else {
        // Development mode - just log the email
        this.logger.log("═══════════════════════════════════════════════════════");
        this.logger.log("📧 EMAIL (Development Mode - Not Actually Sent):");
        this.logger.log("═══════════════════════════════════════════════════════");
        this.logger.log(`To: ${toName} <${to}>`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Body: ${textBody || htmlBody}`);
        this.logger.log("═══════════════════════════════════════════════════════");
        return true; // Return true in dev mode so notifications continue
      }
    } catch (error) {
      this.logger.error("Error in sendEmail:", error);
      return false;
    }
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(
    to: string,
    toName: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
      const fromName = process.env.RESEND_FROM_NAME || "Job Portal";
      const resendTestEmail = process.env.RESEND_TEST_EMAIL; // For testing, only send to this email
      const isDevelopment = process.env.NODE_ENV !== "production";

      // In development/testing mode with Resend, check if we should only send to test email
      if (isDevelopment && resendTestEmail && to.toLowerCase() !== resendTestEmail.toLowerCase()) {
        this.logger.warn(
          `⚠️ [Email] Resend testing mode: Skipping email to ${to} (only sending to ${resendTestEmail} in development)`
        );
        this.logger.log("═══════════════════════════════════════════════════════");
        this.logger.log("📧 EMAIL (Resend Testing Mode - Not Sent):");
        this.logger.log("═══════════════════════════════════════════════════════");
        this.logger.log(`To: ${toName} <${to}>`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Body: ${textBody || this.htmlToText(htmlBody)}`);
        this.logger.log("═══════════════════════════════════════════════════════");
        // Return true in dev mode so notifications continue
        return true;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [`${toName} <${to}>`],
          subject,
          html: htmlBody,
          text: textBody || this.htmlToText(htmlBody),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        // Handle Resend's 403 validation error (testing tier restriction)
        if (response.status === 403 && errorData.message?.includes("testing emails")) {
          this.logger.warn(
            `⚠️ [Email] Resend 403: Can only send to verified email in testing tier. Skipping email to ${to}`
          );
          this.logger.warn(
            `   To send to other recipients, verify a domain at resend.com/domains`
          );
          
          // In development, log the email and continue
          if (isDevelopment) {
            this.logger.log("═══════════════════════════════════════════════════════");
            this.logger.log("📧 EMAIL (Resend Testing Restriction - Not Sent):");
            this.logger.log("═══════════════════════════════════════════════════════");
            this.logger.log(`To: ${toName} <${to}>`);
            this.logger.log(`Subject: ${subject}`);
            this.logger.log(`Body: ${textBody || this.htmlToText(htmlBody)}`);
            this.logger.log("═══════════════════════════════════════════════════════");
            // Return true in dev mode so notifications continue
            return true;
          }
          
          return false;
        }

        this.logger.error(`Resend API error: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Error sending via Resend:", error);
      return false;
    }
  }

  /**
   * Send email via SendGrid API
   */
  private async sendViaSendGrid(
    to: string,
    toName: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    try {
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@example.com";
      const fromName = process.env.SENDGRID_FROM_NAME || "Job Portal";

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendgridApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to, name: toName }],
            },
          ],
          from: { email: fromEmail, name: fromName },
          subject,
          content: [
            {
              type: "text/plain",
              value: textBody || this.htmlToText(htmlBody),
            },
            {
              type: "text/html",
              value: htmlBody,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`SendGrid API error: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error("Error sending via SendGrid:", error);
      return false;
    }
  }

  /**
   * Send email via SMTP (using nodemailer would require installing it)
   * For now, this is a placeholder that logs the email
   */
  private async sendViaSMTP(
    to: string,
    toName: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<boolean> {
    // Note: To use SMTP, you would need to install nodemailer:
    // npm install nodemailer @types/nodemailer
    // Then implement SMTP sending here
    
    this.logger.log("═══════════════════════════════════════════════════════");
    this.logger.log("📧 EMAIL (SMTP Mode - Not Implemented):");
    this.logger.log("═══════════════════════════════════════════════════════");
    this.logger.log(`To: ${toName} <${to}>`);
    this.logger.log(`Subject: ${subject}`);
    this.logger.log(`Body: ${textBody || htmlBody}`);
    this.logger.log("═══════════════════════════════════════════════════════");
    this.logger.warn("⚠️  SMTP sending not implemented. Install nodemailer to enable.");
    
    // Return true in development so notifications continue
    return process.env.NODE_ENV !== "production";
  }

  /**
   * Convert HTML to plain text (simple implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

