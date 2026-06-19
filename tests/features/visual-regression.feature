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
# Visual regression tests for the Dyson manufacturer page.
#
# These scenarios catch unintended *visual* changes (shifted layout, missing
# images, font / colour changes) by comparing a screenshot against a saved
# baseline image, rather than asserting on specific DOM values. They're kept in
# their own file so the slower, image-based checks are easy to run — or skip —
# independently of the functional and API suites.
#
# Scenarios are @authenticated, so the Before hook (world.ts) loads the saved
# sign-in session and the screenshot is taken as a logged-in user — matching the
# baseline. The shared step definitions, hooks and page objects are reused.

Feature: Dyson Homepage Visual Regression Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  # Takes a full-page screenshot and compares it pixel-by-pixel against a saved
  # baseline image to catch unintended visual changes (shifted layout, missing
  # images, font/colour changes). It waits for the navigation tabs to be visible
  # first so the page is fully rendered before the screenshot. First run creates
  # the baseline; later runs compare against it.
  @regression @authenticated
  Scenario: Visual regression testing of the Dyson homepage will show no significant differences compared to the baseline image
    Then I take a screenshot of the Dyson homepage and compare it to the baseline image to check for visual regressions
