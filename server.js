const express = require('express');
const cors = require('cors');
const web3 = require('@solana/web3.js');
const dotenv = require('dotenv');

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'SniffTools API is running!' });
});

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { address } = req.body;
    
    // For initial testing, return mock data
    const mockAnalysis = {
      score: 85,
      metrics: {
        liquidityDepth: { 
          score: 90, 
          description: "Strong liquidity pools" 
        },
        holderDistribution: { 
          score: 85, 
          description: "Well distributed tokens" 
        },
        volumeMomentum: { 
          score: 88, 
          description: "Growing trading volume" 
        },
        smartMoneyFlow: { 
          score: 82, 
          description: "Smart money accumulating" 
        },
        socialMetrics: { 
          score: 78, 
          description: "Active community" 
        }
      }
    };
    
    res.json(mockAnalysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
