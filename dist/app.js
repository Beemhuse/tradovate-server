"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const marketRoutes_1 = __importDefault(require("./routes/marketRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const networkRoutes_1 = __importDefault(require("./routes/networkRoutes"));
const kycRoutes_1 = __importDefault(require("./routes/kycRoutes"));
const adminTransactionRoutes_1 = __importDefault(require("./routes/adminTransactionRoutes"));
const userTransactionRoutes_1 = __importDefault(require("./routes/userTransactionRoutes"));
const adminCertRoutes_1 = __importDefault(require("./routes/adminCertRoutes"));
const contactRoutes_1 = __importDefault(require("./routes/contactRoutes"));
const supportRoutes_1 = __importDefault(require("./routes/supportRoutes"));
const app = (0, express_1.default)();
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow server-to-server, curl, health checks
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.error("❌ Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
// 🔥 REQUIRED FOR PREFLIGHT
app.options("*", (0, cors_1.default)());
app.use(express_1.default.json());
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
const swaggerSpecs = (0, swagger_jsdoc_1.default)(swaggerOptions);
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpecs));
// Routes
app.use("/api/v1/admin", dashboardRoutes_1.default);
app.use("/api/v1/certificates", adminCertRoutes_1.default);
app.use("/api/v1/auth", authRoutes_1.default);
app.use("/api/v1/admin", adminRoutes_1.default);
app.use("/api/v1/market", marketRoutes_1.default);
app.use("/api/v1/network", networkRoutes_1.default);
app.use("/api/v1/kyc", kycRoutes_1.default);
app.use("/api/v1/admin/transactions", adminTransactionRoutes_1.default);
app.use("/api/v1/user/transactions", userTransactionRoutes_1.default);
app.use("/api/v1/contact", contactRoutes_1.default);
app.use("/api/v1/support", supportRoutes_1.default);
// Health Check
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
exports.default = app;
