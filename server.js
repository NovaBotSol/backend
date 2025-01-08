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
        
        // Get all pools for the token
        const poolsResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const poolsData = await poolsResponse.json();
        console.log('DexScreener Pools Data:', poolsData);

        // Get token metadata
        const metaResponse = await fetch(`https://api.dexscreener.com/latest/dex/meta/solana/${address}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const metaData = await metaResponse.json();
        console.log('DexScreener Meta Data:', metaData);

        // Calculate total liquidity and volume from all pools
        let totalLiquidity = 0;
        let totalVolume = 0;
        let holders = 0;
        let price = 0;

        if (poolsData.pairs && poolsData.pairs.length > 0) {
            poolsData.pairs.forEach(pair => {
                totalLiquidity += parseFloat(pair.liquidity?.usd || 0);
                totalVolume += parseFloat(pair.volume?.h24 || 0);
                price = parseFloat(pair.priceUsd || 0);
            });

            // If there's token metadata, use it
            if (metaData.pairs && metaData.pairs.length > 0) {
                holders = parseInt(metaData.pairs[0].holders || 0);
            }
        }

        return {
            success: true,
            data: {
                liquidity: totalLiquidity,
                volume: totalVolume,
                holders: holders,
                price: price,
                pairs: poolsData.pairs || []
            }
        };
    } catch (error) {
        console.error('DexScreener API Error:', error);
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
            `https://api.helius.xyz/v0/tokens/metadata?api-key=${process.env.HELIUS_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mintAccounts: [address],
                    includeOffChain: true
                })
            }
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
    const volume = tokenData?.data?.volume || 0;
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

function calculatePairScore(tokenData) {
    const pairs = tokenData?.data?.pairs || [];
    const pairCount = pairs.length;
    if (pairCount >= 5) return 90;
    if (pairCount >= 3) return 80;
    if (pairCount >= 2) return 70;
    if (pairCount >= 1) return 60;
    return 50;
}

function calculateSocialScore(heliusData) {
    const metadata = heliusData?.[0];
    if (!metadata) return 50;
    
    let score = 50;
    
    if (metadata.offChainMetadata) {
        const { description, image, externalUrl } = metadata.offChainMetadata;
        if (description) score += 10;
        if (image) score += 10;
        if (externalUrl) score += 10;
    }

    if (metadata.onChainData && metadata.onChainData.data) {
        score += 20;
    }
    
    return Math.min(score, 100);
}

app.post('/analyze', async (req, res) => {
    try {
        const { address } = req.body;
        console.log('\n--- New Analysis Request ---');
        console.log('Analyzing address:', address);

        try {
            new web3.PublicKey(address);
        } catch (error) {
            console.error('Invalid address:', error);
            return res.status(400).json({ error: 'Invalid Solana address' });
        }

        const [dexData, heliusData] = await Promise.all([
            fetchBirdeyeTokenData(address),
            fetchHeliusTokenData(address)
        ]);

        console.log('Full API Data:', { dexData, heliusData });

        const liquidityScore = calculateLiquidityScore(dexData);
        const volumeScore = calculateVolumeScore(dexData);
        const holderScore = calculateHolderScore(dexData);
        const pairScore = calculatePairScore(dexData);
        const socialScore = calculateSocialScore(heliusData);

        const overallScore = Math.round(
            (liquidityScore * 0.25) +
            (volumeScore * 0.25) +
            (holderScore * 0.2) +
            (pairScore * 0.15) +
            (socialScore * 0.15)
        );

        const analysis = {
            score: overallScore,
            metrics: {
                liquidityDepth: {
                    score: liquidityScore,
                    description: `Liquidity depth: $${(dexData?.data?.liquidity || 0).toLocaleString()}`
                },
                holderDistribution: {
                    score: holderScore,
                    description: `Total holders: ${(dexData?.data?.holders || 0).toLocaleString()}`
                },
                volumeMomentum: {
                    score: volumeScore,
                    description: `24h volume: $${(dexData?.data?.volume || 0).toLocaleString()}`
                },
                dexPairs: {
                    score: pairScore,
                    description: `Active DEX pairs: ${(dexData?.data?.pairs || []).length}`
                },
                socialMetrics: {
                    score: socialScore,
                    description: `Token metadata and social presence`
                }
            },
            tokenData: {
                price: dexData?.data?.price || 0,
                pairs: dexData?.data?.pairs || []
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
