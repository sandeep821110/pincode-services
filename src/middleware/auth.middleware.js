import jwt from "jsonwebtoken";

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

export const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.split(" ")[1] : req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized", code: "NO_TOKEN" });
  }

  try {
    const decoded = jwt.verify(token, getAccessSecret());

    const userId = decoded.id || decoded.userId;
    if (!decoded || !userId) {
      return res.status(401).json({ success: false, message: "Invalid token payload", code: "INVALID_PAYLOAD" });
    }

    req.user = {
      id: userId,
      email: decoded.email || null,
      role: decoded.role || "user",
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    res.status(401).json({ success: false, message: "Invalid token", code: "INVALID_TOKEN" });
  }
};
