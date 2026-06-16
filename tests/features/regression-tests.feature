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

Feature: Dyson Homepage Regression Tests

  Background: Navigate to Dyson manufacturer homepage
    Given I navigate to the Dyson manufacturer homepage

  @regression
  Scenario: Clicking sign in from any webpage logs the user in and returns them to the previous page
    When I sign in with valid credentials
    Then The user is then logged in and returned to their previous page
    And The UI will reflect that the user is logged in

  @smoke @regression @authenticated
  Scenario Outline: Manufacturer homepage URL contains expected text
    Then The URL will contain the expected text "<expectedText>"

    Examples:
      | expectedText         |
      | /manufacturer/dyson/ |
      | /overview            |

  @smoke @regression @authenticated
  Scenario: Webpage title is as expected
    Then The webpage title will be as expected "Dyson | Overview | BIM Library"

  @smoke @regression @authenticated
  Scenario: Href attribute of the Source logo is as expected
    Then The href attribute of the Source logo will be as expected "/en/"

  @smoke @regression @authenticated
  Scenario: External manufacturer link attribute contains the correct URL
    Then The manufacturer website link is correct "https://www.dyson.co.uk/commercial/overview/architects-designers"

  @smoke @regression @authenticated
  Scenario: Contact manufacturer button shows the correct text
    Then The button will display the correct text "Contact manufacturer"

  @accessibility @regression @authenticated
  Scenario: Accessibility checks complete and results are output to an HTML report
    Then The results of the accessibility checks will be output to an HTML report

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

  @regression @authenticated
  Scenario: Visual regression testing of the Dyson homepage will show no significant differences compared to the baseline image
    Then I take a screenshot of the Dyson homepage and compare it to the baseline image to check for visual regressions

  @authenticated @regression
  Scenario: Stored auth session shows the user as already signed in without running the sign-in flow
    Then The UI will reflect that the user is logged in  
    
  @authenticated
  Scenario: Telephone link has the correct number, protocol and href
    Then The telephone link displays the correct details
      | number      | href            |
      | 08003457788 | tel:08003457788 |



