# Currency Converter

Modern currency toolkit built with Next.js App Router. It combines real-time FX conversion, historical charts, multi-currency comparisons, expense tracking, receipt OCR, and basic rate forecasting in one UI.

## Features
- Real-time conversion using the Frankfurter API
- Historical rate charts with selectable ranges
- Multi-currency comparison for a single base amount
- Expense tracking with local currency normalization (base INR)
- Receipt scanning via Tesseract.js OCR
- Basic forecasting (ARIMA/LSTM) for educational use
- Voice input for quick conversions
- Light/dark theme support
- Inline expense editing, CSV/JSON export/import, and summary cards

## Tech Stack
- Next.js 15 (App Router), React 18, TypeScript
- Tailwind CSS + shadcn/ui + Radix UI
- Recharts for data visualization
- Tesseract.js for OCR
- TensorFlow.js for LSTM forecasting

## Getting Started

### Prerequisites
- Node.js 18+ (recommended 20+)
- npm, pnpm, or yarn

### Install
```bash
npm install
```

### Run
```bash
npm run dev
```
Open `http://localhost:3000`.

### Build
```bash
npm run build
npm run start
```

## Project Structure
- `app/`: App Router pages
- `app/page.tsx`: Main converter + charts
- `app/expenses/page.tsx`: Expense tracker + receipt scanning + analytics + summaries
- `app/prediction/page.tsx`: Forecasting UI
- `components/`: UI and feature components
  - `currency-converter.tsx`: Core conversion UI + voice input
  - `historical-chart.tsx`: FX history visualization
  - `multi-currency-converter.tsx`: Multi-currency comparison
- `expense-tracker/*`: Expense form/list/chart
- `scan-to-convert/receipt-scanner.tsx`: OCR flow
- `prediction-rates.tsx`: ARIMA/LSTM forecasting
- `context/app-context.tsx`: Global state for currencies, expenses, and history (base INR defaults)
- `lib/api.ts`: Frankfurter API calls
- `lib/utils.ts`: Formatting utilities and CSV exports
- `types/transaction.ts`: Transaction typing

## Data Sources
- Exchange rates are fetched from the Frankfurter API.
- Geolocation uses IP-based lookup (`ipapi.co`) to pick a default currency.

## Notes
- Forecasting is illustrative only and not financial advice.
- Expense data and conversion history are stored in localStorage.
- Expense local equivalents default to INR when geolocation is unavailable.
- Receipt OCR quality depends on image clarity and language.

## Expense Tracker
The expense tracker supports logging, inline edits, receipt OCR, and analytics with INR as the local base.

![Expense Tracker - Log](docs/expense-tracker-log.png)
![Expense Tracker - List](docs/expense-tracker-list.png)
![Expense Tracker - Analytics](docs/expense-tracker-analytics.png)

## Scripts
- `npm run dev`: Local development
- `npm run build`: Production build
- `npm run start`: Run production server
- `npm run lint`: Linting

## Roadmap Ideas
- Add server-side caching for FX requests
- Persist expenses/history per user (DB)
- Replace client-only forecasting with an API route
- Improve OCR parsing for totals and currency detection
- Add i18n and locale-aware formatting

## License
No license specified. Add one if you plan to open source.
