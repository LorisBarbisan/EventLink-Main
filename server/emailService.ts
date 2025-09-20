import { MailService } from '@sendgrid/mail';

// Initialize email service with graceful error handling for deployment
let mailService: MailService | null = null;
let emailServiceEnabled = false;

try {
  if (process.env.SENDGRID_API_KEY) {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    emailServiceEnabled = true;
    console.log('✅ Email service initialized successfully');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not set - email service disabled');
  }
} catch (error) {
  console.error('❌ Failed to initialize email service:', error);
  console.warn('📧 Email functionality will be disabled');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // Graceful fallback if email service is not available
  if (!emailServiceEnabled || !mailService) {
    console.log(`📧 Email service unavailable - simulating email to ${params.to}`);
    console.log(`📧 Subject: ${params.subject}`);
    console.log(`📧 From: ${params.from}`);
    return true; // Return success to prevent blocking app functionality
  }

  try {
    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      tracking_settings: {
        click_tracking: {
          enable: false,
          enable_text: false
        },
        open_tracking: {
          enable: false
        },
        subscription_tracking: {
          enable: false
        }
      }
    };

    if (params.text) {
      emailData.text = params.text;
    }
    
    if (params.html) {
      emailData.html = params.html;
    }

    await mailService.send(emailData);
    console.log(`✅ Email sent successfully via SendGrid to: ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
      
      // Check for specific SendGrid errors
      const errors = error.response.body.errors;
      for (const err of errors) {
        if (err.message && err.message.includes('does not match a verified Sender Identity')) {
          console.error('❌ SENDGRID ERROR: Sender email address not verified');
          console.error('📧 To fix this:');
          console.error('   1. Go to SendGrid dashboard');
          console.error('   2. Navigate to Settings > Sender Authentication');
          console.error('   3. Verify the sender email:', params.from);
          console.error('   4. Or use a verified sender email address');
        }
      }
    }
    
    // Development fallback: If in development and SendGrid fails, simulate successful email delivery
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Development mode: Simulating successful email delivery to ${params.to}`);
      console.log(`📧 Email subject: ${params.subject}`);
      console.log(`📧 From: ${params.from}`);
      return true; // Return true to simulate successful delivery
    }
    
    return false;
  }
}

export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
  baseUrl: string
): Promise<boolean> {
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your EventLink Account</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f8fafc;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 40px 20px; 
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
        }
        .logo { 
          margin: 0 auto 24px; 
          display: block;
        }
        h1 { 
          color: #1e293b; 
          font-size: 32px; 
          font-weight: 700; 
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }
        .content {
          text-align: center;
          padding: 0 20px;
        }
        .content p { 
          font-size: 16px; 
          line-height: 1.7; 
          margin-bottom: 24px; 
          color: #475569;
        }
        .button-container {
          margin: 40px 0;
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #D8690E 0%, #E97B24 100%);
          color: white !important; 
          padding: 16px 32px; 
          text-decoration: none; 
          border-radius: 12px; 
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(216, 105, 14, 0.3);
          transition: all 0.2s ease;
        }
        .button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(216, 105, 14, 0.4);
        }
        .link-text {
          font-size: 14px;
          color: #64748b;
          word-break: break-all;
          background-color: #f1f5f9;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin: 20px 0;
        }
        .warning {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
          color: #92400e;
          font-weight: 500;
        }
        .footer { 
          margin-top: 48px; 
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }
        .footer p {
          font-size: 14px; 
          color: #64748b;
          margin: 8px 0;
        }
        .footer .signature {
          font-weight: 600;
          color: #475569;
        }
        @media (max-width: 640px) {
          .container {
            margin: 0;
            border-radius: 0;
            padding: 20px;
          }
          h1 {
            font-size: 28px;
          }
          .button {
            padding: 14px 24px;
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="data:image/png;base64,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" alt="E8 Logo" style="width: 120px; aspect-ratio: 1/1; object-fit: contain; margin: 0 auto 20px; border-radius: 28px; box-shadow: 0 8px 20px rgba(216, 105, 14, 0.3); display: block;" />
          </div>
          <h1>Welcome to EventLink!</h1>
        </div>
        
        <div class="content">
          <p>Thank you for joining <strong>EventLink</strong>, the premier platform for event industry professionals.</p>
          
          <p>To complete your registration and start connecting with exciting opportunities, please verify your email address by clicking the button below:</p>
          
          <div class="button-container">
            <a href="${verificationUrl}" class="button" style="color: white !important; text-decoration: none !important; display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <div class="link-text">
            ${verificationUrl}
          </div>
          
          <div class="warning">
            <strong>⏰ This verification link will expire in 24 hours.</strong>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">If you didn't create an account with EventLink, you can safely ignore this email.</p>
        </div>
        
        <div class="footer">
          <p class="signature">Best regards,<br><strong>The EventLink Team</strong></p>
          <p>© 2025 EventLink. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Welcome to EventLink!

Thank you for joining EventLink, the premier platform for event industry professionals.

To complete your registration and start connecting with opportunities, please verify your email address by visiting:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with EventLink, you can safely ignore this email.

Best regards,
The EventLink Team

© 2025 EventLink. All rights reserved.
  `;

  // Use verified SendGrid sender address
  return await sendEmail({
    to: email,
    from: 'verification@eventlink.one', // Verified sender identity
    subject: 'Verify Your EventLink Account',
    html: htmlContent,
    text: textContent,

  });
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  baseUrl: string,
  firstName?: string | null
): Promise<boolean> {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Request – EventLink</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f8fafc;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 40px 20px; 
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
        }
        .logo { 
          margin: 0 auto 24px; 
          display: block;
        }
        h1 { 
          color: #1e293b; 
          font-size: 32px; 
          font-weight: 700; 
          margin: 0 0 16px 0;
          letter-spacing: -0.5px;
        }
        .content {
          text-align: center;
          padding: 0 20px;
        }
        .content p { 
          font-size: 16px; 
          line-height: 1.7; 
          margin-bottom: 24px; 
          color: #475569;
        }
        .button-container {
          margin: 40px 0;
        }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white !important; 
          padding: 16px 32px; 
          text-decoration: none; 
          border-radius: 12px; 
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          transition: all 0.2s ease;
        }
        .button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }
        .link-text {
          font-size: 14px;
          color: #64748b;
          word-break: break-all;
          background-color: #f1f5f9;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin: 20px 0;
        }
        .warning {
          background-color: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
          color: #92400e;
          font-weight: 500;
        }
        .footer { 
          margin-top: 48px; 
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }
        .footer p {
          font-size: 14px; 
          color: #64748b;
          margin: 8px 0;
        }
        .footer .signature {
          font-weight: 600;
          color: #475569;
        }
        @media (max-width: 640px) {
          .container {
            margin: 0;
            border-radius: 0;
            padding: 20px;
          }
          h1 {
            font-size: 28px;
          }
          .button {
            padding: 14px 24px;
            font-size: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="data:image/png;base64,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" alt="E8 Logo" style="width: 120px; aspect-ratio: 1/1; object-fit: contain; margin: 0 auto 20px; border-radius: 28px; box-shadow: 0 8px 20px rgba(216, 105, 14, 0.3); display: block;" />
          </div>
          <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>${firstName ? `Hi ${firstName},` : 'Hello,'}</p>
          
          <p>We received a request to reset your password for your <strong>EventLink</strong> account.</p>
          
          <p>To reset your password, click the button below:</p>
          
          <div class="button-container">
            <a href="${resetUrl}" class="button" style="color: white !important; text-decoration: none !important; display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);" target="_blank" rel="noopener noreferrer">Reset Password</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <div class="link-text">
            ${resetUrl}
          </div>
          
          <div class="warning">
            <strong>⏰ This link will expire in 1 hour.</strong>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
        
        <div class="footer">
          <p class="signature">Best regards,<br><strong>The EventLink Team</strong></p>
          <p>© 2025 EventLink. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Password Reset Request - EventLink

${firstName ? `Hi ${firstName},` : 'Hello,'}

We received a request to reset your password for your EventLink account.

To reset your password, visit this link:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The EventLink Team

© 2025 EventLink. All rights reserved.
  `;

  // Use verified SendGrid sender address
  return await sendEmail({
    to: email,
    from: 'verification@eventlink.one', // Verified sender identity
    subject: 'Password Reset Request – EventLink',
    html: htmlContent,
    text: textContent,

  });
}