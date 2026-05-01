# Whale Spotting App

A realtime multiuser whale spotting application built with SpacetimeDB, Rust, and React.

## Project Description

Whale Spotting is a collaborative platform where users can report whale sightings in realtime on an interactive map. The app leverages SpacetimeDB for realtime synchronization across all connected clients, allowing multiple users to see new sightings as they are reported.

## Tech Stack

- **Backend**: Rust + SpacetimeDB (realtime database with subscriptions)
- **Frontend**: React + TypeScript + Vite
- **Map Library**: Leaflet
- **Location**: Browser Geolocation API
- **Communication**: WebSocket (via SpacetimeDB)

## Project Structure

```
whale-spotting/           # SpacetimeDB Rust backend module
├── src/
│   └── lib.rs           # Tables: User, Sighting, WhaleSpecies
│                        # Reducers: register_user, report_sighting
└── Cargo.toml

whale-spotting-ui/        # React TypeScript frontend
├── src/
│   ├── components/
│   │   ├── LoginForm.tsx      # User authentication
│   │   ├── SightingForm.tsx   # Report new sightings
│   │   ├── MapComponent.tsx   # Display map with markers
│   │   └── *.css              # Component styles
│   ├── App.tsx                # Main app container
│   ├── main.tsx               # React entry point
│   └── index.css              # Global styles
└── package.json
```

## Development Commands

### Backend (SpacetimeDB Rust Module)

```bash
cd whale-spotting
cargo check       # Verify Rust code compiles
cargo build       # Build the module
```

### Frontend (React)

```bash
cd whale-spotting-ui
npm install       # Install dependencies
npm run dev       # Development server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview production build
```

## Getting Started

1. **Start SpacetimeDB Server**
   - Install SpacetimeDB: https://spacetimedb.com/docs/installation
   - Run: `spacetime server`

2. **Publish the Rust Module**
   ```bash
   cd whale-spotting
   spacetime publish --project-path .
   ```

3. **Start the Frontend**
   ```bash
   cd whale-spotting-ui
   npm install
   npm run dev
   ```

4. **Open in Browser**
   - Navigate to `http://localhost:5173`
   - Enter a username and login
   - Allow geolocation permission
   - Report whale sightings!

## Important Notes

- The app uses WebSocket connections to SpacetimeDB running on `localhost:3001`
- Geolocation requires HTTPS in production (or localhost in development)
- All sightings are stored in SpacetimeDB and synced across all connected clients in realtime
- The database includes 6 whale species by default: Blue, Humpback, Gray, Sperm, Killer, and Minke whales

## Key Features

- **Realtime Updates**: Sightings appear on the map for all users instantly
- **User Authentication**: Each user gets a unique identity
- **Geolocation**: Automatically detects user location or allow manual entry
- **Interactive Map**: Click markers to see sighting details
- **Species Selection**: Choose from 6 whale species when reporting
- **Sighting History**: View recent sightings in a sidebar list
