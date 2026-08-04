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
# Visual regression tests for the NBS Source site.
#
# These scenarios catch unintended *visual* changes (shifted layout, missing
# images, font / colour changes) by comparing a screenshot against a saved
# baseline image, rather than asserting on specific DOM values. They're kept in
# their own file so the slower, image-based checks are easy to run — or skip —
# independently of the functional and API suites.
#
# Each page is covered by one row of the Scenario Outline below, so adding
# another page is a one-line change to the Examples table. The rows are
# independent scenarios (each gets its own fresh tab in world.ts), not a single
# journey — the order in the table is just the order they run in.
#
# Scenarios are @authenticated, so the Before hook (world.ts) loads the saved
# sign-in session and the screenshot is taken as a logged-in user — matching the
# baseline. The shared step definitions, hooks and page objects are reused.
#
# Each page keeps its own baseline, per OS, at tests/snapshots/<baseline>-<platform>.png
# (NBS -> nbs-homepage, Dyson -> dyson-homepage, Abloy UK -> abloy-homepage). The
# first run for a baseline saves the current screenshot and passes; later runs
# compare against it.

Feature: NBS Source Visual Regression Tests

  # Navigates to the page under test, then takes a full-page screenshot and
  # compares it pixel-by-pixel against that page's saved baseline to catch
  # unintended visual changes. The screenshot step waits for a page-specific
  # element first so the page is fully rendered before capture.
  # @visual marks these as the pixel-comparison scenarios so a run can exclude
  # them by tag. CI uses that to keep visual checks on chromium only: a baseline
  # is per engine (see BasePage.verifyVisualRegression), so covering all three
  # would mean three sets of baselines per OS — six files per page — every one of
  # which has to be regenerated whenever a mask changes. That's a lot of upkeep
  # for a third-party site we don't control, and the functional, API and
  # accessibility scenarios are where the real cross-browser signal is.
  @regression @authenticated @visual
  Scenario Outline: The <page> homepage shows no significant visual differences compared to its baseline image
    Given I navigate to the "<page>" homepage
    Then I take a screenshot of the "<page>" homepage and compare it to its baseline

    Examples:
      | page                  |
      | Dyson manufacturer    |
      | Abloy UK manufacturer |
