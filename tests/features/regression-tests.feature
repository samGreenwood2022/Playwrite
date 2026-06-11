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
#  - GitHub repository management and best practices
#  - Independent tests
#  - CI Pipeline Integration
#  - Implementation of the Axe-plugin for usability reporting
#  - API Testing
#  - Different ways of interacting and verifying UI element attributes
#  - Tag-driven smoke / regression suites
#  - Auth via persisted storage state

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
    Then The webpage title will be as expected "Dysox | Overview | BIM Library"

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

  @smoke @regression
  Scenario: API response and content are as expected
    Then The API response and content is as expected

  @smoke @regression @authenticated
  Scenario: Tabs on the Dyson navigation bar are visible, in the correct order and have the correct href links
    Then Tabs on the Dyson navigation bar are visible, in the correct order and have the correct href links

  @regression @authenticated
  Scenario: Visual regression testing of the Dyson homepage will show no significant differences compared to the baseline image
    Then I take a screenshot of the Dyson homepage and compare it to the baseline image to check for visual regressions

  @authenticated @regression
  Scenario: Stored auth session shows the user as already signed in without running the sign-in flow
    Then The UI will reflect that the user is logged in  
    
  @authenticated
  Scenario: Telephone link has the correct number, protocol and href
    Then The number will be correct, the href will be as expected, and the telephone protocol will be correct "08003457788"



