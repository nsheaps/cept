Feature: Page comments
  As a reader of a page
  I want to comment on text, reply, and resolve threads
  So that I can discuss a page without changing its content

  Background:
    Given I have a page "Alpha beta gamma." open with commenting as "Nate"

  Scenario: Comment on selected text
    When I select "beta" and comment "Nice word"
    Then the comments panel should list "Nice word" on the page, quoting "beta"
    And the page Markdown should contain a comment marker

  Scenario: Comment on the whole page
    When I comment on the whole page with "Needs a title"
    Then the comments panel should list "Needs a title" under "About the whole page"

  Scenario: Reply to a thread
    Given the page has a comment "Nice word" on "beta"
    When I reply "Agreed" to that thread
    Then the thread should show "Nice word" followed by "Agreed"

  Scenario: Resolve and reopen a thread
    Given the page has a comment "Nice word" on "beta"
    When I resolve that thread
    Then the thread should be marked resolved
    When I reopen that thread
    Then the thread should not be marked resolved

  Scenario: Comments survive a reload
    Given the page has a comment "Nice word" on "beta"
    When I reload the page
    Then the comments panel should list "Nice word" on the page, quoting "beta"

  Scenario: A comment whose text was removed is detached
    Given the page has a comment "Nice word" on "beta"
    When the text "beta" is removed from the page and the page is reloaded
    Then the comments panel should list "Nice word" under "Detached"
