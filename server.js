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

        // Get price data
        const response = await fetch(
            `https://public-api.birdeye.so/public/price?address=${address}`,
            {
                headers: {
                    'x-api-key': process.env.BIRDEYE_API_KEY,
                }
            }
        );
        const priceData = await response.json();
        console.log('Birdeye Price Data:', priceData);

        // Get liquidity and volume data
        const volumeResponse = await fetch(
            `https://public-api.birdeye.so/public/pool_summary?token_address=${address}`,
            {
                headers: {
                    'x-api-key': process.env.BIRDEYE_API_KEY,
                }
            }
        );
        const volumeData = await volumeResponse.json();
        console.log('Birdeye Volume Data:', volumeData);

        // Get holder data
        const holderResponse = await fetch(
            `https://public-api.birdeye.so/public/holder_count?address=${address}`,
            {
                headers: {
                    'x-api-key': process.env.BIRDEYE_API_KEY,
                }
            }
        );
        const holderData = await holderResponse.json();
        console.log('Birdeye Holder Data:', holderData);

        return {
            success: true,
            data: {
                price: priceData.data?.value || 0,
                priceChange24h: priceData.data?.priceChange24h || 0,
                volume24h: volumeData.data?.volume24h || 0,
                liquidity: volumeData.data?.liquidity || 0,
                holders: holderData.data?.holder_count || 0,
                marketCap: volumeData.data?.marketCap || 0,
                poolCount: volumeData.data?.poolCount || 0
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
    const liquidity = tokenData?.data?.liquidity || 0;
    if (liquidity > 500000) return 90; // Very high liquidity
    if (liquidity > 100000) return 80;
    if (liquidity > 50000) return 70;
    if (liquidity > 10000) return 60;
    return Math.max(50, Math.min(59, Math.floor((liquidity / 10000) * 59)));
}

function calculateVolumeScore(tokenData) {
    const volume = tokenData?.data?.volume24h || 0;
    if (volume > 1000000) return 90;
    if (volume > 100000) return 80;
    if (volume > 10000) return 70;
    if (volume > 1000) return 60;
    return Math.max(50, Math.min(59, Math.floor((volume / 1000) * 59)));
}

function calculateHolderScore(tokenData) {
    const holders = tokenData?.data?.holders || 0;
    if (holders > 5000) return 90;
    if (holders > 1000) return 80;
    if (holders > 500) return 70;
    if (holders > 100) return 60;
    return Math.max(50, Math.min(59, Math.floor((holders / 100) * 59)));
}

function calculateMarketCapScore(tokenData) {
    const marketCap = tokenData?.data?.marketCap || 0;
    if (marketCap > 10000000) return 90;
    if (marketCap > 1000000) return 80;
    if (marketCap > 100000) return 70;
    if (marketCap > 10000) return 60;
    return Math.max(50, Math.min(59, Math.floor((marketCap / 10000) * 59)));
}

function getSniffMessage(score) {
    if (score >= 90) return "WOOF! This one's a potential moonshot! 🚀🐕";
    if (score >= 80) return "Strong scent, looking promising! 🐾";
    if (score >= 70) return "Good boy vibes detected! 🦴";
    if (score >= 60) return "Decent sniff, might be worth watching! 🐕";
    return "Exercise caution, something smells fishy! 🐟";
}

app.post('/analyze', async (req, res) => {
    try {
        const { address } = req.body;
        console.log('\n--- New Analysis Request ---');
        console.log('Analyzing address:', address);

        try {
            new web3.PublicKey(address);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }

        const birdeyeData = await fetchBirdeyeTokenData(address);
        console.log('Full API Data:', { birdeyeData });

        const liquidityScore = calculateLiquidityScore(birdeyeData);
        const volumeScore = calculateVolumeScore(birdeyeData);
        const holderScore = calculateHolderScore(birdeyeData);
        const marketCapScore = calculateMarketCapScore(birdeyeData);

        const overallScore = Math.round(
            (liquidityScore * 0.3) +
            (volumeScore * 0.3) +
            (holderScore * 0.2) +
            (marketCapScore * 0.2)
        );

        const analysis = {
            score: overallScore,
            message: getSniffMessage(overallScore),
            metrics: {
                liquidityDepth: {
                    score: liquidityScore,
                    description: `Liquidity depth: $${(birdeyeData?.data?.liquidity || 0).toLocaleString()}`
                },
                holderDistribution: {
                    score: holderScore,
                    description: `Total holders: ${(birdeyeData?.data?.holders || 0).toLocaleString()}`
                },
                volumeMomentum: {
                    score: volumeScore,
                    description: `24h volume: $${(birdeyeData?.data?.volume24h || 0).toLocaleString()}`
                },
                marketMetrics: {
                    score: marketCapScore,
                    description: `Market Cap: $${(birdeyeData?.data?.marketCap || 0).toLocaleString()}`
                }
            },
            tokenData: {
                price: birdeyeData?.data?.price || 0,
                priceChange24h: birdeyeData?.data?.priceChange24h || 0,
                poolCount: birdeyeData?.data?.poolCount || 0
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
