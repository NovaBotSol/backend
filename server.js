const express = require('express');
const cors = require('cors');
const web3 = require('@solana/web3.js');
const dotenv = require('dotenv');

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

// Initialize Solana connection
const connection = new web3.Connection(
  process.env.SOLANA_RPC_URL,
  'confirmed'
);

async function getTokenMetrics(address) {
  try {
    const publicKey = new web3.PublicKey(address);
    
    // Get token data from Birdeye
    const birdeyeData = await fetch(
      `https://public-api.birdeye.so/public/token_list?address=${address}`,
      {
        headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY }
      }
    ).then(res => res.json());

    // Get Helius data
    const heliusData = await fetch(
      `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}&query=${address}`
    ).then(res => res.json());

    // Calculate metrics
    const metrics = {
      liquidityDepth: calculateLiquidityScore(birdeyeData),
      holderDistribution: calculateHolderScore(birdeyeData),
      volumeMomentum: calculateVolumeScore(birdeyeData),
      // ... other metrics
    };

    return metrics;
  } catch (error) {
    console.error('Error analyzing token:', error);
    throw error;
  }
}

app.post('/analyze', async (req, res) => {
  try {
    const { address } = req.body;
    const metrics = await getTokenMetrics(address);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
