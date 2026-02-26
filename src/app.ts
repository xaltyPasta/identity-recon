import express from "express";
import cors from "cors";
import identityRoutes from "./routes/identity.route"

const app = express();

app.use(cors());
app.use(express.json());

// Health Check Route
app.get("/", (_req, res) => {
    return res.status(200).json({
        success: true,
        message: "Service is running successfully. Please use the following endpoint to access the API:",
        apiEndpoint: "https://identity-recon.vercel.app/identify"
    });
});

app.use("/", identityRoutes);

export default app;
