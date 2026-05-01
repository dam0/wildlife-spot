// Test the report call
const userPins = [
  {
    id: "test",
    lat: 37.7749,
    lng: -122.4194,
    species_id: 2,
    pod_size: 3,
    description: "test whale"
  }
];

const SPECIES_NAMES = {
  1: 'Blue Whale',
  2: 'Humpback Whale',
  3: 'Gray Whale',
  4: 'Sperm Whale',
  5: 'Killer Whale',
  6: 'Minke Whale',
};

const pin = userPins[0];
const markerPos = { lat: 37.7749, lng: -122.4194 };
const descriptionInput = null;

const reportPin = userPins.find((p) => p.id === pin.id);
if (reportPin) {
  const finalDesc = descriptionInput?.value || reportPin.description || `${SPECIES_NAMES[reportPin.species_id]} pod of ${reportPin.pod_size} whales`;
  console.log('Call args:', [
    reportPin.species_id,
    markerPos.lat,
    markerPos.lng,
    finalDesc,
  ]);
}
