const jwt = require("jsonwebtoken");

exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 🔥 WAJIB SET DEFAULT
  req.user = null;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next();
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, department_id }
  } catch (err) {
    req.user = null;
  }

  next();
};
