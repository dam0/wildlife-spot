use spacetimedb::{ReducerContext, Table};

#[spacetimedb::table(name = "user", accessor = user, public)]
pub struct User {
    #[primary_key]
    pub identity: spacetimedb::Identity,
    pub username: String,
}

#[spacetimedb::table(name = "whale_species", accessor = whale_species, public)]
pub struct WhaleSpecies {
    #[primary_key]
    pub id: u32,
    pub name: String,
    pub scientific_name: String,
}

#[spacetimedb::table(name = "sighting", accessor = sighting, public)]
pub struct Sighting {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub user_identity: spacetimedb::Identity,
    pub species_id: u32,
    pub latitude: f64,
    pub longitude: f64,
    pub timestamp: u64,
    pub description: String,
    #[default(1)]
    pub pod_size: u32,
}

/// Validate the shared sighting fields. Panics abort the transaction,
/// so invalid data never reaches the database.
fn validate_sighting_fields(
    ctx: &ReducerContext,
    species_id: u32,
    latitude: f64,
    longitude: f64,
    description: &str,
    pod_size: u32,
) {
    assert!(
        ctx.db.whale_species().id().find(species_id).is_some(),
        "unknown species id {species_id}"
    );
    assert!(
        (-90.0..=90.0).contains(&latitude),
        "latitude must be within [-90, 90]"
    );
    assert!(
        (-180.0..=180.0).contains(&longitude),
        "longitude must be within [-180, 180]"
    );
    assert!(pod_size >= 1, "pod size must be at least 1");
    assert!(
        description.chars().count() <= 1000,
        "description must be 1000 characters or fewer"
    );
}

fn unix_seconds(ctx: &ReducerContext) -> u64 {
    (ctx.timestamp.to_micros_since_unix_epoch() / 1_000_000) as u64
}

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {}

/// Register (or rename) the caller. Re-registering with the same username
/// is an idempotent no-op so clients can safely retry.
#[spacetimedb::reducer]
pub fn register_user(ctx: &ReducerContext, username: String) {
    let username = username.trim();
    assert!(!username.is_empty(), "username cannot be empty");
    assert!(
        username.len() <= 32,
        "username must be 32 characters or fewer"
    );
    let taken =
        |u: &User, by_other: bool| u.username == username && (!by_other || u.identity != ctx.sender());

    match ctx.db.user().identity().find(ctx.sender()) {
        Some(_) => {
            // Existing spotter: allow a rename, still enforcing uniqueness.
            assert!(
                !ctx.db.user().iter().any(|u| taken(&u, true)),
                "username is already taken"
            );
            ctx.db.user().identity().update(User {
                identity: ctx.sender(),
                username: username.to_string(),
            });
        }
        None => {
            assert!(
                !ctx.db.user().iter().any(|u| taken(&u, false)),
                "username is already taken"
            );
            ctx.db.user().insert(User {
                identity: ctx.sender(),
                username: username.to_string(),
            });
        }
    }
}

#[spacetimedb::reducer]
pub fn report_sighting(
    ctx: &ReducerContext,
    species_id: u32,
    latitude: f64,
    longitude: f64,
    description: String,
    pod_size: u32,
) {
    validate_sighting_fields(ctx, species_id, latitude, longitude, &description, pod_size);
    ctx.db.sighting().insert(Sighting {
        id: 0, // assigned by #[auto_inc]
        user_identity: ctx.sender(),
        species_id,
        latitude,
        longitude,
        timestamp: unix_seconds(ctx),
        description,
        pod_size,
    });
}

#[spacetimedb::reducer]
pub fn update_sighting(
    ctx: &ReducerContext,
    sighting_id: u64,
    species_id: u32,
    latitude: f64,
    longitude: f64,
    description: String,
    pod_size: u32,
) {
    let mut sighting = ctx
        .db
        .sighting()
        .id()
        .find(sighting_id)
        .unwrap_or_else(|| panic!("sighting {sighting_id} not found"));
    assert_eq!(
        sighting.user_identity,
        ctx.sender(),
        "only the reporting spotter can update a sighting"
    );
    validate_sighting_fields(ctx, species_id, latitude, longitude, &description, pod_size);

    sighting.species_id = species_id;
    sighting.latitude = latitude;
    sighting.longitude = longitude;
    sighting.description = description;
    sighting.pod_size = pod_size;
    sighting.timestamp = unix_seconds(ctx);
    ctx.db.sighting().id().update(sighting);
}

#[spacetimedb::reducer]
pub fn delete_sighting(ctx: &ReducerContext, sighting_id: u64) {
    let sighting = ctx
        .db
        .sighting()
        .id()
        .find(sighting_id)
        .unwrap_or_else(|| panic!("sighting {sighting_id} not found"));
    assert_eq!(
        sighting.user_identity,
        ctx.sender(),
        "only the reporting spotter can delete a sighting"
    );
    ctx.db.sighting().id().delete(sighting_id);
}
