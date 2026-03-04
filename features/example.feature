Feature: Application Smoke Test
  As a new user
  I want to open the Cept web app
  So that I can verify the application loads correctly

  Scenario: Application loads successfully
    Given I open the Cept web app
    Then I should see the onboarding screen
    And the page title should contain "Cept"

  Scenario: Browser backend creates workspace
    Given I open the Cept web app
    When I click "Start writing"
    Then a workspace should be created with BrowserFsBackend
    And I should see the editor
