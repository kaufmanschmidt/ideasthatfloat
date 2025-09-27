const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const allowedEmails =
  process.env.ALLOWED_GOOGLE_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) || [];

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value.toLowerCase();
      if (allowedEmails.length && !allowedEmails.includes(email)) {
        return done(null, false, { message: 'Unauthorized email' });
      }
      return done(null, { id: profile.id, displayName: profile.displayName, email });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));