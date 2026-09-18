/**
 * Passport configuration — Google OAuth 2.0 login.
 *
 * Flow:
 *  1. Customer clicks "Continue with Google" -> GET /api/auth/google
 *  2. Google redirects back -> GET /api/auth/google/callback
 *  3. Strategy below finds-or-creates a User by googleId/email
 *  4. Controller issues our own JWT (see auth.controller.js) and redirects
 *     back to the frontend — we do NOT rely on Passport sessions for the
 *     rest of the app, only for this handshake.
 */
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // If a customer already registered with email/password using the
          // same email, link the Google account instead of creating a duplicate.
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            user.googleId = profile.id;
            user.authProvider = "google";
            await user.save();
          } else {
            user = await User.create({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              authProvider: "google",
              avatar: profile.photos?.[0]?.value,
            });
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Required by Passport even though we issue our own JWTs afterwards —
// only used during the brief OAuth handshake itself.
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
