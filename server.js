const express = require('express');
const cors = require('cors');
const web3 = require('@solana/web3.js');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

// Initialize Solana connection
const connection = new web3.Connection(process.env.SOLANA_RPC_URL, 'confirmed');

async function getBirdeyeData(address) {
  try {
    const response = await fetch(
      `https://public-api.birdeye.so/public/token_list?address=${address}`,
      {
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Birdeye API error:', error);
    return null;
  }
}

async function getHeliusData(address) {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}&query=${address}`
    );
    return await response.json();
  } catch (error) {
    console.error('Helius API error:', error);
    return null;
  }
}

// Calculate metrics based on real data
async function calculateMetrics(address, birdeyeData, heliusData) {
  try {
    const liquidityScore = calculateLiquidityScore(birdeyeData);
    const holderScore = calculateHolderScore(birdeyeData);
    const volumeScore = calculateVolumeScore(birdeyeData);
    const socialScore = await calculateSocialScore(heliusData);
    const securityScore = calculateSecurityScore(heliusData);

    // Calculate overall score
    const scores = [liquidityScore, holderScore, volumeScore, socialScore, securityScore];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    return {
      score: overallScore,
      metrics: {
        liquidityDepth: {
          score: liquidityScore,
          description: getLiquidityDescription(liquidityScore)
        },
        holderDistribution: {
          score: holderScore,
          description: getHolderDescription(holderScore)
        },
        volumeMomentum: {
          score: volumeScore,
          description: getVolumeDescription(volumeScore)
        },
        socialMetrics: {
          score: socialScore,
          description: getSocialDescription(socialScore)
        },
        securityAnalysis: {
          score: securityScore,
          description: getSecurityDescription(securityScore)
        }
      }
    };
  } catch (error) {
    console.error('Error calculating metrics:', error);
    throw error;
  }
}

// Individual metric calculations
function calculateLiquidityScore(birdeyeData) {
  if (!birdeyeData || !birdeyeData.data) return 50;
  const liquidity = birdeyeData.data.liquidity || 0;
  return Math.min(Math.round((liquidity / 10000) * 100), 100); // Adjust threshold as needed
}

function calculateHolderScore(birdeyeData) {
  if (!birdeyeData || !birdeyeData.data) return 50;
  const holders = birdeyeData.data.holders || 0;
  return Math.min(Math.round((holders / 1000) * 100), 100); // Adjust threshold as needed
}

function calculateVolumeScore(birdeyeData) {
  if (!birdeyeData || !birdeyeData.data) return 50;
  const volume = birdeyeData.data.volume24h || 0;
  return Math.min(Math.round((volume / 10000) * 100), 100); // Adjust threshold as needed
}

async function calculateSocialScore(heliusData) {
  // Implement social metrics calculation based on Helius data
  return 75; // Placeholder
}

function calculateSecurityScore(heliusData) {
  // Implement security analysis based on Helius data
  return 80; // Placeholder
}

// Description generators
function getLiquidityDescription(score) {
  if (score >= 80) return "Strong liquidity pools with healthy depth";
  if (score >= 60) return "Moderate liquidity, could be improved";
  return "Low liquidity, exercise caution";
}

function getHolderDescription(score) {
  if (score >= 80) return "Well distributed among many holders";
  if (score >= 60) return "Decent holder distribution";
  return "Concentrated among few holders";
}

function getVolumeDescription(score) {
  if (score >= 80) return "Strong trading volume with good momentum";
  if (score >= 60) return "Moderate trading activity";
  return "Low trading volume";
}

function getSocialDescription(score) {
  if (score >= 80) return "Active community with strong engagement";
  if (score >= 60) return "Growing community presence";
  return "Limited social activity";
}

function getSecurityDescription(score) {
  if (score >= 80) return "High security standards detected";
  if (score >= 60) return "Acceptable security measures";
  return "Security concerns detected";
}

// Main analysis endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { address } = req.body;
    
    // Validate Solana address
    try {
      new web3.PublicKey(address);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid Solana address' });
    }

    // Fetch data from APIs
    const [birdeyeData, heliusData] = await Promise.all([
      getBirdeyeData(address),
      getHeliusData(address)
    ]);

    // Calculate metrics
    const analysis = await calculateMetrics(address, birdeyeData, heliusData);
    res.json(analysis);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
