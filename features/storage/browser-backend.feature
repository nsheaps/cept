Feature: Browser Storage Backend
  As a new user
  I want to use Cept in my browser without any setup
  So that I can start writing immediately

  Scenario: Create workspace with browser backend
    Given I open the Cept web app
    When I click "Start writing"
    Then a workspace should be created using IndexedDB
    And I should see the editor with a blank page

  Scenario: Data persists across page reloads
    Given I have a workspace with a page containing "Hello World"
    When I reload the browser
    Then I should see the page with "Hello World"

  Scenario: Browser backend reports correct capabilities
    Given I have a browser-backed workspace
    Then the backend should report no history capability
    And the backend should report no collaboration capability
    And the backend should report no sync capability
