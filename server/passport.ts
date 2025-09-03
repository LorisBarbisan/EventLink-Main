import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import { storage } from './storage';
import type { User } from '@shared/schema';

// Initialize passport
export function initializePassport() {
  // Serialize user for session storage
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy (only if credentials are available)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `https://${process.env.REPLIT_DOMAINS}/api/auth/google/callback`
    }, async (accessToken: any, refreshToken: any, profile: any, done: any) => {
      try {
        // Check if user already exists with Google ID
        const existingUser = await storage.getUserBySocialProvider('google', profile.id);
        
        if (existingUser) {
          // Update last login info
          await storage.updateUserLastLogin(existingUser.id, 'google');
          return done(null, existingUser);
        }

        // Check if user exists with same email
        const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (emailUser) {
          // Link Google account to existing email user
          await storage.linkSocialProvider(emailUser.id, 'google', profile.id, profile.photos?.[0]?.value);
          await storage.updateUserLastLogin(emailUser.id, 'google');
          return done(null, emailUser);
        }

        // Create new user with Google auth
        const newUser = await storage.createSocialUser({
          email: profile.emails?.[0]?.value || '',
          first_name: profile.name?.givenName,
          last_name: profile.name?.familyName,
          auth_provider: 'google',
          google_id: profile.id,
          profile_photo_url: profile.photos?.[0]?.value,
          email_verified: true, // Google accounts are pre-verified
          role: 'freelancer' as const, // Default role, can be changed later
        });

        await storage.updateUserLastLogin(newUser.id, 'google');
        return done(null, newUser);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error as Error, undefined);
      }
    }));
  }

  // Facebook OAuth Strategy (only if credentials are available)
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `https://${process.env.REPLIT_DOMAINS}/api/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'picture.type(large)']
    }, async (accessToken: any, refreshToken: any, profile: any, done: any) => {
      try {
        // Check if user already exists with Facebook ID
        const existingUser = await storage.getUserBySocialProvider('facebook', profile.id);
        
        if (existingUser) {
          await storage.updateUserLastLogin(existingUser.id, 'facebook');
          return done(null, existingUser);
        }

        // Check if user exists with same email
        const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (emailUser) {
          // Link Facebook account to existing email user
          await storage.linkSocialProvider(emailUser.id, 'facebook', profile.id, profile.photos?.[0]?.value);
          await storage.updateUserLastLogin(emailUser.id, 'facebook');
          return done(null, emailUser);
        }

        // Create new user with Facebook auth
        const newUser = await storage.createSocialUser({
          email: profile.emails?.[0]?.value || '',
          first_name: profile.name?.givenName,
          last_name: profile.name?.familyName,
          auth_provider: 'facebook',
          facebook_id: profile.id,
          profile_photo_url: profile.photos?.[0]?.value,
          email_verified: true, // Facebook accounts are pre-verified
          role: 'freelancer' as const, // Default role, can be changed later
        });

        await storage.updateUserLastLogin(newUser.id, 'facebook');
        return done(null, newUser);
      } catch (error) {
        console.error('Facebook OAuth error:', error);
        return done(error as Error, undefined);
      }
    }));
  }


  // LinkedIn OAuth Strategy (only if credentials are available)
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: `https://${process.env.REPLIT_DOMAINS}/api/auth/linkedin/callback`,
      scope: ['r_liteprofile', 'r_emailaddress']
    }, async (accessToken: any, refreshToken: any, profile: any, done: any) => {
      try {
        // Check if user already exists with LinkedIn ID
        const existingUser = await storage.getUserBySocialProvider('linkedin', profile.id);
        
        if (existingUser) {
          await storage.updateUserLastLogin(existingUser.id, 'linkedin');
          return done(null, existingUser);
        }

        // Check if user exists with same email
        const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (emailUser) {
          // Link LinkedIn account to existing email user
          await storage.linkSocialProvider(emailUser.id, 'linkedin', profile.id, profile.photos?.[0]?.value);
          await storage.updateUserLastLogin(emailUser.id, 'linkedin');
          return done(null, emailUser);
        }

        // Create new user with LinkedIn auth
        const newUser = await storage.createSocialUser({
          email: profile.emails?.[0]?.value || '',
          first_name: profile.name?.givenName,
          last_name: profile.name?.familyName,
          auth_provider: 'linkedin',
          linkedin_id: profile.id,
          profile_photo_url: profile.photos?.[0]?.value,
          email_verified: true, // LinkedIn accounts are pre-verified
          role: 'freelancer' as const, // Default role, can be changed later
        });

        await storage.updateUserLastLogin(newUser.id, 'linkedin');
        return done(null, newUser);
      } catch (error) {
        console.error('LinkedIn OAuth error:', error);
        return done(error as Error, undefined);
      }
    }));
  }
}