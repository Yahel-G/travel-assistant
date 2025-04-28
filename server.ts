import express from "express";

const app = express();

app.get("/health", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Minimal server running on port ${port}`);
});
