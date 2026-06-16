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
# API / network tests for the Dyson manufacturer page.
#
# These scenarios test how the app behaves at the network level rather than the
# normal UI:
#  - A live check against the OneTrust geolocation API, making sure the response
#    and the UI's locale label agree.
#  - Three Certifications-tab scenarios that intercept the tab's data request
#    (set up in the Before hook in world.ts) to force states the live data won't
#    give us on demand: a renamed certification, no results, and a 500 error.
#
# The step definitions and hooks are shared with the rest of the suite, so these
# scenarios reuse the same Background, page objects, and smoke/regression tags
# as the UI tests.

Feature: Dyson Manufacturer API and Network Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  @smoke @regression
  Scenario: The geolocation API endpoint returns the expected response and the UI locale label matches
    Then The API response and the UI locale label are as expected

  # The certifications request is faked ("stubbed") in the Before hook (world.ts):
  # the first certification is renamed to a fixed value the live data never has,
  # so the check proves our app shows what the API returns — reliably, no matter
  # what Dyson's real certifications are.
  @regression @stub-certifications
  Scenario: A stubbed certification name renders on the Certifications tab
    When I open the Certifications tab
    Then The first certification tile shows "Stubbed Test Certification"

  # Forcing an empty response lets us test the "no results" screen — something
  # the live data won't show us on demand (Dyson always has certifications).
  @regression @stub-empty-certifications
  Scenario: The Certifications tab shows the empty state when there are no certifications
    When I open the Certifications tab
    Then The Certifications tab shows no results

  # Forcing a 500 on the certifications request lets us test the server-error
  # path — something the live API won't do on demand. It documents that the app
  # currently just shows a blank panel (no tiles, no "no results", no error
  # message) instead of telling the user something went wrong.
  @regression @stub-error-certifications
  Scenario: The Certifications tab shows an error state when the API returns a 500
    When I open the Certifications tab
    Then The Certifications tab shows a server error
