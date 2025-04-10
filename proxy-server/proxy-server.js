const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Proxy requests to Ollama
app.post("/api/generate", async (req, res) => {
  try {
    console.log("Received request body:", JSON.stringify(req.body, null, 2));

    // Check if prompt is empty
    if (!req.body.prompt || req.body.prompt.trim() === "") {
      console.error("Empty prompt received");
      return res.status(400).json({ error: "Prompt cannot be empty" });
    }

    // Prepare the payload for Ollama
    const ollamaPayload = {
      model: "llama3.2:1b", // or whatever model you're using
      prompt: req.body.prompt,
      stream: false,
    };

    console.log("Sending to Ollama:", JSON.stringify(ollamaPayload, null, 2));

    // Forward the request to Ollama
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      ollamaPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Ollama response:", JSON.stringify(response.data, null, 2));

    // Check if Ollama returned an empty response
    if (!response.data.response || response.data.response.trim() === "") {
      console.error("Ollama returned empty response");
      return res
        .status(500)
        .json({ error: "Ollama returned an empty response" });
    }

    // Return the response from Ollama
    res.json({ response: response.data.response });
  } catch (error) {
    console.error("Error proxying request to Ollama:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
