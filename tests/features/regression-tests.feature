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

  Scenario Outline: Verify the manufacturers homepage URL contains expected text
    Then The URL will contain the expected text "<expectedText>"

    Examples:
      | expectedText         |
      | /manufacturer/dyson/ |
      | /overview            |

  Scenario: I verify the telephone link has the correct number, protocol and href
    Then The number will be correct, the href will be as expected, and the telephone protocol will correct "08003457788"

  Scenario: I verify the webpage title on page is as expected
    Then The webpage title will be as expected "Dyson | Overview | NBS BIM Library"

  Scenario: I verify the href attribute of the Source logo is as expected
    Then The href attribute of the Source logo will be as expected "/"

  Scenario: I verify the external manufacturer link attribute contains the correct url
    Then The manufacturer website link is correct "https://www.dyson.co.uk/commercial/overview/architects-designers"

  Scenario: I verify the contact manufacturer button shows the correct text
    Then The button will display the correct text "Contact manufacturer"

  Scenario: I run accessibility checks on the manufacturer homepage and report results to console
    Then The results of the accessibility checks will be output to the console

  Scenario: I perform an api test and verify the response and content is as expected
    Then The api reponse and content is expected

  Scenario: I verify the Dyson navigation bar has the correct tabs and expected links
    Then The Dyson navigation bar should have the correct tabs and href links
