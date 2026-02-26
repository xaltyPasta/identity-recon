import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Health Check Route
app.get("/", (_req, res) => {
    return res.status(200).json({
        success: true,
        message: "Service is Running"
    });
});


export default app;
