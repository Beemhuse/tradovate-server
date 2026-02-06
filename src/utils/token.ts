import jwt, { JwtPayload } from "jsonwebtoken";

const ACCESS_TOKEN_SECRET =
  process.env.JWT_SECRET || "default_access_secret";

const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET || "default_refresh_secret";

/* ===============================
   Token Payload Type
================================ */
export interface TokenPayload extends JwtPayload {
  userId: string;
  role?: string;
  tokenVersion: number;
}

/* ===============================
   Generate Tokens
================================ */
export const generateTokens = (
  userId: string,
  role: string,
  tokenVersion: number
) => {
  const accessToken = jwt.sign(
    { userId, role, tokenVersion },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "2h" }
  );

  const refreshToken = jwt.sign(
    { userId, tokenVersion },
    REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

/* ===============================
   Verify Access Token
================================ */
export const verifyAccessToken = (
  token: string
): TokenPayload | null => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
  } catch {
    return null;
  }
};

/* ===============================
   Verify Refresh Token
================================ */
export const verifyRefreshToken = (
  token: string
): TokenPayload | null => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;
  } catch {
    return null;
  }
};
