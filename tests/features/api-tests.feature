#                  .-"""""""-.
#                .'  .  .  .  '.
#               /   o    o    o  \
#              |  o    o    o    o|
#              |   o    o    o    |
#              |  o    o    o    o|
#               \   o    o    o  /
#                '.  .  .  .  .'
#                  '-.........-'
#
# API / network-layer tests for the Dyson manufacturer page.
#
# These scenarios exercise the app's behaviour at the network boundary rather
# than its UI chrome:
#  - A live API check against the OneTrust geolocation endpoint, asserting the
#    response and the UI locale label agree.
#  - Three Certifications-tab scenarios that intercept the backing GraphQL
#    request (stubbed in the Before hook in world.ts) to drive the tab into
#    states the live data won't reproduce on demand: a renamed certification,
#    an empty result set, and a 500 server error.
#
# Step definitions and hooks are shared with the rest of the suite (cucumber
# loads them by glob), so these scenarios reuse the same Background, page
# objects, and tag-driven smoke / regression filtering as the UI tests.

Feature: Dyson Manufacturer API and Network Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  @smoke @regression
  Scenario: API response and content are as expected
    Then The API response and content is as expected

  # The certifications GraphQL search is stubbed in the Before hook (world.ts):
  # the first certification is renamed to a fixed value the live data never
  # contains, so the assertion proves our app renders what the API returns —
  # deterministically, regardless of Dyson's real certifications.
  @regression @stub-certifications
  Scenario: A stubbed certification name renders on the Certifications tab
    When I open the Certifications tab
    Then The first certification tile shows "Stubbed Test Certification"

  # Forcing an empty GraphQL response exercises the no-results UI — a state the
  # live data won't reproduce on demand (Dyson always has certifications).
  @regression @stub-empty-certifications
  Scenario: The Certifications tab shows the empty state when there are no certifications
    When I open the Certifications tab
    Then The Certifications tab shows no results

  # Forcing a 500 on the certifications GraphQL request exercises the server-error
  # path — a failure mode the live API won't produce on demand. Documents that
  # the app currently degrades to a blank panel (no tiles, no empty-state, and no
  # explicit error message) rather than surfacing the failure to the user.
  @regression @stub-error-certifications
  Scenario: The Certifications tab shows an error state when the API returns a 500
    When I open the Certifications tab
    Then The Certifications tab shows a server error
