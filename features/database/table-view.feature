Feature: Database Table View
  As a user
  I want to view my database as a table
  So that I can see and edit data in a spreadsheet-like format

  Scenario: Display database as table
    Given I have a database with 5 rows and 3 properties
    When I open the table view
    Then I should see all 5 rows
    And I should see columns for each property

  Scenario: Sort rows by property
    Given I have a database with unsorted rows
    When I sort by the "priority" column ascending
    Then rows should be ordered by priority value

  Scenario: Filter rows
    Given I have a database with rows of different statuses
    When I filter to show only "In Progress" status
    Then only rows with "In Progress" should be visible
