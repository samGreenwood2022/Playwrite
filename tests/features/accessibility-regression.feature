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
# Accessibility regression tests for the Dyson manufacturer page.
#
# These scenarios run an Axe accessibility scan of the page and write the
# results to an HTML report for a human to review. They're kept in their own
# file so the accessibility checks can be run — or skipped — independently of the
# functional, API and visual suites.
#
# Scenarios are @authenticated, so the Before hook (world.ts) loads the saved
# sign-in session and the scan runs against the logged-in page. The shared step
# definitions, hooks and page objects are reused.

Feature: Dyson Homepage Accessibility Regression Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  # Runs an Axe accessibility scan of the page and writes the results to an HTML
  # report (reports/accessibility-report.html) for a human to review.
  @accessibility @regression @authenticated
  Scenario: Accessibility checks complete and results are output to an HTML report
    Then The results of the accessibility checks will be output to an HTML report
