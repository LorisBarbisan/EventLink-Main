import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
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
      <title>Verify Your E8 Account</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 120px; height: 120px; margin: 0 auto 20px; }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          color: white; 
          padding: 12px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: bold;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <div style="width: 120px; height: 120px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 48px; font-weight: bold;">E8</div>
          </div>
          <h1>Welcome to E8!</h1>
        </div>
        
        <p>Thank you for joining E8, the premier platform for event industry professionals.</p>
        
        <p>To complete your registration and start connecting with opportunities, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        
        <p><strong>This verification link will expire in 24 hours.</strong></p>
        
        <p>If you didn't create an account with E8, you can safely ignore this email.</p>
        
        <div class="footer">
          <p>Best regards,<br>The E8 Team</p>
          <p>© 2024 E8. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Welcome to E8!

Thank you for joining E8, the premier platform for event industry professionals.

To complete your registration and start connecting with opportunities, please verify your email address by visiting:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with E8, you can safely ignore this email.

Best regards,
The E8 Team

© 2024 E8. All rights reserved.
  `;

  // Try different sender addresses - SendGrid requires verified sender identity
  const senderAddresses = [
    'noreply@replit.dev', // Replit's verified domain
    'test@example.com',   // Common test address
    'noreply@sendgrid.net' // SendGrid's own domain
  ];
  
  for (const fromAddress of senderAddresses) {
    const success = await sendEmail({
      to: email,
      from: fromAddress,
      subject: 'Verify Your E8 Account',
      html: htmlContent,
      text: textContent,
    });
    
    if (success) {
      console.log(`Email sent successfully using from address: ${fromAddress}`);
      return true;
    }
  }
  
  console.log('All sender addresses failed.');
  return false;
}