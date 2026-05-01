# Whale Spotting App - Deployment Guide

## Issue: SpacetimeDB Version Mismatch

If you're seeing this error when publishing:
```
abi version 10.1 is not supported (host implements 10.0)
```

This means your local SpacetimeDB server (v1.3.2 ABI 10.0) is incompatible with the latest spacetimedb Rust crates (v1.2.0+ ABI 10.1). 

## Solutions

### Solution 1: Use SpacetimeDB Maincloud (Recommended ⭐)

**Pros:** Instant, no version conflicts, auto-scaling  
**Cons:** Requires creating an account

```bash
# 1. Create/login to SpacetimeDB account
spacetime login

# 2. Publish to maincloud
cd whale-spotting
spacetime publish --project-path . whale-spotting --server maincloud

# 3. Get your database URL (shown after publishing)
# Format: whale-spotting.maincloud.spacetimedb.com

# 4. Update frontend connection in whale-spotting-ui/src/App.tsx
# Find this line in LoginForm.tsx:
#   const wsUrl = `${wsProtocol}//localhost:3001/`
# Replace with:
#   const wsUrl = `${wsProtocol}//whale-spotting.maincloud.spacetimedb.com/`

# 5. Start frontend
cd ../whale-spotting-ui
npm run dev

# 6. Open http://localhost:5173
```

### Solution 2: Upgrade Local SpacetimeDB

**Pros:** Full local control  
**Cons:** Requires reinstalling spacetime

```bash
# 1. Check current version
spacetime --version

# 2. Install latest spacetime (requires terminal input, so do manually)
# Visit https://spacetimedb.com/docs/installation
# Follow their installation instructions

# 3. Start fresh server
spacetime start  # This should start v1.6.0+

# 4. Then publish should work
cd whale-spotting
spacetime publish --project-path .
```

### Solution 3: Use Pre-built Docker Container

If you have Docker installed:

```bash
docker pull spacetimedb/spacetimedb:latest
docker run -p 3000:3000 spacetimedb/spacetimedb:latest

# Then in another terminal:
cd whale-spotting
spacetime publish --project-path . whale-spotting
```

### Solution 4: Manual Database Setup (Advanced)

For quick testing without database updates:

1. Frontend can run in mock mode
2. Edit `whale-spotting-ui/src/components/MapComponent.tsx` to use fake data:

```typescript
// Replace real query with mock data
const mockSightings = [
  { id: 1, latitude: 37.7749, longitude: -122.4194, species_id: 1, description: "Blue whale spotted!", username: "sailor123", timestamp: Date.now() },
  { id: 2, latitude: 34.0522, longitude: -118.2437, species_id: 5, description: "Orca!", username: "oceanfan", timestamp: Date.now() - 3600000 },
]
setSightings(mockSightings)
```

## Backend Architecture

The app requires:
- **SpacetimeDB Server**: Provides realtime data sync & authentication
- **3 Tables**: User, WhaleSpecies, Sighting
- **2 Reducers**: register_user, report_sighting

The Rust module (`whale-spotting/src/lib.rs`) defines the schema and API.

## Frontend Architecture

The React app:
- Connects via WebSocket to SpacetimeDB on port 3001
- Allows users to login with a username
- Submit whale sightings with species, location, description
- View map with all sightings in real-time
- Uses Leaflet for mapping

## Troubleshooting

### "Connection refused" when opening http://localhost:5173
- Make sure you ran `npm run dev` in `whale-spotting-ui/`
- Check port 5173 isn't blocked by firewall

### "Failed to connect to server" when logging in
- Make sure SpacetimeDB is running (or using maincloud URL)
- Check the WebSocket URL in LoginForm.tsx matches your server
- If using local server, verify it's on port 3001

### Module publishes but frontend doesn't see data
- Check that the database name in CLI matches the URL in frontend code
- Verify network requests in browser DevTools (F12)
- Check SpacetimeDB server logs for errors

### Geolocation not working
- Only works on localhost or HTTPS in production
- Browser must have permission granted
- Check browser console for permissions errors

## Next Steps

After deployment:

1. **Add to GitHub**: `git init && git add . && git commit -m "Initial whale spotting app"`
2. **Deploy Frontend**: Upload `whale-spotting-ui/dist/` to Vercel, Netlify, or GitHub Pages
3. **Monitor Database**: Use maincloud dashboard to view traffic and data
4. **Add Features**: 
   - Photo uploads
   - Whale migration routes
   - Sighting history/filters
   - Social sharing

## Resources

- SpacetimeDB Docs: https://spacetimedb.com/docs
- React Documentation: https://react.dev
- Leaflet Maps: https://leafletjs.com
- Issues/Help: SpacetimeDB Discord https://discord.gg/spacetimedb
