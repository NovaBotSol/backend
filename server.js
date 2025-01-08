// backend/server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const web3 = require('@solana/web3.js');

const app = express();
dotenv.config();

app.use(cors());
app.use(express.json());

// Basic endpoint to test server
app.get('/', (req, res) => {
  res.json({ message: 'SniffTools API is running!' });
});

// Analyze token endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { address } = req.body;
    // Token analysis logic will go here
    res.json({ message: `Analyzing token: ${address}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
