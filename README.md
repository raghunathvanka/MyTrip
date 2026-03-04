# Smart Trip Planner

A Progressive Web App for planning trips, tracking itinerary, transport, and expenses offline.

## 🚀 Features

- ✈️ Trip planning with day-wise itinerary
- 💰 Expense tracking (expected vs actual)
- 🚗 Self-drive trip support with odometer tracking
- 📊 Auto-calculations (distance, fuel efficiency, costs)
- 📱 Works offline (PWA)
- 💾 Local data persistence
- 📤 Export data (JSON/CSV)

## 🏗️ Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Storage**: localStorage
- **PWA**: Service Worker, Web App Manifest
- **Deployment**: Vercel

## 📦 Installation

### For Users

**Android/iOS:**
1. Visit the app URL
2. Tap "Add to Home Screen"
3. App installs like a native app

**Desktop:**
1. Visit the app URL in Chrome/Edge
2. Click install icon in address bar
3. App installs as desktop app

### For Developers

```bash
# Clone repository
git clone <repo-url>
cd MyTrip

# No build step needed - it's vanilla JS!
# Just open index.html in browser or deploy to Vercel
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production
vercel --prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Other Platforms

The app is a static site and can be deployed anywhere:
- Netlify
- GitHub Pages
- Firebase Hosting
- Any static host

## 📱 PWA Features

- ✅ Installable on all platforms
- ✅ Works offline
- ✅ Fast loading (cached assets)
- ✅ Auto-updates
- ✅ Native app feel

## 🗂️ Project Structure

```
MyTrip/
├── index.html              # Main HTML
├── styles.css              # All styles
├── app.js                  # Core app logic
├── storage.js              # Data persistence
├── ui-components.js        # Reusable UI
├── charts.js               # Visualizations
├── reports.js              # Export functionality
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline support
├── vercel.json            # Deployment config
└── DEPLOYMENT.md          # Deployment guide
```

## 💾 Data Model

```javascript
Trip {
  tripName, destination, dates,
  numberOfTravelers, expectedTotalBudget,
  isSelfDriveTrip, vehicleName, startingOdometer, mileage,
  days: [Day]
}

Day {
  date, accommodation, food, activities,
  expenses, startOdometer, endOdometer, fuelCost
}
```

## 🔧 Development

No build process required! Just edit files and refresh browser.

```bash
# Serve locally (optional)
npx serve .

# Or use any local server
python -m http.server 8000
```

## 📊 Browser Support

- Chrome/Edge: ✅ Full support
- Safari: ✅ Full support
- Firefox: ✅ Full support
- Mobile browsers: ✅ Optimized

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🙏 Acknowledgments

Built with modern web standards and PWA best practices.

---

**Live Demo**: [Deploy to see your URL]

**Status**: Production Ready 🚀
