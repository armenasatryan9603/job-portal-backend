import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { Response } from 'express';

@Catch()
export class HtmlExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    // Only apply HTML filter to callback endpoints
    if (!request.url.includes('/callback')) {
      // For non-callback endpoints, use default JSON error handling
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      const message =
        exception instanceof HttpException
          ? exception.getResponse()
          : 'Internal server error';

      response.status(status).json({
        statusCode: status,
        message: typeof message === 'string' ? message : (message as any).message || 'Internal server error',
      });
      return;
    }

    // For callback endpoints, return HTML
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage =
      exception instanceof HttpException
        ? (typeof exception.getResponse() === 'string'
            ? exception.getResponse()
            : (exception.getResponse() as any).message || 'An error occurred')
        : exception instanceof Error
        ? exception.message
        : 'An error occurred while processing your payment. Please contact support.';

    // If the exception response is already HTML (from our controller), use it
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;
    let htmlContent: string;
    
    if (typeof exceptionResponse === 'string' && exceptionResponse.includes('<!DOCTYPE html>')) {
      htmlContent = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      // Check if the object has an html property or message that contains HTML
      const responseObj = exceptionResponse as any;
      if (responseObj.html && typeof responseObj.html === 'string') {
        htmlContent = responseObj.html;
      } else {
        htmlContent = this.getErrorHtml(
          'Payment Processing Error',
          responseObj.message || errorMessage,
          process.env.FRONTEND_URL || 'http://localhost:3000',
          '/profile/refill-credits'
        );
      }
    } else {
      htmlContent = this.getErrorHtml(
        'Payment Processing Error',
        errorMessage,
        process.env.FRONTEND_URL || 'http://localhost:3000',
        '/profile/refill-credits'
      );
    }

    response.status(status).setHeader('Content-Type', 'text/html').send(htmlContent);
  }

  private getErrorHtml(
    title: string,
    message: string,
    frontendUrl: string,
    redirectPath: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      text-align: center;
      max-width: 500px;
    }
    .error-icon {
      font-size: 4rem;
      color: #ef4444;
      margin-bottom: 1rem;
    }
    h1 {
      color: #1f2937;
      margin: 0 0 1rem 0;
    }
    p {
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.6;
    }
    .redirect-info {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
    a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">✗</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="redirect-info">
      <a href="${frontendUrl}${redirectPath}">Return to payment page</a>
    </p>
  </div>
</body>
</html>`;
  }
}
