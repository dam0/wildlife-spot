# 🐋 Whale Spotting App - Quick Start

## ✅ Everything is Ready!

### Open the App
```
http://localhost:5173
```

### Test the App

**Step 1: Login**
- Enter any username
- Click "Login & Start Spotting"
- App connects to SpacetimeDB Maincloud ✅

**Step 2: Allow Geolocation**
- Browser will ask for location permission
- Click "Allow"
- Map centers on your location

**Step 3: Click on Ocean**
- Click on blue areas of the map
- Water detection validates the location
- If valid: form appears to report sighting
- If invalid: message says "This location is on land"

**Step 4: Report Sighting**
- Select whale species (default: Humpback)
- Set pod size (default: 2)
- Click "Report Sighting"
- Sighting appears on map and in sidebar list

**Step 5: See Real-Time Updates**
- Open app in another browser/tab
- Login with different username
- Report a sighting in tab 1
- Tab 2 updates in real-time! ✅

## 🎯 Test Locations (Known Oceans)

Try clicking on these ocean areas:
- **San Francisco Bay** (37.7749, -122.4194)
- **Los Angeles Coast** (34.0522, -118.2437)
- **New York Coast** (40.7128, -74.0060)
- **Anywhere blue on the map!**

## 🔧 Dev Server Info

**Frontend:** http://localhost:5173
**Backend:** whale-spotting.maincloud.spacetimedb.com
**Local SpacetimeDB:** http://localhost:3000 (offline)

## 📊 How to Monitor

**Browser Console** (Press F12)
- [Water Check] logs show tile analysis
- [Water Analysis] logs show pixel counts
- Network tab shows WebSocket to Maincloud

**Check what's published:**
```bash
spacetime list
# Shows: whale-spotting (c200fb236...)
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Can't connect" | Check internet connection |
| Map doesn't load | Allow location permission |
| Clicks don't work | Click on blue areas (oceans) |
| No sightings appear | Check browser console for errors |
| Slow response | Network latency to Maincloud |

## 📱 Features

- ✅ Real-time multi-user sync
- ✅ Water detection (OSM tiles)
- ✅ 6 whale species
- ✅ Pod size tracking
- ✅ Live map markers
- ✅ Sighting history

## 🛑 Stop the Server

```bash
pkill -f vite
```

## 🚀 Restart the Server

```bash
cd /Users/damo/DEV/opencode_test/whale-spotting-ui
npm run dev
```

---

**Status:** ✅ **Ready for Testing**
**Backend:** 🌍 Live on Maincloud
**Frontend:** 💻 Running locally
