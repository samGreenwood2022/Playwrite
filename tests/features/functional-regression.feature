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
# The main purpose of the project is to demonstrate the following:
#  - Cucumber/Gherkin and Feature file implementation
#  - Page Object Model Design Pattern
#  - GitHub repository management
#  - Independent tests
#  - CI Pipeline Integration
#  - Implementation of the Axe-plugin for usability reporting
#  - API Testing and mocked responses
#  - Different ways of interacting and verifying UI element attributes
#  - Tag-driven Gherkin tests
#  - Auth via persisted storage state (created in beforeAll hook in world.ts)
#
# The regression suite is split by test type across sibling feature files:
#  - functional-regression.feature    (this file) UI behaviour and attribute checks
#  - api-regression.feature           network / API behaviour and stubbed responses
#  - visual-regression.feature        baseline screenshot comparison
#  - accessibility-regression.feature Axe accessibility scan
#
# This file holds the Dyson manufacturer page functional checks: signing in, the
# page's URL / title / links, the navigation bar and the telephone link. Most
# scenarios are tagged @authenticated, which tells the Before hook (world.ts) to
# load a saved sign-in session so they start already logged in — only the first
# scenario below actually runs the sign-in flow itself.

Feature: Dyson Homepage Functional Regression Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  # The one scenario that actually runs the sign-in flow (it isn't @authenticated,
  # so it doesn't start signed in). It signs in from the Dyson page, then checks
  # the user is sent back to the same page and the header now shows them logged in.
  @regression
  Scenario: Clicking sign in from any webpage logs the user in and returns them to the previous page
    When I sign in with valid credentials
    Then The user is then logged in and returned to their previous page
    And The UI will reflect that the user is logged in

  # Checks the manufacturer page's URL contains the expected fragments. A Scenario
  # Outline runs the same check once per row in the Examples table below, so each
  # value (<expectedText>) is tested as its own scenario.
  @smoke @regression @authenticated
  Scenario Outline: Manufacturer homepage URL contains expected text
    Then The URL will contain the expected text "<expectedText>"

    Examples:
      | expectedText         |
      | /manufacturer/dyson/ |
      | /overview            |

  # Checks the browser tab's <title> matches the expected text exactly.
  @smoke @regression @authenticated
  Scenario: Webpage title is as expected
    Then The webpage title will be as expected "Dyson | Overview | BIM Library"

  # Checks the NBS Source logo links back to the homepage (its href is "/en/").
  @smoke @regression @authenticated
  Scenario: Href attribute of the Source logo is as expected
    Then The href attribute of the Source logo will be as expected "/en/"

  # Checks the "Contact manufacturer" link points to Dyson's own external website.
  @smoke @regression @authenticated
  Scenario: External manufacturer link attribute contains the correct URL
    Then The manufacturer website link is correct "https://www.dyson.co.uk/commercial/overview/architects-designers"

  # Checks the "Contact manufacturer" button shows the expected visible text.
  @smoke @regression @authenticated
  Scenario: Contact manufacturer button shows the correct text
    Then The button will display the correct text "Contact manufacturer"

  # Checks the navigation bar shows exactly these tabs, in this order, each
  # linking to the right URL. The expected labels and hrefs come from the data
  # table below, so the spec — not the page object — owns the list of what
  # should appear.
  @smoke @regression @authenticated
  Scenario: Tabs on the Dyson navigation bar are visible, in the correct order and have the correct href links
    Then The Dyson navigation bar displays the following tabs in order
      | label          | href                                                                     |
      | Overview       | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/overview                   |
      | Products       | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/products                   |
      | Certifications | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/third-party-certifications |
      | Literature     | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/literature                 |
      | Case studies   | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/case-studies               |
      | About us       | /en/manufacturer/dyson/nakAxHWxDZprdqkBaCdn4U/about                      |

  # The counterpart to the first scenario: this one is @authenticated, so it
  # starts from the saved session and never runs the sign-in steps. It proves the
  # stored session alone is enough to show the user as already logged in.
  @authenticated @regression
  Scenario: Stored auth session shows the user as already signed in without running the sign-in flow
    Then The UI will reflect that the user is logged in

  # Checks the telephone link shows the right number and uses the tel: protocol
  # in its href, so tapping it on a phone starts a call. The expected number and
  # href come from the data table below.
  @authenticated
  Scenario: Telephone link has the correct number, protocol and href
    Then The telephone link displays the correct details
      | number      | href            |
      | 08003457788 | tel:08003457788 |
