# The main purpose of the project is to demonstrate the following:
#  - Cucumber/Gherkin and Feature file implementation
#  - Page Object Model
#  - Repository created in GitHub
#  - Independant tests
#  - CI Pipeline Integration
#  - Implementation of the Axe-plugin for usability reporting
#  - API Testing
#  - Different ways of interacting and verifying UI element attributes

Feature: Dyson Homepage Regression Tests

  Background: Sign into my NBS account then visit the Dyson manufacturer homepage
    Given I sign into NBS and visit the manufacturer home page

  Scenario Outline: Manufacturer homepage URL contains expected text
    Then The URL will contain the expected text "<expectedText>"

    Examples:
      | expectedText         |
      | /manufacturer/dyson/ |
      | /overview            |

  Scenario: Telephone link has the correct number, protocol and href
    Then The number will be correct, the href will be as expected, and the telephone protocol will be correct "08003457788"

  Scenario: Webpage title is as expected
    Then The webpage title will be as expected "Dyson | Overview | BIM Library"

  Scenario: Href attribute of the Source logo is as expected
    Then The href attribute of the Source logo will be as expected "/en/"

  Scenario: External manufacturer link attribute contains the correct URL
    Then The manufacturer website link is correct "https://www.dyson.co.uk/commercial/overview/architects-designers"

  Scenario: Contact manufacturer button shows the correct text
    Then The button will display the correct text "Contact manufacturer"

  Scenario: Accessibility checks complete and results are output to the console
    Then The results of the accessibility checks will be output to the console

  Scenario: API response and content are as expected
    Then The API response and content is as expected

  Scenario: Dyson navigation bar has the correct tabs and expected links
    Then The Dyson navigation bar should have the correct tabs and href links

  Scenario: Clicking sign in from any webpage logs the user in and returns them to the previous page
    When I sign in with valid credentials
    Then The user is then logged in and returned to their previous page
    And The UI will reflect that the user is logged in

  Scenario: Visual regression testing of the Dyson homepage will show no significant differences compared to the baseline image
    Then I take a screenshot of the Dyson homepage and compare it to the baseline image to check for visual regressions
