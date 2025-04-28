"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.get("/health", (req, res) => {
    res.status(200).json({ status: "Server is running" });
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Minimal server running on port ${port}`);
});
