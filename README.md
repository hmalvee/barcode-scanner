# Barcode Scanner

A modern, web-based barcode scanner application built with React, Vite, and TypeScript. Scan multiple barcodes and copy them all at once!

## Features

- 📷 Real-time barcode scanning using your device's camera
- 📋 Scan multiple barcodes and view them in a list
- 📄 Copy all scanned barcodes to clipboard with one click
- 🗑️ Remove individual barcodes or clear all
- 🎨 Modern, responsive UI design
- ⚡ Fast and lightweight

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

### Running the App

Start the development server:
```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. Click "Start Scanning" to activate your camera
2. Point your camera at a barcode
3. The scanned barcode will automatically appear in the list at the bottom
4. Continue scanning more barcodes
5. Click "Copy All" to copy all scanned barcodes to your clipboard
6. Use "Clear All" to remove all scanned barcodes

## Browser Compatibility

This app requires:
- A modern browser with camera access support
- HTTPS (or localhost) for camera access
- WebRTC support

## Technologies Used

- React 18
- TypeScript
- Vite
- @zxing/library (for barcode scanning)
