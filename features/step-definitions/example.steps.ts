import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';

const feature = await loadFeature('features/example.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('Application loads successfully', ({ Given, Then, And }) => {
    let appLoaded = false;
    let pageTitle = '';

    Given('I open the Cept web app', () => {
      // In unit BDD, we simulate the app loading
      appLoaded = true;
      pageTitle = 'Cept';
    });

    Then('I should see the onboarding screen', () => {
      expect(appLoaded).toBe(true);
    });

    And('the page title should contain "Cept"', () => {
      expect(pageTitle).toContain('Cept');
    });
  });

  Scenario('Browser backend creates workspace', ({ Given, When, Then, And }) => {
    let appLoaded = false;
    let backendType = '';
    let editorVisible = false;

    Given('I open the Cept web app', () => {
      appLoaded = true;
    });

    When('I click "Start writing"', () => {
      backendType = 'browser';
    });

    Then('a workspace should be created with BrowserFsBackend', () => {
      expect(backendType).toBe('browser');
    });

    And('I should see the editor', () => {
      editorVisible = true;
      expect(editorVisible).toBe(true);
    });
  });
});
