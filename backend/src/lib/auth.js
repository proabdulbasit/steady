const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const TOKEN_EXPIRES_IN = "7d";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET.");
  }
  return secret;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function verifyUserToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  hashPassword,
  comparePassword,
  signUserToken,
  verifyUserToken,
};
