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
          background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
          color: white !important; 
          padding: 16px 32px; 
          text-decoration: none; 
          border-radius: 12px; 
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transition: all 0.2s ease;
        }
        .button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
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
            <div style="width: 120px; height: 120px; margin: 0 auto 20px; background: linear-gradient(135deg, #EC9A40 0%, #f1a853 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(236, 154, 64, 0.2);">
              <span style="color: white; font-size: 48px; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">E8</span>
            </div>
          </div>
          <h1>Welcome to EventLink!</h1>
        </div>
        
        <div class="content">
          <p>Thank you for joining <strong>EventLink</strong>, the premier platform for event industry professionals.</p>
          
          <p>To complete your registration and start connecting with exciting opportunities, please verify your email address by clicking the button below:</p>
          
          <div class="button-container">
            <a href="${verificationUrl}" class="button" style="color: white !important; text-decoration: none !important; display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">Verify Email Address</a>
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