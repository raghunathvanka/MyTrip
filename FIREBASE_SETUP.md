# Firebase Setup Guide for Smart Trip Planner

## 🔥 Firebase Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: **smart-trip-planner**
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password**:
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"
4. Enable **Google**:
   - Click "Google"
   - Toggle "Enable"
   - Enter project support email
   - Click "Save"

### 3. Enable Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll set rules next)
4. Select location (choose closest to users)
5. Click "Enable"

### 4. Set Security Rules

Go to **Firestore Database** → **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data - each user can only access their own trips
    match /users/{userId}/trips/{tripId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click **Publish**.

### 5. Get Firebase Config

1. Go to **Project Overview** → **Project settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web** icon (</>) 
4. Register app name: **Smart Trip Planner**
5. Copy the `firebaseConfig` object

### 6. Add Config to App

1. Open `index.html`
2. Find the `<!-- Firebase Config -->` section
3. Replace `YOUR_API_KEY`, `YOUR_PROJECT_ID`, etc. with your values from step 5

Example:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxX",
    authDomain: "smart-trip-planner.firebaseapp.com",
    projectId: "smart-trip-planner",
    storageBucket: "smart-trip-planner.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};
```

### 7. Update index.html

Add Firebase scripts and config before `</head>`:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>

<!-- Firebase Config -->
<script>
    const firebaseConfig = {
        // Your config here
    };
    firebase.initializeApp(firebaseConfig);
</script>
```

Add auth and sync services before `</body>`:

```html
<!-- Cloud Sync Services -->
<script src="auth-service.js"></script>
<script src="sync-service.js"></script>
```

### 8. Initialize Services in app.js

Add to the app initialization:

```javascript
// Initialize cloud services
if (window.firebase) {
    AuthService.init();
    SyncService.init();
}
```

### 9. Configure Authorized Domains

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel domain: `smart-trip-planner-one.vercel.app`
3. Add localhost for testing: `localhost`

### 10. Test

1. Deploy to Vercel
2. Open the app
3. Try signing in with Google
4. Try creating a trip
5. Check Firestore Console to see data

---

## 🔒 Security Checklist

- [ ] Firestore rules restrict access by userId
- [ ] Auth domains whitelisted
- [ ] API key restricted (optional but recommended)
- [ ] HTTPS enabled (automatic on Vercel)

---

## 💰 Firebase Free Tier Limits

- **Authentication**: Unlimited
- **Firestore Reads**: 50,000/day
- **Firestore Writes**: 20,000/day
- **Firestore Storage**: 1 GB

**Your smart-trip-planner should stay well within free limits!**

---

## 🐛 Troubleshooting

### Firebase not loading
- Check console for errors
- Verify Firebase SDK scripts load before config

### Auth popup blocked
- Allow popups for your domain
- Try email/password instead

### Firestore permission denied
- Check security rules
- Verify user is signed in
- Check userId matches

### Data not syncing
- Check network tab for errors
- Verify user is online
- Check sync queue in localStorage

---

## 📚 Next Steps

1. Complete Firebase setup above
2. Deploy app to Vercel
3. Test authentication flows
4. Test multi-device sync
5. Monitor Firebase Console for usage

Your app is now cloud-enabled! 🚀
