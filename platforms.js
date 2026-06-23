// platforms.js – seznam platform za zbiranje ocen (skupno za vse strani)

window.PLATFORMS = [
  { id: "google",      label: "Google" },
  { id: "tripadvisor", label: "TripAdvisor" },
  { id: "booking",     label: "Booking.com" },
  { id: "facebook",    label: "Facebook" },
  { id: "yelp",        label: "Yelp" },
  { id: "airbnb",      label: "Airbnb" },
];

window.platformById = function (id) {
  return window.PLATFORMS.find(function (p) { return p.id === id; }) || { id: id, label: id };
};
