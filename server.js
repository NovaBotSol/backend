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
        // First, get token data
        const tokenResponse = await fetch(`https://public-api.birdeye.so/public/token_list/all?offset=0&limit=1&sort_by=v24h&sort_type=desc`, {
            headers: {
                'X-API-KEY': process.env.BIRDEYE_API_KEY
            }
        });
        const tokenData = await tokenResponse.json();
        console.log('Birdeye Token Data:', tokenData);

        // Then get volume data
        const volumeResponse = await fetch(`https://public-api.birdeye.so/public/stats_history/volume?address=${address}&type=24h&limit=2`, {
            headers: {
                'X-API-KEY': process.env.BIRDEYE_API_KEY
            }
        });
        const volumeData = await volumeResponse.json();
        console.log('Birdeye Volume Data:', volumeData);

        return {
            success: true,
            data: {
                token: tokenData.data?.[0] || {},
                volume: volumeData.data || {},
                liquidity: tokenData.data?.[0]?.liquidity || 0,
                holders: tokenData.data?.[0]?.holder || 0,
                volume24h: volumeData.data?.[0]?.value || 0
            }
        };
    } catch (error) {
        console.error('Birdeye API Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function fetchHeliusTokenData(address) {
    try {
        console.log('Fetching Helius data for:', address);
        const response = await fetch(
            `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_API_KEY}&query=${address}`
        );
        const data = await response.json();
        console.log('Helius Raw Response:', data);
        return data;
    } catch (error) {
        console.error('Helius API Error:', error);
        return null;
    }
}

function calculateLiquidityScore(tokenData) {
    console.log('Calculating liquidity score for:', tokenData);
    const liquidity = tokenData?.data?.liquidity || 0;
    if (liquidity > 1000000) return 90;
    if (liquidity > 100000) return 80;
    if (liquidity > 10000) return 70;
    if (liquidity > 1000) return 60;
    return 50;
}

function calculateVolumeScore(tokenData) {
    console.log('Calculating volume score for:', tokenData);
    const volume = tokenData?.data?.volume24h || 0;
    if (volume > 1000000) return 90;
    if (volume > 100000) return 80;
    if (volume > 10000) return 70;
    if (volume > 1000) return 60;
    return 50;
}

function calculateHolderScore(tokenData) {
    console.log('Calculating holder score for:', tokenData);
    const holders = tokenData?.data?.holders || 0;
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
        const [birdeyeData, heliusData] = await Promise.all([
            fetchBirdeyeTokenData(address),
            fetchHeliusTokenData(address)
        ]);

        console.log('Full API Data:', { birdeyeData, heliusData });

        // Calculate individual scores
        const liquidityScore = calculateLiquidityScore(birdeyeData);
        const volumeScore = calculateVolumeScore(birdeyeData);
        const holderScore = calculateHolderScore(birdeyeData);
        
        // Implement real metrics for these based on Helius data
        const socialScore = heliusData?.tokens?.length > 0 ? 75 : 50;
        const securityScore = heliusData?.tokens?.length > 0 ? 80 : 50;

        // Calculate overall score with weighted averages
        const overallScore = Math.round(
            (liquidityScore * 0.3) + // 30% weight to liquidity
            (volumeScore * 0.25) +   // 25% weight to volume
            (holderScore * 0.25) +   // 25% weight to holders
            (socialScore * 0.1) +    // 10% weight to social
            (securityScore * 0.1)    // 10% weight to security
        );

        const analysis = {
            score: overallScore,
            metrics: {
                liquidityDepth: {
                    score: liquidityScore,
                    description: `Liquidity depth: ${birdeyeData?.data?.liquidity || 0} USD`
                },
                holderDistribution: {
                    score: holderScore,
                    description: `Total holders: ${birdeyeData?.data?.holders || 0}`
                },
                volumeMomentum: {
                    score: volumeScore,
                    description: `24h volume: ${birdeyeData?.data?.volume24h || 0} USD`
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

        console.log('Sending analysis:', analysis);
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
