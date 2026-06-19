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
#  - A set of Certifications-tab scenarios that intercept the tab's data request
#    (set up by the Before hook in world.ts, which calls the helpers in
#    network-stubs.ts) to force states the live data won't give us on demand:
#      * a renamed certification (proves the UI shows what the API returns)
#      * no results (the empty state)
#      * a 500 server error
#      * a slow response (proves the tab waits and still renders)
#      * a dropped connection, where no response arrives at all
#      * a malformed payload: 200 OK but with the data the UI needs missing
#  - One scenario that blocks analytics and other third-party requests to prove
#    the page still renders its core content without them.
#
# Each scenario is wired to its behaviour by its tag (e.g. @stub-error-certifications):
# the Before hook reads the tag and sets up the matching network stub before the
# page loads. The step definitions, hooks and page objects are shared with the
# rest of the suite, so these scenarios reuse the same Background and
# smoke/regression tags as the UI tests.

Feature: Dyson Manufacturer API and Network Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  # A live (real, not stubbed) call to the OneTrust geolocation API, then a check
  # that the country it returns and the locale label shown in the UI agree — so
  # the page is reading the user's location correctly.
  @smoke @regression
  Scenario: The geolocation API endpoint returns the expected response and the UI locale label matches
    Then The API response and the UI locale label are as expected

  # The certifications response is faked ("stubbed") in the Before hook (world.ts):
  # the real request still goes to the live API, then the first certification in
  # the response is renamed to a fixed value the live data never has,
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

  # Holding the certifications response back for a few seconds simulates a slow
  # backend. This proves the tab waits for the data and still renders its tiles
  # rather than erroring or giving up on a sluggish network.
  @regression @stub-slow-certifications
  Scenario: The Certifications tab still renders when its data request is slow
    When I open the Certifications tab
    Then The Certifications tab still renders its certifications

  # Dropping the connection entirely (no response at all) is a different failure
  # from a 500 — it's the "network died mid-request" case. It documents that the
  # tab opens but shows no tiles and no feedback when the request never lands.
  @regression @stub-abort-certifications
  Scenario: The Certifications tab renders no tiles when its request is dropped
    When I open the Certifications tab with its request dropped
    Then The Certifications tab renders no certification tiles

  # Returning 200 OK but with a broken body (the data the UI needs is missing)
  # is the "the request succeeded but the response is unusable" case. It
  # documents that the tab opens but renders no tiles when the payload is malformed.
  @regression @stub-malformed-certifications
  Scenario: The Certifications tab renders no tiles when the API returns a malformed payload
    When I open the Certifications tab
    Then The Certifications tab renders no certification tiles

  # Blocking analytics, consent and other third-party requests proves the Dyson
  # page doesn't depend on that non-essential traffic to function — and keeps
  # flaky third-party calls out of the test.
  @regression @block-analytics
  Scenario: The Dyson page renders core content with analytics and third-party requests blocked
    Then The Dyson page core content still renders
