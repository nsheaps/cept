Feature: Sidebar Navigation
  As a user
  I want a sidebar that shows my page hierarchy
  So that I always know where I am and can navigate easily

  Scenario: Sidebar shows page tree
    Given I have a workspace with nested pages
    Then the sidebar should show a tree of all pages
    And pages with children should have expand/collapse controls

  Scenario: Current page is highlighted
    Given I am viewing a page nested 3 levels deep
    Then that page should be highlighted in the sidebar
    And all ancestor pages should be auto-expanded

  Scenario: Drag to reorder pages
    Given I have two sibling pages "Page A" and "Page B"
    When I drag "Page B" above "Page A"
    Then "Page B" should appear before "Page A" in the sidebar
