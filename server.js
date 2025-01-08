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
       
       // Get token info
       const tokenResponse = await fetch(`https://public-api.birdeye.so/public/defi/token_info?address=${address}`, {
           headers: {
               'X-API-KEY': process.env.BIRDEYE_API_KEY
           }
       });
       const tokenData = await tokenResponse.json();
       console.log('Birdeye Token Info:', tokenData);

       // Get price info
       const priceResponse = await fetch(`https://public-api.birdeye.so/public/defi/price?address=${address}`, {
           headers: {
               'X-API-KEY': process.env.BIRDEYE_API_KEY
           }
       });
       const priceData = await priceResponse.json();
       console.log('Birdeye Price Data:', priceData);

       // Get 24h stats
       const statsResponse = await fetch(`https://public-api.birdeye.so/public/defi/stats_24h?address=${address}`, {
           headers: {
               'X-API-KEY': process.env.BIRDEYE_API_KEY
           }
       });
       const statsData = await statsResponse.json();
       console.log('Birdeye 24h Stats:', statsData);

       // Combine all data
       return {
           success: true,
           data: {
               market: tokenData.data || {},
               volume: statsData.data?.volume24h || 0,
               liquidity: tokenData.data?.liquidity || 0,
               holders: tokenData.data?.holderCount || 0,
               price: priceData.data?.value || 0,
               priceChange24h: statsData.data?.priceChange24h || 0,
               volumeChange24h: statsData.data?.volumeChange24h || 0
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
   
   return Math.min(score, 100);
}

function calculateSecurityScore(tokenData, heliusData) {
   let score = 50;
   
   if (tokenData?.data?.price > 0) score += 10;
   if (tokenData?.data?.liquidity > 1000) score += 10;
   
   if (heliusData?.[0]?.onChainMetadata) {
       score += 20;
   }
   
   return Math.min(score, 100);
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

       try {
           new web3.PublicKey(address);
       } catch (error) {
           console.error('Invalid address:', error);
           return res.status(400).json({ error: 'Invalid Solana address' });
       }

       const [birdeyeData, heliusData] = await Promise.all([
           fetchBirdeyeTokenData(address),
           fetchHeliusTokenData(address)
       ]);

       console.log('Full API Data:', { birdeyeData, heliusData });

       const liquidityScore = calculateLiquidityScore(birdeyeData);
       const volumeScore = calculateVolumeScore(birdeyeData);
       const holderScore = calculateHolderScore(birdeyeData);
       const socialScore = calculateSocialScore(heliusData);
       const securityScore = calculateSecurityScore(birdeyeData, heliusData);

       const overallScore = Math.round(
           (liquidityScore * 0.3) +
           (volumeScore * 0.25) +
           (holderScore * 0.25) +
           (socialScore * 0.1) +
           (securityScore * 0.1)
       );

       const analysis = {
           score: overallScore,
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
                   description: `24h volume: $${(birdeyeData?.data?.volume || 0).toLocaleString()}`
               },
               socialMetrics: {
                   score: socialScore,
                   description: `Social presence and metadata quality`
               },
               securityAnalysis: {
                   score: securityScore,
                   description: `Contract security and market stability`
               }
           },
           priceData: {
               currentPrice: birdeyeData?.data?.price || 0,
               priceChange24h: birdeyeData?.data?.priceChange24h || 0,
               volumeChange24h: birdeyeData?.data?.volumeChange24h || 0
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
