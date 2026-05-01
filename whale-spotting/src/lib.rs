use spacetimedb::ReducerContext;

#[spacetimedb::table(name = user)]
pub struct User {
    #[primary_key]
    pub identity: spacetimedb::Identity,
    pub username: String,
}

#[spacetimedb::table(name = whale_species)]  
pub struct WhaleSpecies {
    #[primary_key]
    pub id: u32,
    pub name: String,
    pub scientific_name: String,
}

#[spacetimedb::table(name = sighting)]
pub struct Sighting {
    #[primary_key]
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

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {}

#[spacetimedb::reducer]
pub fn register_user(_ctx: &ReducerContext, _username: String) {}

#[spacetimedb::reducer]
pub fn report_sighting(
    _ctx: &ReducerContext,
    _species_id: u32,
    _latitude: f64,
    _longitude: f64,
    _description: String,
    _pod_size: u32,
) {}

#[spacetimedb::reducer]
pub fn update_sighting(
    _ctx: &ReducerContext,
    _sighting_id: u64,
    _species_id: u32,
    _latitude: f64,
    _longitude: f64,
    _description: String,
    _pod_size: u32,
) {}

#[spacetimedb::reducer]
pub fn delete_sighting(
    _ctx: &ReducerContext,
    _sighting_id: u64,
) {}
