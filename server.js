const express = require('express');
const cors = require('cors');
const web3 = require('@solana/web3.js');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

async function fetchTokenData(address) {
    try {
        console.log('Fetching Jupiter data for:', address);

        // Get token info from Jupiter
        const response = await fetch(
            `https://price.jup.ag/v4/token/${address}`
        );
        const priceData = await response.json();
        console.log('Jupiter Price Data:', priceData);

        // Get token metadata from Jupiter
        const metaResponse = await fetch(
            `https://token.jup.ag/all`
        );
        const metaData = await metaResponse.json();
        console.log('Jupiter Token List Data:', metaData);

        // Find token in metadata
        const tokenInfo = metaData.tokens.find(t => t.address === address);
        console.log('Token Info:', tokenInfo);

        // Get raydium pools
        const poolsResponse = await fetch(
            `https://api.raydium.io/v2/main/pairs`
        );
        const poolsData = await poolsResponse.json();
        console.log('Raydium Pools Data:', poolsData);

        // Find relevant pools
        const relevantPools = poolsData.filter(pool => 
            pool.baseMint === address || pool.quoteMint === address
        );

        // Calculate total liquidity and volume
        let totalLiquidity = 0;
        let totalVolume = 0;
        relevantPools.forEach(pool => {
            totalLiquidity += parseFloat(pool.liquidity || 0);
            totalVolume += parseFloat(pool.volume24h || 0);
        });

        return {
            success: true,
            data: {
                price: priceData.data.price || 0,
                volume24h: totalVolume,
                liquidity: totalLiquidity,
                holders: tokenInfo?.holder_count || 0,
                marketCap: (priceData.data.price || 0) * (tokenInfo?.supply || 0),
                poolCount: relevantPools.length,
                tokenInfo: {
                    name: tokenInfo?.name,
                    symbol: tokenInfo?.symbol,
                    decimals: tokenInfo?.decimals,
                    totalSupply: tokenInfo?.supply
                },
                pools: relevantPools.map(pool => ({
                    address: pool.ammId,
                    liquidity: pool.liquidity,
                    volume24h: pool.volume24h,
                    price: pool.price
                }))
            }
        };
    } catch (error) {
        console.error('API Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function calculateLiquidityScore(tokenData) {
    const liquidity = tokenData?.data?.liquidity || 0;
    if (liquidity > 500000) return 90;
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

function calculatePoolScore(tokenData) {
    const poolCount = tokenData?.data?.poolCount || 0;
    if (poolCount >= 3) return 90;
    if (poolCount === 2) return 80;
    if (poolCount === 1) return 70;
    return 50;
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

        const tokenData = await fetchTokenData(address);
        console.log('Full API Data:', { tokenData });

        const liquidityScore = calculateLiquidityScore(tokenData);
        const volumeScore = calculateVolumeScore(tokenData);
        const poolScore = calculatePoolScore(tokenData);
        const marketCapScore = calculateMarketCapScore(tokenData);

        const overallScore = Math.round(
            (liquidityScore * 0.3) +
            (volumeScore * 0.3) +
            (poolScore * 0.2) +
            (marketCapScore * 0.2)
        );

        const analysis = {
            score: overallScore,
            message: getSniffMessage(overallScore),
            metrics: {
                liquidityDepth: {
                    score: liquidityScore,
                    description: `Liquidity depth: $${(tokenData?.data?.liquidity || 0).toLocaleString()}`
                },
                poolDiversity: {
                    score: poolScore,
                    description: `Active pools: ${(tokenData?.data?.poolCount || 0)}`
                },
                volumeMomentum: {
                    score: volumeScore,
                    description: `24h volume: $${(tokenData?.data?.volume24h || 0).toLocaleString()}`
                },
                marketMetrics: {
                    score: marketCapScore,
                    description: `Market Cap: $${(tokenData?.data?.marketCap || 0).toLocaleString()}`
                }
            },
            tokenData: {
                name: tokenData?.data?.tokenInfo?.name,
                symbol: tokenData?.data?.tokenInfo?.symbol,
                price: tokenData?.data?.price || 0,
                totalSupply: tokenData?.data?.tokenInfo?.totalSupply,
                pools: tokenData?.data?.pools || []
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
