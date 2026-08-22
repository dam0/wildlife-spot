# 🐋 Whale Spotting App

A realtime multiuser whale spotting application built with SpacetimeDB, Rust, and React.

## Quick Start

### Prerequisites
- Node.js 18+
- Rust 1.90+ (managed by SpacetimeDB)
- SpacetimeDB CLI: https://spacetimedb.com/docs/installation

### Setup Instructions (Recommended: Use SpacetimeDB Cloud)

**Option 1: Using SpacetimeDB Maincloud (Easiest)**

This is the recommended approach as it avoids version conflicts:

```bash
# 1. Publish to maincloud
cd whale-spotting
spacetime publish --project-path . --server maincloud whale-spotting

# 2. Update frontend config (in whale-spotting-ui/src/App.tsx)
# Change: const wsUrl = `${wsProtocol}//localhost:3001/`
# To: const wsUrl = `${wsProtocol}//whale-spotting.maincloud.spacetimedb.com/`

# 3. Start frontend
cd ../whale-spotting-ui
npm run dev
```

**Option 2: Local Development** (If you have matching versions)

```bash
# 1. Start SpacetimeDB Server
spacetime start
# Wait for: "Starting SpacetimeDB listening on 0.0.0.0:3000"

# 2. Publish the Rust Module (may require version matching)
cd whale-spotting
spacetime publish --project-path . whale-spotting

# 3. Start the Frontend
cd ../whale-spotting-ui
npm run dev

# 4. Open http://localhost:5173
```

### Connecting to Your Database

In `whale-spotting-ui/src/App.tsx`, update the connection URL:
```typescript
// For local development:
const wsUrl = `${wsProtocol}//localhost:3001/`

// For maincloud:
const wsUrl = `${wsProtocol}//whale-spotting.maincloud.spacetimedb.com/`

// For custom server:
const wsUrl = `${wsProtocol}//<your-server-url>/`
```

## Using the App

### Login
1. Enter your username
2. Click "Login & Start Spotting"
3. Wait for connection to establish

### Report a Sighting
1. Select whale species from the dropdown
2. Coordinates auto-populate from your location (or enter manually)
3. Add optional description
4. Click "Report Sighting"
5. Your sighting appears on the map instantly for all users!

### View Sightings
- Click on map markers to see detailed information
- Scroll through the "Recent Sightings" list on the right
- Sightings update in real-time as other users report them

## Project Structure

```
whale-spotting/
├── src/lib.rs              # Rust backend tables and reducers
├── Cargo.toml              # Rust dependencies
└── .cargo/config.toml

whale-spotting-ui/
├── src/
│   ├── components/
│   │   ├── LoginForm.tsx       # Authentication
│   │   ├── SightingForm.tsx    # Report sightings
│   │   └── MapComponent.tsx    # Interactive map
│   ├── App.tsx                 # Main component
│   ├── main.tsx                # Entry point
│   └── *.css                   # Styling
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Architecture

### Backend (Rust + SpacetimeDB)
- **Tables:**
  - `users` - User identities and usernames
  - `sightings` - Whale sighting reports with location, species, description
  - `whale_species` - Reference data for 6 whale species

- **Reducers:**
  - `register_user(username)` - Register a new user
  - `report_sighting(species_id, latitude, longitude, description)` - Report a sighting

### Frontend (React + TypeScript)
- **LoginForm** - WebSocket connection and user registration
- **SightingForm** - Geolocation capture and sighting submission
- **MapComponent** - Leaflet map with real-time marker updates

## Features

- ✅ Real-time multi-user synchronization
- ✅ Interactive Leaflet map with whale sighting markers
- ✅ Automatic geolocation detection
- ✅ 6 whale species to report
- ✅ Sighting history with user attribution
- ✅ Beautiful, responsive UI

## Whale Species

1. Blue Whale (*Balaenoptera musculus*)
2. Humpback Whale (*Megaptera novaeangliae*)
3. Gray Whale (*Eschrichtius robustus*)
4. Sperm Whale (*Physeter macrocephalus*)
5. Killer Whale (*Orcinus orca*)
6. Minke Whale (*Balaenoptera acutorostrata*)

## Troubleshooting

### Connection Refused Error
- Ensure SpacetimeDB server is running on port 3000
- Run `spacetime start` in a terminal

### Module Publishing Failed
- Check that SpacetimeDB server is running
- Verify port 3000 is not blocked by firewall

### Geolocation Not Working
- Allow location permission when prompted
- In development, works on localhost
- In production, requires HTTPS

### Map Not Showing
- Clear browser cache and reload
- Check browser console for errors
- Ensure Leaflet CSS is properly loaded

## Development

### Frontend Only Development
If you just want to work on the frontend without running SpacetimeDB locally:
1. Use mock data in the components
2. Skip the SpacetimeDB server and module publishing steps

### Building for Production
```bash
cd whale-spotting-ui
npm run build
```

Output: `dist/` directory with optimized production build

## Next Steps

- [ ] Add photo upload support for sightings
- [ ] Implement sighting filtering by species/date
- [ ] Add whale migration route visualization
- [ ] Create admin dashboard for analytics
- [ ] Deploy to production (Vercel for frontend, SpacetimeDB Cloud for backend)

## License

MIT

## Support

For issues with:
- **SpacetimeDB**: https://discord.gg/spacetimedb
- **React/Frontend**: Check browser console for errors
- **WebSocket Connection**: Verify server is running on localhost:3000
