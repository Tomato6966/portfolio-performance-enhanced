# Portfolio Performance Enhanced

<div align="center">

![Portfolio Dashboard](https://img.shields.io/badge/Portfolio-Dashboard-purple?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)

**Advanced Portfolio Analysis & Visualization Dashboard**

*Transform your Portfolio Performance CSV exports into beautiful, interactive financial insights*

[🚀 Live Demo](#) • [📊 Features](#features) • [🛠️ Installation](#installation) • [📱 Usage](#usage)

</div>

## ✨ Overview

Portfolio Performance Enhanced is a modern, privacy-focused web application that transforms CSV exports from [Portfolio Performance](https://www.portfolio-performance.info/) software into comprehensive financial analytics and stunning visualizations. Built with Next.js 14 and TypeScript, it provides institutional-grade portfolio analysis tools in an intuitive, beautiful interface.

### 🎯 Key Highlights

- **📈 Advanced Analytics**: TTWOR, IRR, CAGR, Sharpe ratio, maximum drawdown analysis
- **🎨 Beautiful Visualizations**: Interactive charts, asset allocation pie charts, monthly flow matrices
- **🔒 Privacy-First**: Toggle between absolute values and percentage-only views
- **💰 Multi-Portfolio Support**: Analyze individual portfolios or aggregate multiple accounts
- **🌐 Real-time Data**: Automatic Yahoo Finance integration for live asset prices
- **📱 Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **⚡ High Performance**: Optimized calculations with caching and progressive loading

## 🚀 Features

### 📊 Portfolio Analytics
- **Performance Metrics**: Time-Weighted Rate of Return (TTWOR), Internal Rate of Return (IRR), Compound Annual Growth Rate (CAGR)
- **Risk Analysis**: Volatility calculations, Sharpe ratio, maximum drawdown periods (1M, 3M, 6M, 12M)
- **Cost Analysis**: Detailed fee and tax breakdowns with percentage impact on returns
- **Future Projections**: Monte Carlo simulations with customizable return assumptions

### 📈 Interactive Visualizations
- **Performance Charts**: Configurable time-series charts with pre/post-tax return options
- **Asset Allocation**: Dynamic pie charts with weight percentages and sector breakdowns
- **Monthly Flow Matrix**: Heatmap showing cash flow patterns and contribution trends
- **Transaction History**: Detailed transaction views with filtering and sorting

### 🔧 Advanced Features
- **Multi-Portfolio Aggregation**: Combine multiple portfolios for consolidated analysis
- **Flexible Date Ranges**: Custom periods, YTD, MTD, or predefined ranges
- **Privacy Controls**: Global toggle to hide absolute values while preserving analytics
- **Data Persistence**: Local storage with automatic saving and loading
- **Progressive Loading**: Optimized asset fetching with progress indicators

### 🌐 Data Integration
- **CSV Import**: Support for Portfolio Performance export formats (German and English)
- **Yahoo Finance API**: Automatic symbol resolution and historical price fetching
- **Real-time Updates**: Live asset price updates with fallback mechanisms
- **Data Validation**: Comprehensive error handling and data quality checks

## 🛠️ Installation

### Prerequisites
- **Node.js** 18+ or **Bun** runtime
- Modern web browser with JavaScript enabled

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/portfolio-performance-enhanced.git
cd portfolio-performance-enhanced

# Install dependencies (using npm)
npm install

# Or using Bun (recommended for faster installation)
bun install

# Start development server
npm run dev
# or
bun run dev

# Open your browser
open http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Docker Deployment (Optional)

```bash
# Build Docker image
docker build -t portfolio-performance-enhanced .

# Run container
docker run -p 3000:3000 portfolio-performance-enhanced
```

## 📱 Usage

### 1. CSV Data Export
Export your data from Portfolio Performance:
- **File → Export → Transactions** (save as CSV)
- **File → Export → Cash Transactions** (save as CSV)

### 2. Data Import
1. Open the application in your browser
2. Drag and drop your CSV files or click to browse
3. Wait for automatic processing and Yahoo Finance data fetching
4. Your portfolio analysis will appear automatically

### 3. Analysis Features
- **Portfolio Selection**: Choose individual or multiple portfolios to analyze
- **Date Range**: Adjust time periods using the date selector
- **Privacy Mode**: Toggle absolute values on/off using the eye icon
- **Export Data**: Save your analysis data locally

### 4. Supported CSV Formats
The application supports Portfolio Performance CSV exports with these columns:
- **Transactions**: Datum, Typ, Wert, Stück, ISIN, Ticker-Symbol, Wertpapiername, Gebühren, Steuern
- **Cash Transactions**: Datum, Typ, Wert, Buchungswahrung, Gebühren, Steuern

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.0
- **Styling**: TailwindCSS + Framer Motion animations
- **Charts**: Recharts + D3.js for custom visualizations
- **Data Processing**: PapaParse for CSV handling
- **API Integration**: Yahoo Finance with CORS proxy
- **State Management**: React hooks with local storage persistence

### Project Structure
```
portfolio-performance-enhanced/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard page
├── src/
│   ├── components/        # React components
│   │   ├── Analysis.tsx   # Portfolio analytics
│   │   ├── PerformanceChart.tsx
│   │   ├── AssetAllocation.tsx
│   │   └── ui/            # Reusable UI components
│   ├── lib/               # Core business logic
│   │   ├── portfolioCalculations.ts
│   │   ├── csvProcessor.ts
│   │   ├── yahooFinanceService.ts
│   │   └── storage.ts
│   ├── types/             # TypeScript definitions
│   └── context/           # React context providers
├── pages/api/             # API routes
└── netlify/               # Deployment configuration
```

### Key Components
- **PortfolioManager**: Core calculation engine for performance metrics
- **CSV Processor**: Intelligent parsing of Portfolio Performance exports
- **Yahoo Finance Service**: Asset price fetching with multiple fallback proxies
- **Analysis Engine**: Advanced financial calculations (TTWOR, IRR, risk metrics)

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for configuration:

```bash
# Optional: Custom Yahoo Finance proxy endpoint
NEXT_PUBLIC_YAHOO_PROXY_URL=your-proxy-url

# Optional: Analytics tracking
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### Customization
- **Color Themes**: Modify `tailwind.config.js` for custom color schemes
- **Chart Styling**: Update chart configurations in component files
- **Date Formats**: Adjust date parsing in `csvProcessor.ts` for different locales

## 🚀 Deployment

### Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `out`
4. Enable Netlify Edge Functions for Yahoo Finance proxy

### Vercel
1. Connect repository to Vercel
2. Configure build settings for Next.js
3. Deploy with automatic HTTPS and CDN

### Self-Hosting
Build static files and serve with any web server:
```bash
npm run build
# Serve the 'out' directory
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use arrow functions and modern ES6+ syntax
- Add proper TypeScript interfaces for data structures

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Portfolio Performance**: For providing excellent open-source portfolio management software
- **Yahoo Finance**: For reliable financial data APIs
- **Next.js Team**: For the outstanding React framework
- **TailwindCSS**: For beautiful, utility-first styling
- **Recharts**: For powerful, composable chart components

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/portfolio-performance-enhanced/issues)
- 💡 **Feature Requests**: [Start a discussion](https://github.com/yourusername/portfolio-performance-enhanced/discussions)
- 📧 **Email**: [your-email@example.com](mailto:your-email@example.com)

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

Made with ❤️ by [Your Name](https://github.com/yourusername)

</div>
