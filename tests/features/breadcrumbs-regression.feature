# Breadcrumb regression tests for the NBS Source site.
#
# Breadcrumbs are how a user works out where a product sits in the category tree
# and how they climb back up it, so this checks all four things that matters for:
# that the trail is on screen, that it says the right things, that each crumb
# links to the right place, and that they're in the right order.
#
# There's no Background here on purpose. The scenario navigates straight to the
# product by URL (see ProductPage), rather than driving the site's search box the
# way the functional and API features do. The ids in a product URL are stable
# keys, so going direct is no more brittle than searching — and it keeps this
# scenario testing breadcrumbs instead of incidentally re-testing the live search
# index.
#
# Not @authenticated: product pages are public, so this needs no saved session.

Feature: NBS Source Breadcrumb Regression Tests

  # The expected trail lives in the table rather than in code, so it reads as the
  # breadcrumb trail itself and doubles as documentation of what it should be.
  # The hrefs are the site's relative paths, which is what the anchors carry.
  @regression
  Scenario: Breadcrumbs on a hand dryer product page show the full category trail
    Given I navigate to the "Dyson Airblade 9kJ Hand Dryer (HU03)" product page
    Then The breadcrumbs show the following trail
      | text                                | href                                                                                                                |
      | Home                                | /en/gb                                                                                                              |
      | Categories                          | /en/gb/categories                                                                                                   |
      | BIM                                 | /en/gb/categories/bim                                                                                               |
      | Fittings, furnishings and equipment | /en/gb/category/bim/fittings-furnishings-and-equipment/uybG3djVP8AgJk2Fu6rgAJ                                       |
      | Furniture                           | /en/gb/category/bim/fittings-furnishings-and-equipment/furniture/8YTvxKSguuD4UvDZkvcfq5                             |
      | Personal dryers                     | /en/gb/category/bim/fittings-furnishings-and-equipment/furniture/personal-dryers/4M5vqFnife127jyxbKFZiz             |
      | Hand dryers                         | /en/gb/category/bim/fittings-furnishings-and-equipment/furniture/personal-dryers/hand-dryers/buN9ocshphmJZdNkzJ8Fqb |
