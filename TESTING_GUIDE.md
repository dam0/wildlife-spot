# 🐋 Whale Spotting App - Testing Guide

## ✅ Quick Start (Demo Mode)

The app now has a **Demo Mode** that works without a backend connection!

### Step 1: Open the App
```
http://localhost:5173
```

### Step 2: Login in Demo Mode
1. Enter your username (any name you want)
2. **Check the "Demo Mode (No Backend)" checkbox**
3. Click "Login & Start Spotting"
4. ✅ You're logged in!

### Step 3: Use the Map
1. **Allow geolocation** when browser asks
2. **Click on blue areas** (oceans) on the map
3. The water detection validates your location
4. Fill in the form:
   - Select whale species
   - Set pod size
   - Click "Report Sighting"
5. ✅ Sighting appears on the map!

## 🌍 Test Locations

Try clicking on these ocean areas:

| Location | Coordinates | Notes |
|----------|-------------|-------|
| San Francisco | 37.7749, -122.4194 | Blue whale area |
| Los Angeles | 34.0522, -118.2437 | Killer whale area |
| New York | 40.7128, -74.0060 | Atlantic coast |
| Hawaii | 21.3099, -157.8581 | Pacific |
| Any blue area | varies | Ocean pixels are RGB(170, 211, 223) |

**How to test these locations:**
1. Click on the map center area (it's zoom level 2 at start)
2. The map will show your geolocation automatically
3. Click on blue areas to test water detection
4. Red/brown areas are land (will be rejected)

## 📊 Demo Features Working

✅ **Water Detection** - RGB analysis of OSM tiles
- Detects ocean tiles: RGB(170, 211, 223)
- Rejects land tiles (browns/tans)
- Check browser console for logs

✅ **Map Interaction**
- Click to place pins
- Drag pins to reposition
- Form shows species/pod size options
- Delete button removes pins

✅ **Sighting Display**
- Mock sightings show on map
- List appears in sidebar
- Markers display whale emoji + pod count

✅ **Geolocation**
- Browser requests location
- Map centers on your position
- Allow permission for best experience

## 🔧 Backend Connection (Optional)

If you want to test **live backend connection** (requires Maincloud setup):

1. **Don't check "Demo Mode"** on login
2. App will attempt to connect to Maincloud
3. If it fails, it automatically falls back to demo mode
4. Check browser console for connection logs:
   ```
   [SpacetimeDB] Connecting to SpacetimeDB at wss://whale-spotting.maincloud.spacetimedb.com
   [SpacetimeDB] Connected to server
   [SpacetimeDB] User {username} registered successfully
   ```

## 📋 What to Test

### 1. Water Detection
- [ ] Click on blue ocean areas
- [ ] Click on brown/tan land areas
- [ ] Watch console logs for RGB analysis
- [ ] Expected: Ocean accepted, land rejected

### 2. Geolocation
- [ ] Allow location permission
- [ ] Map centers on your location
- [ ] Red marker shows your position

### 3. Map Interaction
- [ ] Click on map to place pin
- [ ] Form appears for configuration
- [ ] Drag pin to reposition
- [ ] Click "Delete" to remove pin

### 4. Sighting Reporting
- [ ] Select different whale species
- [ ] Change pod size (1-50)
- [ ] Click "Report Sighting"
- [ ] Sighting appears on map + sidebar

### 5. UI Responsiveness
- [ ] Form is accessible
- [ ] Buttons work
- [ ] Sidebar scrolls
- [ ] Mobile friendly (try resizing)

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"Demo Mode" checkbox missing** | Hard refresh (Ctrl+Shift+R) |
| **Map doesn't load** | Allow geolocation, check internet |
| **Water detection failing** | Click pure blue areas, check zoom level |
| **Pins don't appear** | Try clicking in different locations |
| **Console errors** | Check browser console (F12) |

## 🔍 How to Monitor

### Browser Console
Press **F12** and look for logs:

```javascript
// Demo mode
[Mock] Calling reducer: report_sighting ...

// Water detection
[Water Check] Checking tile 12/702/1635 for location (37.7749, -122.4194)
[Water Analysis] Water: 60/81 (74%), Avg RGB: (170, 211, 223), Result: WATER ✓

// Backend connection
[SpacetimeDB] Connecting to SpacetimeDB at wss://...
[SpacetimeDB] Connected to server
```

### Network Tab
- Click on WebSocket connections to see data flow
- In demo mode: no network traffic (local only)
- In backend mode: shows connection to Maincloud

## 📱 Features by Mode

### Demo Mode (Checkbox Enabled)
- ✅ Map display
- ✅ Water detection
- ✅ Geolocation
- ✅ Form interaction
- ✅ Mock sightings (pre-populated)
- ❌ Real-time sync (not needed - no other users)
- ❌ Actual database save

### Backend Mode (Checkbox Disabled)
- ✅ All demo features
- ✅ Real-time sync across users
- ✅ Permanent sighting storage
- ✅ Multi-user collaboration
- ⚠️ Requires Maincloud connection
- ⚠️ Falls back to demo if connection fails

## 🚀 Next Steps

1. **Test the app thoroughly in demo mode**
2. **Check browser console for any errors**
3. **Try different whale species and pod sizes**
4. **Test water detection in various locations**
5. **Note any UI/UX issues**

## 📞 Support

**If something doesn't work:**

1. Open browser console (F12)
2. Look for error messages
3. Try hard refresh (Ctrl+Shift+R)
4. Try demo mode if backend fails
5. Check that SpacetimeDB server is running (if using backend)

---

**Status:** ✅ **Ready for Testing**
**App URL:** http://localhost:5173
**Dev Server:** Running (port 5173)
