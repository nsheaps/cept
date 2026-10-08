# Managing Spaces

A space is a set of pages kept together: in this browser, in a folder on your computer, or in a GitHub repository. Manage your spaces in **Settings > Spaces**: open the **More** menu at the bottom of the sidebar, choose **Settings**, then the **Spaces** tab.

## Creating a space

Choose **Create new space** in Settings > Spaces, then where the space lives:

- **Local**: the pages are kept in the browser's storage on this device.
- **Local folder**: the pages are Markdown files in a folder you pick (see [Platform support](platform-support.md#opening-a-folder-in-the-browser)).
- **Git**: Cept copies a repository's pages to this device.

The new space opens right away.

## What each space holds

Settings > Spaces lists every space with where it lives, its number of pages and the size of its page files, whether it is open or not. A folder space whose folder is not connected shows "pages unknown" until you reconnect its folder.

Choose **Space settings** (the gear) next to a space for its details.

## Renaming a space

In a space's details, click its name, type the new one and choose **Save**. You can also click the space name at the top of the sidebar.

A space kept as files has a `space.cept.yaml` file (see [Space configuration](../reference/space-config.md)). Renaming the space changes the `name:` line in that file and keeps everything else in it, comments included. If Cept cannot read the file, it does not rename the space and says why; fix the file and try again. A folder space needs its folder connected to be renamed.

### The slug

The details also show the space's **slug**, a short lowercase name such as `my-notes`. Cept uses it to name the space in listings and in published links. Click it to change it. Cept warns you first: links that use the old slug stop working.

## Removing or deleting a space

Choose the trash icon next to a space, or the button at the bottom of its details. Cept always asks first, and says what happens:

| Where the space lives | The button says           | What happens                                                                                        |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| In this browser       | **Delete this space**     | The space and its pages are deleted for good.                                                       |
| Local folder          | **Remove from Cept**      | Cept forgets the space. The folder and its files stay on your computer, and you can open it again. |
| Git repository        | **Remove from this device** | The copy on this device is deleted, with changes not yet synced. The repository on GitHub is not changed. |

You can delete any space, including your first one and your only one. When you delete your only space, a new, empty space named **My Space** takes its place. Deleting a space never deletes your settings or your other spaces.
