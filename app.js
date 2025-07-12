const dotenv = require("dotenv");
dotenv.config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const logger = require("morgan");
const cors = require("cors");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const authRouter = require("./routes/auth");

const app = express();

// Enable CORS
app.use(cors());

// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

// Route middleware
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/auth", authRouter);

// ✅ MongoDB connection with proper error handling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb+srv://[your-connection-string]";
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1); // Exit process with failure
  }
};

connectDB();

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

process.on("SIGINT", async () => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed through app termination");
    process.exit(0);
  } catch (err) {
    console.error("Error during MongoDB disconnect:", err);
    process.exit(1);
  }
});

// ✅ Sample route to test connection
app.get("/api/products", (req, res) => {
  res.json([
    { id: 1, name: "Product A", price: 100 },
    { id: 2, name: "Product B", price: 150 }
  ]);
});

// ✅ POST route for frontend topic generation
app.post("/api/learn", (req, res) => {
  const { topic, level } = req.body;

  const tasks = [
    { id: 1, title: `${topic} - Introduction (${level})`, isDone: false, link: "" },
    { id: 2, title: `${topic} - Deep Dive (${level})`, isDone: false, link: "" },
    { id: 3, title: `${topic} - Final Notes (${level})`, isDone: false, link: "" }
  ];

  res.json({
    success: true,
    data: { tasks }
  });
});

// ❌ 404 handler
app.use(function (req, res, next) {
  next(createError(404));
});

// ✅ Error handler - return JSON instead of HTML
app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

module.exports = app;
