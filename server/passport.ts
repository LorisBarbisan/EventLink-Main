import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as AppleStrategy } from 'passport-apple';
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

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
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
      return done(error, null);
    }
  }));

  // Facebook OAuth Strategy
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID!,
    clientSecret: process.env.FACEBOOK_APP_SECRET!,
    callbackURL: "/api/auth/facebook/callback",
    profileFields: ['id', 'emails', 'name', 'picture.type(large)']
  }, async (accessToken, refreshToken, profile, done) => {
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
      return done(error, null);
    }
  }));

  // Apple OAuth Strategy  
  passport.use(new AppleStrategy({
    clientID: process.env.APPLE_CLIENT_ID!,
    teamID: process.env.APPLE_TEAM_ID!,
    keyID: process.env.APPLE_KEY_ID!,
    privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH!,
    callbackURL: "/api/auth/apple/callback",
    scope: ['name', 'email']
  }, async (accessToken, refreshToken, idToken, profile, done) => {
    try {
      // Apple provides user info differently
      const appleId = profile.id;
      const email = profile.email || idToken?.payload?.email;
      const firstName = profile.name?.firstName;
      const lastName = profile.name?.lastName;

      // Check if user already exists with Apple ID
      const existingUser = await storage.getUserBySocialProvider('apple', appleId);
      
      if (existingUser) {
        await storage.updateUserLastLogin(existingUser.id, 'apple');
        return done(null, existingUser);
      }

      // Check if user exists with same email (if provided)
      if (email) {
        const emailUser = await storage.getUserByEmail(email);
        
        if (emailUser) {
          // Link Apple account to existing email user
          await storage.linkSocialProvider(emailUser.id, 'apple', appleId);
          await storage.updateUserLastLogin(emailUser.id, 'apple');
          return done(null, emailUser);
        }
      }

      // Create new user with Apple auth
      const newUser = await storage.createSocialUser({
        email: email || `apple_${appleId}@eventlink.temp`, // Fallback for hidden email
        first_name: firstName,
        last_name: lastName,
        auth_provider: 'apple',
        apple_id: appleId,
        email_verified: true, // Apple accounts are pre-verified
        role: 'freelancer' as const, // Default role, can be changed later
      });

      await storage.updateUserLastLogin(newUser.id, 'apple');
      return done(null, newUser);
    } catch (error) {
      console.error('Apple OAuth error:', error);
      return done(error, null);
    }
  }));
}