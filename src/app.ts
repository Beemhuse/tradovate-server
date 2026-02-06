import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import authRoutes from "./routes/authRoutes";
import adminRoutes from "./routes/adminRoutes";
import marketRoutes from "./routes/marketRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import networkRoutes from "./routes/networkRoutes";
import kycRoutes from "./routes/kycRoutes";
import adminTransactionRoutes from "./routes/adminTransactionRoutes";
import userTransactionRoutes from "./routes/userTransactionRoutes";
import certificateRoutes from "./routes/adminCertRoutes";
import contactRoutes from "./routes/contactRoutes";
import supportRoutes from "./routes/supportRoutes";
import superAdminRoutes from "./routes/superAdminRoutes";

const app = express();

const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8082",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
  "https://tradovatefutures.com",
  "https://portal.tradovatefutures.com",
  "https://api.tradovatefutures.com",
];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server, curl, health checks
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// 🔥 REQUIRED FOR PREFLIGHT
app.options("*", cors());

app.use(express.json());

// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tradovate Admin API",
      version: "1.0.0",
      description: "API documentation for Tradovate Admin Server",
    },
    servers: [
      {
        url: "/api/v1",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API docs
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use("/api/v1/admin", dashboardRoutes);
app.use("/api/v1/certificates", certificateRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/market", marketRoutes);
app.use("/api/v1/network", networkRoutes);
app.use("/api/v1/kyc", kycRoutes);
app.use("/api/v1/admin/transactions", adminTransactionRoutes);
app.use("/api/v1/user/transactions", userTransactionRoutes);
app.use("/api/v1/contact", contactRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/v1/super-admin", superAdminRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
