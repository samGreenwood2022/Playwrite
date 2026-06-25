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
# Accessibility regression tests for the NBS Source site.
#
# These scenarios run an Axe accessibility scan of each page and write the
# results to an HTML report for a human to review. They're kept in their own
# file so the accessibility checks can be run — or skipped — independently of the
# functional, API and visual suites.
#
# Each page is covered by one row of the Scenario Outline below, so adding
# another page is a one-line change to the Examples table. The rows are
# independent scenarios (each gets its own fresh tab in world.ts), not a single
# journey — the order in the table is just the order they run in. Each page
# writes its own report at reports/accessibility-report-<slug>.html so the scans
# don't overwrite each other.
#
# Scenarios are @authenticated, so the Before hook (world.ts) loads the saved
# sign-in session and the scan runs against the logged-in page. The shared step
# definitions, hooks and page objects are reused.

Feature: NBS Source Accessibility Regression Tests

  # Navigates to the page under test, then runs an Axe accessibility scan and
  # writes any violations to that page's HTML report for a human to review.
  @accessibility @regression @authenticated
  Scenario Outline: The <page> homepage passes its accessibility scan and results are output to an HTML report
    Given I navigate to the "<page>" homepage
    Then The accessibility checks on the "<page>" homepage are output to an HTML report

    Examples:
      | page               |
      | NBS                |
      | Dyson manufacturer |
