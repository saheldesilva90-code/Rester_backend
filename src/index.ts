import express from "express";
import cors from "cors";
import { ENV } from "./config/env";

const app = express();

app.use(cors({ origin: ENV.APP_URL }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = ENV.PORT || 3000;

app.get("/", (req, res) => {
    res.json({ success: true })
});

app.listen(PORT, () => {
    console.log(`Rester API is up and running PORT ${PORT}`)
});