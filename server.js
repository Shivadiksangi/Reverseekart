const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const requestRoutes = require("./routes/requestRoutes");

dotenv.config();

const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Serve the static frontend (optional convenience)
app.use(express.static(path.join(__dirname)));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "ReverseKart API" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/requests", requestRoutes);

// 404 for API
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// Error handler
app.use(errorHandler);

const PORT = Number(process.env.PORT || 5000);

async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Create a .env file (see .env.example).");
  }

  await connectDB();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ReverseKart API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

