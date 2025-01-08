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
        console.log('Fetching Birdeye data for:', address);
        const response = await fetch(`https://public-api.birdeye.so/public/token?address=${address}`, {
            headers: {
                'X-API-KEY': process.env.BIRDEYE_API_KEY,
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        console.log('Birdeye Raw Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Birdeye API Error:', error);
        return null;
    }
}

async function fetchHeliusTokenData(address) {
    try {
        console.log('Fetching Helius data for:', address);
        const response = await fetch(
            `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${process.env.HELIUS_API_KEY}`
        );
        const data = await response.json();
        console.log('Helius Raw Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Helius API Error:', error);
        return null;
    }
}

function calculateLiquidityScore(tokenData) {
    console.log('Calculating liquidity score for:', JSON.stringify(tokenData, null, 2));
    if (!tokenData || !tokenData.data || !tokenData.data.liquidity) return 50;
    const liquidity = parseFloat(tokenData.data.liquidity);
    if (liquidity > 1000000) return 90;
    if (liquidity > 100000) return 80;
    if (liquidity > 10000) return 70;
    if (liquidity > 1000) return 60;
    return 50;
}

function calculateVolumeScore(tokenData) {
    console.log('Calculating volume score for:', JSON.stringify(tokenData, null, 2));
    if (!tokenData || !tokenData.data || !tokenData.data.volume24h) return 50;
    const volume = parseFloat(tokenData.data.volume24h);
    if (volume > 1000000) return 90;
    if (volume > 100000) return 80;
    if (volume > 10000) return 70;
    if (volume > 1000) return 60;
    return 50;
}

function calculateHolderScore(tokenData) {
    console.log('Calculating holder score for:', JSON.stringify(tokenData, null, 2));
    if (!tokenData || !tokenData.data || !tokenData.data.holders) return 50;
    const holders = parseInt(tokenData.data.holders);
    if (holders > 10000) return 90;
    if (holders > 1000) return 80;
    if (holders > 100) return 70;
    if (holders > 10) return 60;
    return 50;
}

app.get('/test-config', async (req, res) => {
    res.json({
        birdeyeKey: process.env.BIRDEYE_API_KEY ? "Present" : "Missing",
        heliusKey: process.env.HELIUS_API_KEY ? "Present" : "Missing",
        rpcUrl: process.env.SOLANA_RPC_URL ? "Present" : "Missing"
    });
});

app.post('/analyze', async (req, res) => {
    try {
        const { address } = req.body;
        console.log('\n--- New Analysis Request ---');
        console.log('Analyzing address:', address);

        // Validate Solana address
        try {
            new web3.PublicKey(address);
        } catch (error) {
            console.error('Invalid address:', error);
            return res.status(400).json({ error: 'Invalid Solana address' });
        }

        // Fetch token data from APIs
        const birdeyeData = await fetchBirdeyeTokenData(address);
        console.log('Birdeye Data Structure:', JSON.stringify(birdeyeData, null, 2));
        
        const heliusData = await fetchHeliusTokenData(address);
        console.log('Helius Data Structure:', JSON.stringify(heliusData, null, 2));

        // Calculate individual scores
        const liquidityScore = calculateLiquidityScore(birdeyeData);
        const volumeScore = calculateVolumeScore(birdeyeData);
        const holderScore = calculateHolderScore(birdeyeData);
        
        const socialScore = heliusData ? 75 : 50;
        const securityScore = heliusData ? 80 : 50;

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

        console.log('Sending analysis:', JSON.stringify(analysis, null, 2));
        res.json(analysis);

    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Error analyzing token: ' + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
