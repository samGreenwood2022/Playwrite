# This file holds the Abloy UK manufacturer page functional checks, following the
# same structure as functional-regression.feature (the Dyson page): the page's
# URL / title / links, the navigation bar and the telephone link.
#
# Unlike the Dyson scenarios these are NOT tagged @authenticated: the manufacturer
# Overview page renders its content for logged-out visitors too, so these checks
# don't need the saved sign-in session. Every value below (title, telephone, tab
# labels and hrefs) was read from the live Abloy UK page rather than guessed.

Feature: Abloy UK Homepage Functional Regression Tests

  Background: Navigate to Abloy UK manufacturer homepage
    Given I navigate to the Abloy UK manufacturer homepage

  # Checks the manufacturer page's URL contains the expected fragments. A Scenario
  # Outline runs the same check once per row in the Examples table below. Reuses
  # the generic "URL will contain" step (basePage) from dyson-steps.ts.
  @smoke @regression @abloy
  Scenario Outline: Manufacturer homepage URL contains expected text
    Then The URL will contain the expected text "<expectedText>"

    Examples:
      | expectedText             |
      | /manufacturer/abloy-uk/  |
      | /overview                |

  # Checks the browser tab's <title> matches the expected text exactly. Reuses the
  # generic "webpage title" step (basePage) from dyson-steps.ts.
  @smoke @regression @abloy
  Scenario: Webpage title is as expected
    Then The webpage title will be as expected "Abloy UK | Overview | NBS Source"

  # Checks the NBS Source logo links back to the homepage (its href is "/en/gb").
  # Reuses the generic "logo href" step (basePage) from dyson-steps.ts.
  @smoke @regression @abloy
  Scenario: Href attribute of the Source logo is as expected
    Then The href attribute of the Source logo will be as expected "/en/gb"

  # Checks the "Contact manufacturer" button shows the expected visible text.
  @smoke @regression @abloy
  Scenario: Contact manufacturer button shows the correct text
    Then The Abloy contact button will display the correct text "Contact manufacturer"

  # Proves the page shell plus real heading content ("Abloy UK") has rendered.
  @smoke @regression @abloy
  Scenario: Core page content renders
    Then The Abloy page core content renders

  # Checks the navigation bar shows exactly these tabs, in this order, each linking
  # to the right URL. Note Abloy's nav has a "CPD" tab where Dyson has
  # "Certifications". The expected labels and hrefs come from the data table below,
  # so the spec — not the page object — owns the list of what should appear.
  @smoke @regression @abloy
  Scenario: Tabs on the Abloy navigation bar are visible, in the correct order and have the correct href links
    Then The Abloy navigation bar displays the following tabs in order
      | label          | href                                                          |
      | Overview       | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/overview     |
      | Products       | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/products     |
      | CPD            | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/cpd          |
      | Literature     | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/literature   |
      | Case studies   | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/case-studies |
      | About us       | /en/gb/manufacturer/abloy-uk/nbAnmJUFmBRb9A2M4g4Gpz/about        |

  # Checks the API response and the UI locale label agree (geolocation → "UK").
  @regression @abloy
  Scenario: Geolocation API response and the UI locale label are as expected
    Then The Abloy API response and the UI locale label are as expected

  # Checks the telephone link shows the right number and uses the tel: protocol in
  # its href. The expected number and href come from the data table below.
  @regression @abloy
  Scenario: Telephone link has the correct number, protocol and href
    Then The Abloy telephone link displays the correct details
      | number             | href                   |
      | +44 (0)1902 364500 | tel:+44 (0)1902 364500 |
