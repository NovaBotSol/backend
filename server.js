const express = require('express');
const cors = require('cors');
const web3 = require('@solana/web3.js');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

async function fetchBirdeyeTokenData(address) {
    try {
        const response = await fetch(`https://public-api.birdeye.so/public/token?address=${address}`, {
            headers: {
                'X-API-KEY': process.env.BIRDEYE_API_KEY
            }
        });
        const data = await response.json();
        console.log('Birdeye Data:', data);  // Debug log
        return data;
    } catch (error) {
        console.error('Birdeye API Error:', error);
        return null;
    }
}

async function fetchHeliusTokenData(address) {
    try {
        const response = await fetch(
            `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}&query=${address}`
        );
        const data = await response.json();
        console.log('Helius Data:', data);  // Debug log
        return data;
    } catch (error) {
        console.error('Helius API Error:', error);
        return null;
    }
}

function calculateLiquidityScore(tokenData) {
    if (!tokenData || !tokenData.liquidity) return 50;
    const liquidity = parseFloat(tokenData.liquidity);
    // Score based on liquidity depth
    if (liquidity > 1000000) return 90;
    if (liquidity > 100000) return 80;
    if (liquidity > 10000) return 70;
    if (liquidity > 1000) return 60;
    return 50;
}

function calculateVolumeScore(tokenData) {
    if (!tokenData || !tokenData.volume24h) return 50;
    const volume = parseFloat(tokenData.volume24h);
    // Score based on 24h volume
    if (volume > 1000000) return 90;
    if (volume > 100000) return 80;
    if (volume > 10000) return 70;
    if (volume > 1000) return 60;
    return 50;
}

function calculateHolderScore(tokenData) {
    if (!tokenData || !tokenData.holders) return 50;
    const holders = parseInt(tokenData.holders);
    // Score based on number of holders
    if (holders > 10000) return 90;
    if (holders > 1000) return 80;
    if (holders > 100) return 70;
    if (holders > 10) return 60;
    return 50;
}

app.post('/analyze', async (req, res) => {
    try {
        const { address } = req.body;
        console.log('Analyzing address:', address);  // Debug log

        // Validate Solana address
        try {
            new web3.PublicKey(address);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }

        // Fetch token data from APIs
        const [birdeyeData, heliusData] = await Promise.all([
            fetchBirdeyeTokenData(address),
            fetchHeliusTokenData(address)
        ]);

        // Calculate individual scores
        const liquidityScore = calculateLiquidityScore(birdeyeData);
        const volumeScore = calculateVolumeScore(birdeyeData);
        const holderScore = calculateHolderScore(birdeyeData);
        
        // Calculate social and security scores based on available data
        const socialScore = heliusData ? 75 : 50;  // Placeholder
        const securityScore = heliusData ? 80 : 50;  // Placeholder

        // Calculate overall score
        const overallScore = Math.round(
            (liquidityScore + volumeScore + holderScore + socialScore + securityScore) / 5
        );

        const analysis = {
            score: overallScore,
            metrics: {
                liquidityDepth: {
                    score: liquidityScore,
                    description: `Liquidity analysis based on pool depth and distribution`
                },
                holderDistribution: {
                    score: holderScore,
                    description: `Analysis of holder distribution and concentration`
                },
                volumeMomentum: {
                    score: volumeScore,
                    description: `24h volume analysis and trading patterns`
                },
                socialMetrics: {
                    score: socialScore,
                    description: `Community engagement and social presence`
                },
                securityAnalysis: {
                    score: securityScore,
                    description: `Contract security and risk assessment`
                }
            }
        };

        console.log('Analysis result:', analysis);  // Debug log
        res.json(analysis);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Error analyzing token' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
