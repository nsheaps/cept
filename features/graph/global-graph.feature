Feature: Global Knowledge Graph
  As a user
  I want to see a graph of all pages and their connections
  So that I can understand the structure of my workspace

  Scenario: Display global graph
    Given I have a workspace with 10 pages and links between them
    When I open the global graph view
    Then I should see nodes for all 10 pages
    And I should see edges for all links between pages

  Scenario: Click node to navigate
    Given I am viewing the global graph
    When I click on a node representing "Project Roadmap"
    Then I should navigate to the "Project Roadmap" page

  Scenario: Node size reflects connections
    Given I have a page with 5 incoming links
    And another page with 1 incoming link
    When I view the global graph
    Then the well-connected page should have a larger node
