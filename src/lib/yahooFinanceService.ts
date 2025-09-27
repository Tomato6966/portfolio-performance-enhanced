import { formatDateToISO } from "./formatters";

// Multiple CORS proxies optimized for different environments
const CORS_PROXIES = [
    '/api/yahoo-proxy?url=',

    // Fallback public proxies for all environments
    //   'https://corsproxy.io/?',
    //   'https://api.allorigins.win/raw?url=',
    //   'https://whateverorigin.org/get?url=',
    // //   'https://thingproxy.freeboard.io/fetch/'
];

const YAHOO_API = 'https://query1.finance.yahoo.com';
let currentProxyIndex = 0;

const getApiBase = (): string => {
    const proxy = CORS_PROXIES[currentProxyIndex];

    // Handle Netlify Edge Function (different URL pattern)
    if (proxy.includes('/api/yahoo-proxy')) {
        return proxy; // Return as-is, will be used differently
    }

    // Handle external CORS proxies
    return `${proxy}${encodeURIComponent(YAHOO_API)}`;
};

const switchToNextProxy = (): void => {
    currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
    console.log(`🔄 Switching to proxy ${currentProxyIndex + 1}/${CORS_PROXIES.length}: ${CORS_PROXIES[currentProxyIndex]}`);
};

export const EQUITY_TYPES = {
    all: "etf,equity,mutualfund,index,currency,cryptocurrency,future",
    ETF: "etf",
    Stock: "equity",
    "Etf or Stock": "etf,equity",
    Mutualfund: "mutualfund",
    Index: "index",
    Currency: "currency",
    Cryptocurrency: "cryptocurrency",
    Future: "future",
};

// use this to get from isin to yahoo-finance-symbol
export const searchAssets = async (query: string, equityType: string, maxRetries: number = 3): Promise<Asset[]> => {
    let lastError: Error | null = null;

    // Try each proxy up to maxRetries times
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Log input parameters for debugging
            const params = new URLSearchParams({
                query,
                lang: 'en-US',
                type: equityType,
                longName: 'true',
            });

            const apiBase = getApiBase();
            let url: string;

            // Handle Netlify Edge Function
            if (apiBase.includes('/api/yahoo-proxy')) {
                const targetUrl = `${YAHOO_API}/v1/finance/lookup?${params}`;
                url = `${apiBase}${encodeURIComponent(targetUrl)}`;
            } else {
                // Handle external CORS proxies
                url = `${apiBase}${encodeURIComponent(`/v1/finance/lookup?${params}`)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                // Check if it's a CORS or proxy-related error
                if (response.status === 0 || response.status >= 500 ||
                    response.statusText.includes('CORS') ||
                    response.statusText.includes('Mixed Content')) {
                    throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
                }
                console.error(`Network error: ${response.status} ${response.statusText}`);
                throw new Error(`Network error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as YahooSearchResponse;

            if (data.finance.error) {
                console.error(`API error: ${data.finance.error}`);
                throw new Error(data.finance.error);
            }

            if (!data.finance.result?.[0]?.documents) {
                return [];
            }

            const equityTypes = equityType.split(",").map(v => v.toLowerCase());

            return data.finance.result[0].documents
                .filter(quote => {
                    const matches = equityTypes.includes(quote.quoteType.toLowerCase());
                    return matches;
                })
                .map((quote) => ({
                    id: quote.symbol,
                    isin: '', // not provided by Yahoo Finance API
                    wkn: '', // not provided by Yahoo Finance API
                    name: quote.shortName,
                    rank: quote.rank,
                    symbol: quote.symbol,
                    quoteType: quote.quoteType,
                    price: quote.regularMarketPrice.fmt,
                    priceChange: quote.regularMarketChange.fmt,
                    priceChangePercent: quote.regularMarketPercentChange.fmt,
                    exchange: quote.exchange,
                    historicalData: new Map(),
                    investments: [],
                }));

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`❌ Attempt ${attempt + 1} failed with proxy ${currentProxyIndex + 1}: ${lastError.message}`);

            // Switch to next proxy for next attempt
            if (attempt < maxRetries - 1) {
                switchToNextProxy();
                // Add a small delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // All attempts failed
    console.error('All proxy attempts failed for searchAssets:', lastError?.message);
    throw lastError || new Error('All proxy attempts failed');
};


// use this to get the historical price-data of the asset via yahoo-finance-symbols
export const getHistoricalData = async (symbol: string, startDate: Date, endDate: Date, interval: string = "1d", maxRetries: number = 3) => {
    let lastError: Error | null = null;

    // Try each proxy up to maxRetries times
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const start = Math.floor(startDate.getTime() / 1000);
            const end = Math.floor(endDate.getTime() / 1000);

            const params = new URLSearchParams({
                period1: start.toString(),
                period2: end.toString(),
                interval: interval,
            });

            const apiBase = getApiBase();
            let url: string;

            // Handle Netlify Edge Function
            if (apiBase.includes('/api/yahoo-proxy')) {
                const targetUrl = `${YAHOO_API}/v8/finance/chart/${symbol}?${params}`;
                url = `${apiBase}${encodeURIComponent(targetUrl)}`;
            } else {
                // Handle external CORS proxies
                url = `${apiBase}${encodeURIComponent(`/v8/finance/chart/${symbol}?${params}`)}`;
            }
            const response = await fetch(url);

            if (!response.ok) {
                // Check if it's a CORS or proxy-related error
                if (response.status === 0 || response.status >= 500 ||
                    response.statusText.includes('CORS') ||
                    response.statusText.includes('Mixed Content')) {
                    throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
                }
                throw new Error(`Network response was not ok (${response.status} - ${response.statusText})`);
            }

            const data = await response.json();
            const { timestamp = [], indicators, meta } = data.chart.result[0] as YahooChartResult;
            const quotes = indicators.quote[0];

            const lessThenADay = ["60m", "1h", "90m", "45m", "30m", "15m", "5m", "2m", "1m"].includes(interval);
            return {
                historicalData: new Map(timestamp.map((time: number, index: number) => [formatDateToISO(new Date(time * 1000), lessThenADay), quotes.close[index]])),
                longName: meta.longName,
                currency: meta.currency || symbol.toUpperCase().includes("USD") ? "USD" : symbol.toUpperCase().includes("GBP") ? "GBP" : symbol.toUpperCase().includes("EUR") ? "EUR" : null,
                lastPrice: meta.chartPreviousClose
            };

        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`❌ Historical data attempt ${attempt + 1} failed with proxy ${currentProxyIndex + 1}: ${lastError.message}`);

            // Switch to next proxy for next attempt
            if (attempt < maxRetries - 1) {
                switchToNextProxy();
                // Add a small delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // All attempts failed
    console.error('All proxy attempts failed for getHistoricalData:', lastError?.message);
    return { historicalData: new Map<string, number>(), longName: '' };
};








export interface Asset {
    id: string;
    isin: string;
    name: string;
    quoteType: string;
    price?: string;
    priceChange?: string;
    priceChangePercent?: string;
    rank: string;
    wkn: string;
    symbol: string;
    historicalData: Map<string, number>;
    investments: Investment[];
}

export interface Investment {
    id: string;
    assetId: string;
    type: 'single' | 'periodic';
    amount: number;
    date?: Date;
    periodicGroupId?: string;
}

export interface PeriodicSettings {
    dayOfMonth: number;
    interval: number;
    intervalUnit: 'days' | 'weeks' | 'months' | 'quarters' | 'years';
    startDate: Date;
    dynamic?: {
        type: 'percentage' | 'fixed';
        value: number;
        yearInterval: number;
    };
}

export interface InvestmentPerformance {
    id: string;
    assetName: string;
    date: Date;
    investedAmount: number;
    investedAtPrice: number;
    currentValue: number;
    performancePercentage: number;
    periodicGroupId?: string;
}

export interface DateRange {
    startDate: Date;
    endDate: Date;
}

export interface InvestmentPerformance {
    id: string;
    assetName: string;
    date: Date;
    investedAmount: number;
    investedAtPrice: number;
    currentValue: number;
    performancePercentage: number;
}

export interface PortfolioPerformance {
    investments: InvestmentPerformance[];
    summary: {
        totalInvested: number;
        currentValue: number;
        annualPerformancesPerAsset: Map<string, { year: number; percentage: number; price: number }[]>;
        performancePercentage: number;
        performancePerAnnoPerformance: number;
        ttworValue: number;
        ttworPercentage: number;
        bestPerformancePerAnno: { percentage: number, year: number }[];
        worstPerformancePerAnno: { percentage: number, year: number }[];
        annualPerformances: { year: number; percentage: number; }[];
    };
}

export type DayData = {
    date: Date;
    total: number;
    invested: number;
    percentageChange: number;
    /* Current price of asset */
    assets: { [key: string]: number };
};

export interface WithdrawalPlan {
    amount: number;
    interval: 'monthly' | 'yearly';
    startTrigger: 'date' | 'portfolioValue' | 'auto';
    startDate?: Date;
    startPortfolioValue?: number;
    enabled: boolean;
    autoStrategy?: {
        type: 'maintain' | 'deplete' | 'grow';
        targetYears?: number;
        targetGrowth?: number;
    };
}

export interface ProjectionData {
    date: Date;
    value: number;
    invested: number;
    withdrawals: number;
    totalWithdrawn: number;
}

export interface SustainabilityAnalysis {
    yearsToReachTarget: number;
    targetValue: number;
    sustainableYears: number | 'infinite';
}

export interface PeriodicSettings {
    startDate: Date;
    dayOfMonth: number;
    interval: number;
    amount: number;
    dynamic?: {
        type: 'percentage' | 'fixed';
        value: number;
        yearInterval: number;
    };
}

interface YahooQuoteDocument {
    symbol: string;
    shortName: string;
    rank: string;
    regularMarketPrice: {
        raw: number;
        fmt: string;
    };
    regularMarketChange: {
        raw: number;
        fmt: string;
    };
    regularMarketPercentChange: {
        raw: number;
        fmt: string;
    };
    exchange: string;
    quoteType: string;
}

export interface YahooSearchResponse {
    finance: {
        result: [{
            documents: YahooQuoteDocument[];
        }];
        error: null | string;
    };
}

export interface YahooChartResult {
    timestamp: number[];
    meta: {
        currency: string;
        symbol: string;
        exchangeName: string;
        fullExchangeName: string;
        instrumentType: string;
        firstTradeDate: number;
        regularMarketTime: number;
        hasPrePostMarketData: boolean;
        gmtoffset: number;
        timezone: string;
        exchangeTimezoneName: string;
        regularMarketPrice: number;
        fiftyTwoWeekHigh: number;
        fiftyTwoWeekLow: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        regularMarketVolume: number;
        longName: string;
        shortName: string;
        chartPreviousClose: number;
        priceHint: number;
        currentTradingPeriod: {
            pre: {
                timezone: string;
                start: number;
                end: number;
                gmtoffset: number;
            };
            regular: {
                timezone: string;
                start: number;
                end: number;
                gmtoffset: number;
            };
            post: {
                timezone: string;
                start: number;
                end: number;
                gmtoffset: number;
            };
        };
        dataGranularity: string;
        range: string;
        validRanges: string[];
    }
    indicators: {
        quote: [{
            close: number[];
        }];
    };
}
