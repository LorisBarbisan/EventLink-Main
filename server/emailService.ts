import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
      ? 'repl ' + process.env.REPL_IDENTITY 
      : process.env.WEB_REPL_RENEWAL 
      ? 'depl ' + process.env.WEB_REPL_RENEWAL 
      : null;

    if (!xReplitToken) {
      console.error('❌ X_REPLIT_TOKEN not found - REPL_IDENTITY and WEB_REPL_RENEWAL both missing');
      throw new Error('X_REPLIT_TOKEN not found for repl/depl');
    }

    console.log('📧 Fetching SendGrid credentials from connector...');
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      console.error(`❌ Connector API returned ${response.status}: ${response.statusText}`);
      throw new Error(`Connector API error: ${response.status}`);
    }

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings) {
      console.error('❌ No SendGrid connection found in connector response');
      console.error('Response data:', JSON.stringify(data, null, 2));
      throw new Error('SendGrid connection not found - please set up the SendGrid connector');
    }

    if (!connectionSettings.settings?.api_key) {
      console.error('❌ SendGrid connector missing api_key');
      throw new Error('SendGrid connector not properly configured - missing API key');
    }

    if (!connectionSettings.settings?.from_email) {
      console.error('❌ SendGrid connector missing from_email');
      throw new Error('SendGrid connector not properly configured - missing sender email');
    }

    console.log(`✅ SendGrid credentials fetched successfully - sender: ${connectionSettings.settings.from_email}`);
    return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
  } catch (error: any) {
    console.error('❌ Failed to get SendGrid credentials:', error.message);
    throw error;
  }
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

interface EmailParams {
  to: string;
  from?: string; // Optional - will use connector's verified email if not provided
  subject: string;
  text?: string;
  html?: string;
}

// Enhanced email validation
function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // Validate email address
  if (!validateEmailAddress(params.to)) {
    const error = new Error(`Invalid email address: ${params.to}`);
    console.error(`❌ ${error.message}`);
    throw error;
  }

  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    
    // Use connector's verified email as sender
    const senderEmail = params.from || fromEmail;

    const emailData: any = {
      to: params.to,
      from: {
        email: senderEmail,
        name: 'EventLink Team'
      },
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
      },
      mail_settings: {
        spam_check: {
          enable: false
        },
        sandbox_mode: {
          enable: false
        }
      },
      headers: {
        'X-Auto-Response-Suppress': 'All',
        'X-Entity-Ref-ID': `eventlink-${Date.now()}`
      },
      categories: ['eventlink-platform']
    };

    if (params.text) {
      emailData.text = params.text;
    }

    if (params.html) {
      emailData.html = params.html;
    }

    await client.send(emailData);
    console.log(`✅ Email sent successfully via SendGrid to: ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('📧 SendGrid send error:', error?.message || error);
    
    // Enhanced error logging for debugging
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
    }
    
    // Re-throw the error so calling code can handle it
    throw error;
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
          color: #d97706;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #d97706;
          margin: 24px 0;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
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
            <img src="${baseUrl.replace(/\/$/, '')}/e8-logo.png" width="64" height="64" alt="EventLink Logo" style="display: block; margin: 0 auto 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(216, 105, 14, 0.3);" />
          </div>
          <h1>Welcome to EventLink!</h1>
        </div>
        
        <div class="content">
          <p><strong>Thank you for joining EventLink</strong>, the premier platform for event industry professionals.</p>
          
          <p>To complete your registration and start connecting with exciting opportunities, please verify your email address by clicking the button below:</p>
          
          <div class="button-container">
            <a href="${verificationUrl}" style="color: #ffffff; text-decoration: none; display: inline-block; background-color: #D8690E; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; font-family: Arial, sans-serif;" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
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

  return await sendEmail({
    to: email,
    subject: 'Complete Your EventLink Registration - Verification Required',
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
          color: #d97706;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #d97706;
          margin: 24px 0;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
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
            <img src="${baseUrl.replace(/\/$/, '')}/e8-logo.png" width="64" height="64" alt="EventLink Logo" style="display: block; margin: 0 auto 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(216, 105, 14, 0.3);" />
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

  return await sendEmail({
    to: email,
    subject: 'Password Reset Request – EventLink',
    html: htmlContent,
    text: textContent,
  });
}

export async function sendContactReplyEmail(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
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
          padding: 0 20px;
        }
        .content p { 
          font-size: 16px; 
          line-height: 1.7; 
          margin-bottom: 24px; 
          color: #475569;
          white-space: pre-wrap;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid #e2e8f0;
          color: #64748b;
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
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">
            <img src="https://eventlink.one/e8-logo.png" width="64" height="64" alt="EventLink Logo" style="display: block; margin: 0 auto 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(216, 105, 14, 0.3);" />
          </div>
          <h1>EventLink Support</h1>
        </div>
        
        <div class="content">
          <p>${message}</p>
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
EventLink Support

${message}

Best regards,
The EventLink Team

© 2025 EventLink. All rights reserved.
  `;

  return await sendEmail({
    to,
    subject,
    html: htmlContent,
    text: textContent,
  });
}
