const main = document.querySelector("main");
const freshness = document.getElementById("freshness");
function updateFreshness() {
  const now = Date.now();
  const observed = Date.parse(main.dataset.observed);
  const expires = Date.parse(main.dataset.expires);
  const current =
    Number.isFinite(observed) &&
    Number.isFinite(expires) &&
    now >= observed - 60000 &&
    now < expires;
  freshness.textContent = current
    ? "Recent observations. A responding public endpoint does not confirm an authenticated customer workflow."
    : "Observation age cannot be verified or the checks are stale. Current endpoint status is unknown; recorded results remain below.";
  freshness.classList.toggle("stale", !current);
  for (const badge of document.querySelectorAll("[data-result]")) {
    badge.classList.toggle("stale", !current);
    badge.textContent = current
      ? `Last check: ${badge.dataset.result === "responding" ? "responding" : "not verified"}`
      : "Current status: unknown";
  }
}
updateFreshness();
setInterval(updateFreshness, 30000);
