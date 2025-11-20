import { GoogleGenAI } from "@google/genai";
import { MarketData } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Fetches real-time market snapshots using Google Search Grounding.
 */
export const fetchLiveMarketData = async (): Promise<MarketData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Get the current live stock price and percentage change for: 
      NVIDIA (NVDA), Tesla (TSLA), Bitcoin (BTC-USD), Ethereum (ETH-USD), Solana (SOL-USD), S&P 500 (SPY).
      
      Format output as: SYMBOL|PRICE|CHANGE
      Example: NVDA|$120.50|+2.5%
      `,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    const lines = text.split('\n').filter(line => line.includes('|'));

    const parsedData: MarketData[] = lines.map(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 3) return null;
      
      const symbol = parts[0];
      const price = parts[1];
      const change = parts[2];
      const isPositive = !change.includes('-');

      return {
        symbol,
        price,
        change,
        isPositive
      };
    }).filter((item): item is MarketData => item !== null);

    return parsedData;
  } catch (error) {
    console.error("Failed to fetch market data:", error);
    return [
      { symbol: "BTC-USD", price: "$98,500", change: "+5.2%", isPositive: true },
      { symbol: "SOL-USD", price: "$210.00", change: "+1.2%", isPositive: true },
      { symbol: "NVDA", price: "$145.20", change: "-0.5%", isPositive: false },
    ];
  }
};

export const generateSystemMessage = async (): Promise<string> => {
   try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Generate a short, cryptic, cyberpunk-style status message (max 10 words).",
    });
    return response.text || "SYSTEM INITIALIZED.";
   } catch (e) {
     return "ESTABLISHING UPLINK...";
   }
}

export const generateNewsHeadline = async (): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Generate a single short futuristic financial news headline. Max 8 words. Make it sound like Cyberpunk 2077 news.",
        });
        return response.text || "MARKET VOLATILITY DETECTED IN SECTOR 7";
    } catch (e) {
        return "DATA STREAM INTERRUPTED";
    }
}