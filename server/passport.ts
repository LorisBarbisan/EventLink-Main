import passport from "passport";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import { storage } from "./storage";

// OAuth authentication strategies for Google, Facebook, and LinkedIn social login.
// Role selection is passed via OAuth state parameter from the signup form.

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

  // Google OAuth Strategy using raw OAuth2Strategy (same approach as LinkedIn)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID.trim();
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET.trim();
    console.log("Google OAuth config:", {
      clientIdLength: googleClientId.length,
      clientIdPrefix: googleClientId.substring(0, 20) + "...",
      secretLength: googleClientSecret.length,
      callbackURL: "https://eventlink.one/api/auth/google/callback",
    });

    const googleStrategy = new OAuth2Strategy(
      {
        authorizationURL: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenURL: "https://oauth2.googleapis.com/token",
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: "https://eventlink.one/api/auth/google/callback",
        scope: ["openid", "profile", "email"],
        passReqToCallback: true,
      },
      async (req: any, accessToken: any, refreshToken: any, params: any, profile: any, done: any) => {
        try {
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!userInfoRes.ok) {
            console.error("Google userinfo fetch failed:", userInfoRes.status, await userInfoRes.text());
            return done(new Error("Failed to fetch Google user info"), undefined);
          }
          const userInfo = await userInfoRes.json();
          console.log("Google userinfo received:", { sub: userInfo.sub, email: userInfo.email });

          const email = userInfo.email || "";
          if (!email) {
            return done(new Error("Email permission is required for registration"), undefined);
          }

          const googleId = userInfo.sub;
          const firstName = userInfo.given_name || "";
          const lastName = userInfo.family_name || "";
          const picture = userInfo.picture || "";

          let selectedRole: "freelancer" | "recruiter" = "freelancer";
          try {
            const state = req.query?.state;
            if (state) {
              const decoded = JSON.parse(Buffer.from(state, "base64").toString());
              if (decoded.role === "recruiter" || decoded.role === "freelancer") {
                selectedRole = decoded.role;
              }
            }
          } catch {}

          const existingUser = await storage.getUserBySocialProvider("google", googleId);

          if (existingUser) {
            await storage.updateUserLastLogin(existingUser.id, "google");
            return done(null, existingUser);
          }

          const emailUser = await storage.getUserByEmail(email);

          if (emailUser) {
            await storage.linkSocialProvider(emailUser.id, "google", googleId, picture);
            await storage.updateUserLastLogin(emailUser.id, "google");
            return done(null, emailUser);
          }

          const newUser = await storage.createSocialUser({
            email,
            first_name: firstName,
            last_name: lastName,
            auth_provider: "google",
            google_id: googleId,
            profile_photo_url: picture,
            email_verified: true,
            role: selectedRole,
          });

          await storage.updateUserLastLogin(newUser.id, "google");
          return done(null, newUser);
        } catch (error) {
          console.error("Google OAuth error:", error);
          return done(error as Error, undefined);
        }
      }
    );
    googleStrategy.name = "google";
    passport.use(googleStrategy);
  }

  // Facebook OAuth Strategy (only if credentials are available)
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: "https://eventlink.one/api/auth/facebook/callback",
          profileFields: ["id", "emails", "name", "picture.type(large)"],
        },
        async (accessToken: any, refreshToken: any, profile: any, done: any) => {
          try {
            // Check if user already exists with Facebook ID
            const existingUser = await storage.getUserBySocialProvider("facebook", profile.id);

            if (existingUser) {
              await storage.updateUserLastLogin(existingUser.id, "facebook");
              return done(null, existingUser);
            }

            // Check if user exists with same email
            const emailUser = await storage.getUserByEmail(profile.emails?.[0]?.value || "");

            if (emailUser) {
              // Link Facebook account to existing email user
              await storage.linkSocialProvider(
                emailUser.id,
                "facebook",
                profile.id,
                profile.photos?.[0]?.value
              );
              await storage.updateUserLastLogin(emailUser.id, "facebook");
              return done(null, emailUser);
            }

            // Create new user with Facebook auth
            const newUser = await storage.createSocialUser({
              email: profile.emails?.[0]?.value || "",
              first_name: profile.name?.givenName,
              last_name: profile.name?.familyName,
              auth_provider: "facebook",
              facebook_id: profile.id,
              profile_photo_url: profile.photos?.[0]?.value,
              email_verified: true, // Facebook accounts are pre-verified
              role: "freelancer" as const, // Default role, can be changed later
            });

            await storage.updateUserLastLogin(newUser.id, "facebook");
            return done(null, newUser);
          } catch (error) {
            console.error("Facebook OAuth error:", error);
            return done(error as Error, undefined);
          }
        }
      )
    );
  }

  // LinkedIn OAuth Strategy using OpenID Connect (only if credentials are available)
  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    const linkedInStrategy = new OAuth2Strategy(
      {
        authorizationURL: "https://www.linkedin.com/oauth/v2/authorization",
        tokenURL: "https://www.linkedin.com/oauth/v2/accessToken",
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: "https://eventlink.one/api/auth/linkedin/callback",
        scope: ["openid", "profile", "email"],
        passReqToCallback: true,
      },
      async (req: any, accessToken: any, refreshToken: any, params: any, profile: any, done: any) => {
        try {
          const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!userInfoRes.ok) {
            return done(new Error("Failed to fetch LinkedIn user info"), undefined);
          }
          const userInfo = await userInfoRes.json();

          let selectedRole: "freelancer" | "recruiter" = "freelancer";
          try {
            const state = req.query?.state;
            if (state) {
              const decoded = JSON.parse(Buffer.from(state, "base64").toString());
              if (decoded.role === "recruiter" || decoded.role === "freelancer") {
                selectedRole = decoded.role;
              }
            }
          } catch {}

          const linkedinId = userInfo.sub;
          const email = userInfo.email || "";
          const firstName = userInfo.given_name || "";
          const lastName = userInfo.family_name || "";
          const picture = userInfo.picture || "";

          const existingUser = await storage.getUserBySocialProvider("linkedin", linkedinId);

          if (existingUser) {
            await storage.updateUserLastLogin(existingUser.id, "linkedin");
            return done(null, existingUser);
          }

          const emailUser = await storage.getUserByEmail(email);

          if (emailUser) {
            await storage.linkSocialProvider(emailUser.id, "linkedin", linkedinId, picture);
            await storage.updateUserLastLogin(emailUser.id, "linkedin");
            return done(null, emailUser);
          }

          // New user — pass pending data back instead of creating account
          const pendingUser = {
            _isNewOAuthUser: true,
            email,
            first_name: firstName,
            last_name: lastName,
            auth_provider: "linkedin",
            provider_id: linkedinId,
            profile_photo_url: picture,
          };
          return done(null, pendingUser);
        } catch (error) {
          console.error("LinkedIn OAuth error:", error);
          return done(error as Error, undefined);
        }
      }
    );
    linkedInStrategy.name = "linkedin";
    passport.use(linkedInStrategy);
  }
}
