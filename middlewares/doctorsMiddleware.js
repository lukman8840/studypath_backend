const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

module.exports.DoctorMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id;
    const user = await User.findById(userId);

    if (user.role !== "doctor") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only doctors can access this endpoint",
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
