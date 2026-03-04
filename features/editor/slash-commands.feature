Feature: Slash Command Menu
  As a user editing a page
  I want to type "/" to see a menu of block types
  So that I can quickly insert any block type without leaving the keyboard

  Background:
    Given I have a workspace with a page open in the editor

  Scenario: Opening the slash menu
    When I type "/" on an empty line
    Then I should see the slash command menu
    And the menu should contain at least 20 block types
    And the menu should be grouped by category

  Scenario: Filtering slash menu by typing
    When I type "/mer"
    Then I should see the slash command menu filtered to "Mermaid"
    And only matching items should be visible

  Scenario: Inserting a heading via slash command
    When I type "/heading1"
    And I press Enter
    Then the current block should become a Heading 1
    And the slash menu should close

  Scenario: Dismissing the slash menu
    When I type "/"
    And I press Escape
    Then the slash menu should close
    And the "/" character should remain in the text

  Scenario: Keyboard navigation in slash menu
    When I type "/"
    And I press the down arrow 3 times
    And I press Enter
    Then the third item in the menu should be inserted
